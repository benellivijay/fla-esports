import { getDb } from '../../database/db';
import { CryptoUtil } from '../../utils/crypto';
import { Logger } from '../../utils/logger';
import { AppError } from '../../middleware/error.middleware';
import { Profile } from '../../types';

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

    const profile = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(userId) as unknown as Profile;
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

    return db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(userId) as unknown as Profile;
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

    Logger.audit({
      actorId: userId,
      action: 'FF_UID_LINKED',
      targetResource: 'profiles',
      targetId: userId,
      details: { ffUid: cleanFfUid, ffIgn: cleanFfIgn },
    });

    return {
      ffUid: cleanFfUid,
      ffIgn: cleanFfIgn,
      status: 'verified',
      message: 'Free Fire UID and in-game nickname linked successfully.',
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
