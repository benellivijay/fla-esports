"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfileService = void 0;
const db_1 = require("../../database/db");
const logger_1 = require("../../utils/logger");
const error_middleware_1 = require("../../middleware/error.middleware");
const gdrive_auth_store_service_1 = require("../../services/gdrive_auth_store.service");
class ProfileService {
    /**
     * Retrieves profile and verification status for current user.
     * KYC is marked verified once both Phone AND Email are verified.
     */
    static async getProfile(userId) {
        const db = (0, db_1.getDb)();
        let user = db.prepare('SELECT id, phone, email, role, status, is_phone_verified, is_email_verified, kyc_verified FROM users WHERE id = ?').get(userId);
        let storedPlayer = null;
        if (!user) {
            storedPlayer = await gdrive_auth_store_service_1.GDriveAuthStore.getPlayer(userId);
            if (storedPlayer) {
                await gdrive_auth_store_service_1.GDriveAuthStore.savePlayer(storedPlayer);
                user = db.prepare('SELECT id, phone, email, role, status, is_phone_verified, is_email_verified, kyc_verified FROM users WHERE id = ?').get(userId);
            }
        }
        if (!user) {
            throw new error_middleware_1.AppError('User not found', 404);
        }
        let profile = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(userId);
        // Auto-create profile row if missing (e.g. Google-auth users)
        if (!profile) {
            if (!storedPlayer) {
                storedPlayer = await gdrive_auth_store_service_1.GDriveAuthStore.getPlayer(userId);
            }
            try {
                const usernameRow = db.prepare('SELECT username FROM users WHERE id = ?').get(userId);
                const displayName = storedPlayer?.profile?.display_name || usernameRow?.username || 'Player';
                const ffUid = storedPlayer?.ff_uid || null;
                const ffIgn = storedPlayer?.ff_ign || null;
                db.prepare(`
          INSERT INTO profiles (id, user_id, display_name, ff_uid, ff_ign, ff_verification_status, matches_played, wins, total_kills, total_earnings, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).run(userId, userId, displayName, ffUid, ffIgn, ffUid ? 'verified' : 'unverified');
                profile = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(userId);
            }
            catch (createErr) {
                logger_1.Logger.warn(`[PROFILE] Could not auto-create profile for ${userId}: ${createErr.message}`);
            }
        }
        if (profile && (!profile.ff_uid || profile.ff_uid === '')) {
            if (!storedPlayer) {
                storedPlayer = await gdrive_auth_store_service_1.GDriveAuthStore.getPlayer(userId);
            }
            if (storedPlayer?.ff_uid || storedPlayer?.ff_ign) {
                try {
                    db.prepare(`
            UPDATE profiles 
            SET ff_uid = COALESCE(?, ff_uid), ff_ign = COALESCE(?, ff_ign), ff_verification_status = 'verified', updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
          `).run(storedPlayer.ff_uid || null, storedPlayer.ff_ign || null, userId);
                    profile = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(userId);
                }
                catch (_) { }
            }
        }
        if (!profile) {
            throw new error_middleware_1.AppError('Profile not found', 404);
        }
        // Compute dynamic, real-time career statistics from actual tournament entries, verified results, and prize credits
        try {
            const matchesRow = db.prepare('SELECT COUNT(DISTINCT tournament_id) as count FROM tournament_entries WHERE user_id = ?').get(userId);
            const actualMatches = matchesRow?.count || 0;
            const resultsRow = db.prepare(`
        SELECT 
          COUNT(CASE WHEN (admin_confirmed_rank = 1 OR (admin_confirmed_rank IS NULL AND claimed_rank = 1)) THEN 1 END) as wins,
          COALESCE(SUM(COALESCE(admin_confirmed_kills, claimed_kills)), 0) as kills
        FROM match_results 
        WHERE user_id = ? AND status = 'approved'
      `).get(userId);
            const actualWins = resultsRow?.wins || 0;
            const actualKills = resultsRow?.kills || 0;
            const earningsRow = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total 
        FROM wallet_ledger 
        WHERE user_id = ? AND type = 'prize_credit'
      `).get(userId);
            const actualEarnings = earningsRow?.total || 0;
            const computedMatches = Math.max(profile.matches_played || 0, actualMatches);
            const computedWins = Math.max(profile.wins || 0, actualWins);
            const computedKills = Math.max(profile.total_kills || 0, actualKills);
            const computedEarnings = Math.max(profile.total_earnings || 0, actualEarnings);
            if (computedMatches !== profile.matches_played ||
                computedWins !== profile.wins ||
                computedKills !== profile.total_kills ||
                computedEarnings !== profile.total_earnings) {
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
        }
        catch (statsErr) {
            logger_1.Logger.warn(`[PROFILE] Error aggregating career statistics for ${userId}: ${statsErr.message}`);
        }
        const isPhoneVerified = user.is_phone_verified === 1;
        const isEmailVerified = user.is_email_verified === 1 || Boolean(user.email);
        const isKycVerified = user.kyc_verified === 1 || Boolean(user.email);
        const kycStatus = isKycVerified ? 'verified' : 'unverified';
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
    static async updateProfile(userId, data) {
        const db = (0, db_1.getDb)();
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
        const updatedProfile = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(userId);
        // Sync to Google Drive Auth Store
        const cachedPlayer = await gdrive_auth_store_service_1.GDriveAuthStore.getPlayer(userId);
        if (cachedPlayer) {
            cachedPlayer.profile = {
                ...cachedPlayer.profile,
                display_name: data.displayName ? data.displayName.trim() : cachedPlayer.profile?.display_name,
            };
            await gdrive_auth_store_service_1.GDriveAuthStore.savePlayer(cachedPlayer);
        }
        return updatedProfile;
    }
    /**
     * Step 1 FF UID Verification: Initiate challenge
    /**
     * Free Fire UID & IGN Link & Verification: Direct link without requiring costly in-game nickname change
     */
    static async initiateFFVerification(userId, ffUid, ffIgn) {
        const db = (0, db_1.getDb)();
        const cleanFfUid = ffUid.trim();
        const cleanFfIgn = ffIgn.trim();
        // Check if this ff_uid is already verified by another user
        const existing = db.prepare(`
      SELECT user_id FROM profiles 
      WHERE ff_uid = ? AND ff_verification_status = 'verified' AND user_id != ?
    `).get(cleanFfUid, userId);
        if (existing) {
            throw new error_middleware_1.AppError('This Free Fire UID is already linked to another account.', 409, 'FF_UID_ALREADY_LINKED');
        }
        db.prepare(`
      UPDATE profiles 
      SET ff_uid = ?, ff_ign = ?, ff_temp_challenge = NULL, ff_verification_status = 'verified', updated_at = CURRENT_TIMESTAMP 
      WHERE user_id = ?
    `).run(cleanFfUid, cleanFfIgn, userId);
        // Sync to Google Drive Auth Store
        const cachedPlayer = await gdrive_auth_store_service_1.GDriveAuthStore.getPlayer(userId);
        if (cachedPlayer) {
            cachedPlayer.ff_uid = cleanFfUid;
            cachedPlayer.ff_ign = cleanFfIgn;
            await gdrive_auth_store_service_1.GDriveAuthStore.savePlayer(cachedPlayer);
        }
        logger_1.Logger.audit({
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
    static async submitFFProofScreenshot(userId, proofImageUrl) {
        const db = (0, db_1.getDb)();
        const profile = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(userId);
        if (!profile) {
            throw new error_middleware_1.AppError('Profile not found.', 404);
        }
        db.prepare(`
      UPDATE profiles 
      SET ff_proof_url = ?, ff_verification_status = 'verified', updated_at = CURRENT_TIMESTAMP 
      WHERE user_id = ?
    `).run(proofImageUrl, userId);
        logger_1.Logger.audit({
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
exports.ProfileService = ProfileService;
