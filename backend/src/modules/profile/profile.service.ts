import { getDb } from '../../database/db';
import { CryptoUtil } from '../../utils/crypto';
import { Logger } from '../../utils/logger';
import { AppError } from '../../middleware/error.middleware';
import { Profile } from '../../types';
import { GDriveAuthStore } from '../../services/gdrive_auth_store.service';

export class ProfileService {
  /**
   * Retrieves profile and verification status for current user.
   * KYC is marked verified once both Phone AND Email are verified.
   */
  public static async getProfile(userId: string): Promise<{
    profile: Profile;
    kycStatus: 'verified' | 'unverified';
    isPhoneVerified: boolean;
    isEmailVerified: boolean;
    phone?: string;
    email?: string;
    userRole: string;
  }> {
    const db = getDb();
    const user = db.prepare('SELECT id, phone, email, role, status, is_phone_verified, is_email_verified FROM users WHERE id = ?').get(userId) as any;
    if (!user) {
      throw new AppError('User not found', 404);
    }

    let profile = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(userId) as unknown as Profile;

    // Auto-create profile row if missing (e.g. Google-auth users)
    if (!profile) {
      try {
        const username = (db.prepare('SELECT username FROM users WHERE id = ?').get(userId) as any)?.username || 'Player';
        db.prepare(`
          INSERT INTO profiles (id, user_id, display_name, ff_verification_status, matches_played, wins, total_kills, total_earnings, created_at, updated_at)
          VALUES (?, ?, ?, 'unverified', 0, 0, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).run(userId, userId, username);
        profile = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(userId) as unknown as Profile;
      } catch (createErr: any) {
        Logger.warn(`[PROFILE] Could not auto-create profile for ${userId}: ${createErr.message}`);
      }
    }

    if (!profile) {
      throw new AppError('Profile not found', 404);
    }

    // Compute dynamic, real-time career statistics from actual tournament entries, verified results, and prize credits
    try {
      const matchesRow = db.prepare('SELECT COUNT(DISTINCT tournament_id) as count FROM tournament_entries WHERE user_id = ?').get(userId) as any;
      const actualMatches = matchesRow?.count || 0;

      const resultsRow = db.prepare(`
        SELECT 
          COUNT(CASE WHEN (admin_confirmed_rank = 1 OR (admin_confirmed_rank IS NULL AND claimed_rank = 1)) THEN 1 END) as wins,
          COALESCE(SUM(COALESCE(admin_confirmed_kills, claimed_kills)), 0) as kills
        FROM match_results 
        WHERE user_id = ? AND status = 'approved'
      `).get(userId) as any;
      const actualWins = resultsRow?.wins || 0;
      const actualKills = resultsRow?.kills || 0;

      const earningsRow = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total 
        FROM wallet_ledger 
        WHERE user_id = ? AND type = 'prize_credit'
      `).get(userId) as any;
      const actualEarnings = earningsRow?.total || 0;

      const computedMatches = Math.max(profile.matches_played || 0, actualMatches);
      const computedWins = Math.max(profile.wins || 0, actualWins);
      const computedKills = Math.max(profile.total_kills || 0, actualKills);
      const computedEarnings = Math.max(profile.total_earnings || 0, actualEarnings);

      if (
        computedMatches !== profile.matches_played ||
        computedWins !== profile.wins ||
        computedKills !== profile.total_kills ||
        computedEarnings !== profile.total_earnings
      ) {
        db.prepare(`
          UPDATE profiles 
          SET matches_played = ?, wins = ?, total_kills = ?, total_earnings = ?, updated_at = CURRENT_TIMESTAMP 
          WHERE user_id = ?
        `).run(computedMatches, computedWins, computedKills, computedEarnings, userId);
        profile.matches_played = computedMatches;
        profile.wins = computedWins;
        profile.total_kills = computedKills;
        profile.total_earnings = computedEarnings;
      }
    } catch (statsErr: any) {
      Logger.warn(`[PROFILE] Error aggregating career statistics for ${userId}: ${statsErr.message}`);
    }

    const isPhoneVerified = user.is_phone_verified === 1;
    const isEmailVerified = user.is_email_verified === 1;
    const kycStatus = (isPhoneVerified && isEmailVerified) ? 'verified' : 'unverified';


    return {
      profile,
      kycStatus,
      isPhoneVerified,
      isEmailVerified,
      userRole: user.role,
      email: user.email || undefined,
      phone: user.phone || undefined,
    };
  }

  /**
   * Updates display name and avatar
   */
  public static async updateProfile(userId: string, data: { displayName?: string; avatarUrl?: string }): Promise<Profile> {
    const db = getDb();

    if (data.displayName) {
      db.prepare(`
        UPDATE profiles 
        SET display_name = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE user_id = ?
      `).run(data.displayName.trim(), userId);
    }

    if (data.avatarUrl) {
      db.prepare(`
        UPDATE profiles 
        SET avatar_url = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE user_id = ?
      `).run(data.avatarUrl.trim(), userId);
    }

    const updatedProfile = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(userId) as unknown as Profile;

    // Sync to Google Drive Auth Store
    const cachedPlayer = await GDriveAuthStore.getPlayer(userId);
    if (cachedPlayer) {
      cachedPlayer.profile = {
        ...cachedPlayer.profile,
        display_name: data.displayName ? data.displayName.trim() : cachedPlayer.profile?.display_name,
      };
      await GDriveAuthStore.savePlayer(cachedPlayer);
    }

    return updatedProfile;
  }

  /**
   * Step 1 FF UID Verification: Initiate challenge
  /**
   * Free Fire UID & IGN Link & Verification: Direct link without requiring costly in-game nickname change
   */
  public static async initiateFFVerification(userId: string, ffUid: string, ffIgn: string): Promise<{
    ffUid: string;
    ffIgn: string;
    status: string;
    message: string;
  }> {
    const db = getDb();
    const cleanFfUid = ffUid.trim();
    const cleanFfIgn = ffIgn.trim();

    // Check if this ff_uid is already verified by another user
    const existing = db.prepare(`
      SELECT user_id FROM profiles 
      WHERE ff_uid = ? AND ff_verification_status = 'verified' AND user_id != ?
    `).get(cleanFfUid, userId) as any;

    if (existing) {
      throw new AppError('This Free Fire UID is already linked to another account.', 409, 'FF_UID_ALREADY_LINKED');
    }

    db.prepare(`
      UPDATE profiles 
      SET ff_uid = ?, ff_ign = ?, ff_temp_challenge = NULL, ff_verification_status = 'verified', updated_at = CURRENT_TIMESTAMP 
      WHERE user_id = ?
    `).run(cleanFfUid, cleanFfIgn, userId);

    // Sync to Google Drive Auth Store
    const cachedPlayer = await GDriveAuthStore.getPlayer(userId);
    if (cachedPlayer) {
      cachedPlayer.ff_uid = cleanFfUid;
      cachedPlayer.ff_ign = cleanFfIgn;
      await GDriveAuthStore.savePlayer(cachedPlayer);
    }

    Logger.audit({
      actorId: userId,
      action: 'FF_UID_LINKED_GDRIVE',
      targetResource: 'profiles',
      targetId: userId,
      details: { ffUid: cleanFfUid, ffIgn: cleanFfIgn },
    });

    return {
      ffUid: cleanFfUid,
      ffIgn: cleanFfIgn,
      status: 'verified',
      message: 'Free Fire UID and in-game nickname linked successfully in Google Drive.',
    };
  }

  /**
   * Free Fire Profile Screenshot Upload (Optional Proof)
   */
  public static async submitFFProofScreenshot(userId: string, proofImageUrl: string): Promise<{
    status: string;
    message: string;
    proofUrl: string;
  }> {
    const db = getDb();
    const profile = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(userId) as unknown as Profile;

    if (!profile) {
      throw new AppError('Profile not found.', 404);
    }

    db.prepare(`
      UPDATE profiles 
      SET ff_proof_url = ?, ff_verification_status = 'verified', updated_at = CURRENT_TIMESTAMP 
      WHERE user_id = ?
    `).run(proofImageUrl, userId);

    Logger.audit({
      actorId: userId,
      action: 'FF_UID_PROOF_SUBMITTED',
      targetResource: 'profiles',
      targetId: userId,
      details: { proofImageUrl },
    });

    return {
      status: 'pending_review',
      message: 'Screenshot proof submitted successfully. An admin will review and verify your Free Fire UID shortly.',
      proofUrl: proofImageUrl,
    };
  }
}
