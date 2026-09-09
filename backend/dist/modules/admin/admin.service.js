"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminService = void 0;
const uuid_1 = require("uuid");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = require("../../database/db");
const crypto_1 = require("../../utils/crypto");
const logger_1 = require("../../utils/logger");
const error_middleware_1 = require("../../middleware/error.middleware");
const env_1 = require("../../config/env");
const file_cleanup_util_1 = require("../../utils/file_cleanup.util");
const gdrive_tournament_store_service_1 = require("../../services/gdrive_tournament_store.service");
const gdrive_auth_store_service_1 = require("../../services/gdrive_auth_store.service");
class AdminService {
    /**
     * Step 1 Admin Login: Validates email and password, generates temporary 2FA token
     */
    static async adminLogin(email, password) {
        const cleanEmail = email.trim().toLowerCase();
        const db = (0, db_1.getDb)();
        // Built-in hardcoded admin seed registry
        const defaultStaff = {
            'flaadmin01@gmail.com': {
                username: 'flaadmin01',
                phone: '+919342235511',
                password: 'Fla@714367',
                totpSecret: 'FLAADMINAUTHK234',
                displayName: 'FLA Super Admin 01',
                role: 'admin',
            },
            'flaadmin40@gmail.com': {
                username: 'flaadmin40',
                phone: '+919342235510',
                password: 'Fla@714367',
                totpSecret: 'JBSWY3DPEHPK3PXP',
                displayName: 'Super Admin',
                role: 'admin',
            },
            'moderator@ffesports.com': {
                username: 'moderator',
                phone: '+919999999992',
                password: 'ModPassword123!',
                totpSecret: 'JBSWY3DPEHPK3PXP',
                displayName: 'Match Moderator',
                role: 'moderator',
            },
        };
        let user = db.prepare('SELECT * FROM users WHERE LOWER(TRIM(email)) = ? OR LOWER(TRIM(username)) = ?').get(cleanEmail, cleanEmail);
        // If account not in DB but matches seeded staff, insert it dynamically
        if (!user && defaultStaff[cleanEmail]) {
            const seed = defaultStaff[cleanEmail];
            const passHash = crypto_1.CryptoUtil.hashPassword(seed.password);
            const userId = (0, uuid_1.v4)();
            try {
                db.prepare(`
          INSERT INTO users (id, username, email, phone, password_hash, totp_secret, totp_enabled, role, status, is_phone_verified, is_email_verified, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, 1, ?, 'active', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).run(userId, seed.username, cleanEmail, seed.phone, passHash, seed.totpSecret, seed.role);
                db.prepare(`
          INSERT INTO profiles (id, user_id, display_name, ff_verification_status, created_at, updated_at)
          VALUES (?, ?, ?, 'verified', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).run((0, uuid_1.v4)(), userId, seed.displayName);
            }
            catch (_) { }
            user = db.prepare('SELECT * FROM users WHERE LOWER(TRIM(email)) = ?').get(cleanEmail);
        }
        if (!user) {
            throw new error_middleware_1.AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
        }
        if (user.role !== 'admin' && user.role !== 'moderator') {
            throw new error_middleware_1.AppError('Access forbidden. Staff credentials required.', 403, 'FORBIDDEN_STAFF_ONLY');
        }
        if (user.status !== 'active') {
            throw new error_middleware_1.AppError('This staff account has been suspended.', 403, 'ACCOUNT_SUSPENDED');
        }
        // Compare password with hash, with fallback for default staff
        let isMatch = user.password_hash ? crypto_1.CryptoUtil.comparePassword(password, user.password_hash) : false;
        if (!isMatch && defaultStaff[cleanEmail] && password === defaultStaff[cleanEmail].password) {
            // Re-hash and update in DB
            const newHash = crypto_1.CryptoUtil.hashPassword(password);
            try {
                db.prepare("UPDATE users SET password_hash = ?, totp_secret = ?, totp_enabled = 1, role = ?, status = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
                    .run(newHash, defaultStaff[cleanEmail].totpSecret, defaultStaff[cleanEmail].role, user.id);
            }
            catch (_) { }
            isMatch = true;
        }
        if (!isMatch) {
            throw new error_middleware_1.AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
        }
        // Issue short-lived temp token for 2FA verification (valid for 5 minutes)
        const tempToken = jsonwebtoken_1.default.sign({ userId: user.id, email: user.email, role: user.role, type: 'admin_2fa_pending' }, env_1.config.jwt.accessSecret, { expiresIn: '5m' });
        return {
            tempToken,
            totpRequired: true,
            email: user.email,
            role: user.role,
        };
    }
    /**
     * Step 2 Admin Login: Verifies TOTP 2FA code and issues full admin access JWT
     */
    static async verifyTotp2FA(tempToken, totpCode) {
        let payload;
        try {
            payload = jsonwebtoken_1.default.verify(tempToken, env_1.config.jwt.accessSecret);
        }
        catch (_) {
            throw new error_middleware_1.AppError('2FA session expired. Please log in again.', 401, 'INVALID_2FA_SESSION');
        }
        if (payload.type !== 'admin_2fa_pending') {
            throw new error_middleware_1.AppError('Invalid token type for 2FA verification.', 401, 'INVALID_TOKEN');
        }
        const db = (0, db_1.getDb)();
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.userId);
        if (!user || (user.role !== 'admin' && user.role !== 'moderator')) {
            throw new error_middleware_1.AppError('User not found or insufficient privileges.', 403, 'FORBIDDEN');
        }
        // Verify TOTP against stored secret (or default testing secret)
        const defaultSecrets = {
            'flaadmin01@gmail.com': 'FLAADMINAUTHK234',
            'flaadmin40@gmail.com': 'JBSWY3DPEHPK3PXP',
            'moderator@ffesports.com': 'JBSWY3DPEHPK3PXP',
        };
        const secret = user.totp_secret || defaultSecrets[user.email?.toLowerCase()] || 'FLAADMINAUTHK234';
        const isValid = crypto_1.CryptoUtil.verifyTOTP(totpCode, secret);
        if (!isValid) {
            throw new error_middleware_1.AppError('Invalid 2FA code. Please check your authenticator app.', 400, 'INVALID_TOTP');
        }
        // Generate production admin access tokens
        const accessToken = jsonwebtoken_1.default.sign({ userId: user.id, email: user.email, phone: user.phone, role: user.role }, env_1.config.jwt.accessSecret, { expiresIn: env_1.config.jwt.accessExpiresIn });
        const refreshToken = crypto_1.CryptoUtil.generateRefreshTokenString();
        const refreshExpiry = new Date(Date.now() + env_1.config.jwt.refreshExpiresInDays * 24 * 60 * 60 * 1000).toISOString();
        db.prepare(`
      INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run((0, uuid_1.v4)(), user.id, crypto_1.CryptoUtil.hash(refreshToken), refreshExpiry);
        const profile = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(user.id);
        logger_1.Logger.audit({
            actorId: user.id,
            action: 'ADMIN_LOGIN_SUCCESS',
            targetResource: 'admin_auth',
            targetId: user.id,
            details: { email: user.email, role: user.role },
        });
        return {
            accessToken,
            refreshToken,
            user: { id: user.id, email: user.email, role: user.role, status: user.status },
            profile: profile || {
                id: (0, uuid_1.v4)(),
                user_id: user.id,
                display_name: user.email.split('@')[0],
                ff_verification_status: 'verified',
                matches_played: 0,
                wins: 0,
                total_kills: 0,
                total_earnings: 0,
                created_at: new Date(),
                updated_at: new Date(),
            },
        };
    }
    /**
     * Aggregates live operational summary statistics for the admin dashboard home
     */
    static async getDashboardStats() {
        const db = (0, db_1.getDb)();
        const pendingResults = db.prepare("SELECT COUNT(*) as count FROM match_results WHERE status = 'pending_review'").get();
        const disputedResults = db.prepare("SELECT COUNT(*) as count FROM match_results WHERE status = 'disputed'").get();
        // Live / scheduled tournaments today or currently in upcoming/open/ongoing states
        const tournamentsToday = db.prepare(`
      SELECT COUNT(*) as count 
      FROM tournaments 
      WHERE (date(start_time) = date('now') OR status IN ('upcoming', 'open', 'ongoing')) 
        AND status != 'cancelled'
    `).get();
        // Total tournaments (SQLite + GDrive cache fallback)
        const totalTourneysDb = db.prepare("SELECT COUNT(*) as count FROM tournaments WHERE status != 'cancelled'").get();
        let totalTourneysGdrive = 0;
        try {
            const gTourneys = await gdrive_tournament_store_service_1.GDriveTournamentStore.getAllTournaments();
            totalTourneysGdrive = gTourneys.filter((t) => t.status !== 'cancelled').length;
        }
        catch (_) { }
        const totalTournaments = Math.max(totalTourneysDb?.count || 0, totalTourneysGdrive);
        // Total registered users (role 'player' or 'user', excluding admin/moderator)
        const usersCountDb = db.prepare(`
      SELECT COUNT(*) as count 
      FROM users 
      WHERE role IN ('player', 'user') 
         OR (role NOT IN ('admin', 'moderator') AND role IS NOT NULL)
    `).get();
        let gdrivePlayersCount = 0;
        try {
            gdrivePlayersCount = await gdrive_auth_store_service_1.GDriveAuthStore.getPlayersCount();
        }
        catch (_) { }
        const totalUsers = Math.max(usersCountDb?.count || 0, gdrivePlayersCount);
        const pendingWithdrawals = db.prepare("SELECT COUNT(*) as count FROM withdrawal_requests WHERE status = 'pending'").get();
        // Calculate total net wallet liability
        const credits = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM wallet_ledger WHERE type IN ('deposit', 'prize_credit', 'refund')").get();
        const debits = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM wallet_ledger WHERE type IN ('entry_fee_debit', 'withdrawal')").get();
        const totalBalance = Math.max(0, (credits?.total || 0) - (debits?.total || 0));
        let recentLogs = [];
        try {
            recentLogs = db.prepare(`
        SELECT a.*, u.email as actor_email, p.display_name as actor_name
        FROM audit_logs a
        LEFT JOIN users u ON COALESCE(a.actor_id, a.user_id) = u.id
        LEFT JOIN profiles p ON COALESCE(a.actor_id, a.user_id) = p.user_id
        ORDER BY a.created_at DESC LIMIT 6
      `).all();
        }
        catch (_) {
            try {
                recentLogs = db.prepare(`SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 6`).all();
            }
            catch (_) {
                recentLogs = [];
            }
        }
        // APK & Device usage metrics - 100% real-time from device telemetry + push tokens
        let totalApkInstalls = 0;
        let activeApkUsersToday = 0;
        let activeApkUsersWeek = 0;
        let platformBreakdown = [];
        try {
            const installRow = db.prepare("SELECT COUNT(DISTINCT device_id) as count FROM app_installs").get();
            const tokensRow = db.prepare("SELECT COUNT(DISTINCT token) as count FROM device_tokens").get();
            totalApkInstalls = Math.max(installRow?.count ? Number(installRow.count) : 0, tokensRow?.count ? Number(tokensRow.count) : 0);
            const activeTodayRow = db.prepare(`
        SELECT COUNT(DISTINCT COALESCE(user_id, device_id)) as count 
        FROM app_installs 
        WHERE datetime(last_active_at) >= datetime('now', '-24 hours')
      `).get();
            const tokensTodayRow = db.prepare(`
        SELECT COUNT(DISTINCT user_id) as count 
        FROM device_tokens 
        WHERE datetime(updated_at) >= datetime('now', '-24 hours')
      `).get();
            activeApkUsersToday = Math.max(activeTodayRow?.count ? Number(activeTodayRow.count) : 0, tokensTodayRow?.count ? Number(tokensTodayRow.count) : 0);
            const activeWeekRow = db.prepare(`
        SELECT COUNT(DISTINCT COALESCE(user_id, device_id)) as count 
        FROM app_installs 
        WHERE datetime(last_active_at) >= datetime('now', '-7 days')
      `).get();
            const tokensWeekRow = db.prepare(`
        SELECT COUNT(DISTINCT user_id) as count 
        FROM device_tokens 
        WHERE datetime(updated_at) >= datetime('now', '-7 days')
      `).get();
            activeApkUsersWeek = Math.max(activeWeekRow?.count ? Number(activeWeekRow.count) : 0, tokensWeekRow?.count ? Number(tokensWeekRow.count) : 0, activeApkUsersToday);
            const platforms = db.prepare(`
        SELECT platform, COUNT(DISTINCT device_id) as count 
        FROM app_installs 
        GROUP BY platform
      `).all();
            platformBreakdown = platforms.length > 0 ? platforms : [{ platform: 'android', count: totalApkInstalls }];
        }
        catch (_) { }
        return {
            pendingResultReviews: pendingResults?.count || 0,
            tournamentsLiveToday: tournamentsToday?.count || 0,
            totalPlatformBalance: totalBalance,
            disputedResultsCount: disputedResults?.count || 0,
            totalUsers,
            totalTournaments,
            pendingWithdrawalsCount: pendingWithdrawals?.count || 0,
            totalApkInstalls,
            activeApkUsersToday,
            activeApkUsersWeek,
            platformBreakdown,
            recentAuditLogs: recentLogs.map((log) => {
                let details = {};
                if (typeof log.details === 'object' && log.details !== null)
                    details = log.details;
                else if (typeof log.details === 'string') {
                    try {
                        details = JSON.parse(log.details);
                    }
                    catch (_) {
                        details = {};
                    }
                }
                return { ...log, details };
            }),
        };
    }
    /**
     * Records / updates an APK install or device session heartbeat
     */
    static async recordDeviceHeartbeat(data) {
        const db = (0, db_1.getDb)();
        const platform = (data.platform || 'android').toLowerCase();
        const appVersion = data.appVersion || '1.0.0';
        const deviceModel = data.deviceModel || 'Android Device';
        const osVersion = data.osVersion || 'Android';
        const existing = db.prepare('SELECT id FROM app_installs WHERE device_id = ?').get(data.deviceId);
        if (existing) {
            db.prepare(`
        UPDATE app_installs 
        SET 
          user_id = COALESCE(?, user_id),
          platform = ?,
          app_version = ?,
          device_model = ?,
          os_version = ?,
          ip_address = COALESCE(?, ip_address),
          last_active_at = CURRENT_TIMESTAMP
        WHERE device_id = ?
      `).run(data.userId || null, platform, appVersion, deviceModel, osVersion, data.ipAddress || null, data.deviceId);
        }
        else {
            const id = (0, uuid_1.v4)();
            db.prepare(`
        INSERT INTO app_installs (id, device_id, user_id, platform, app_version, device_model, os_version, ip_address, first_installed_at, last_active_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(id, data.deviceId, data.userId || null, platform, appVersion, deviceModel, osVersion, data.ipAddress || null);
        }
    }
    /**
     * Detailed APK & device usage analytics for admin console
     */
    static async getApkUsageStats() {
        const db = (0, db_1.getDb)();
        let totalInstallsCount = 0;
        try {
            const totalInstallsRow = db.prepare("SELECT COUNT(DISTINCT device_id) as count FROM app_installs WHERE platform = 'android'").get();
            totalInstallsCount = totalInstallsRow?.count ? Number(totalInstallsRow.count) : 0;
        }
        catch (_) { }
        const totalApkInstalls = totalInstallsCount;
        const activeTodayRow = db.prepare(`
      SELECT COUNT(DISTINCT COALESCE(user_id, device_id)) as count 
      FROM app_installs 
      WHERE datetime(last_active_at) >= datetime('now', '-24 hours')
    `).get();
        const activeToday = activeTodayRow?.count ? Number(activeTodayRow.count) : 0;
        const activeWeekRow = db.prepare(`
      SELECT COUNT(DISTINCT COALESCE(user_id, device_id)) as count 
      FROM app_installs 
      WHERE datetime(last_active_at) >= datetime('now', '-7 days')
    `).get();
        const activeThisWeek = activeWeekRow?.count ? Number(activeWeekRow.count) : 0;
        const regUsersRow = db.prepare(`
      SELECT COUNT(DISTINCT user_id) as count 
      FROM app_installs 
      WHERE user_id IS NOT NULL
    `).get();
        const totalRegisteredUsersWithApk = regUsersRow?.count ? Number(regUsersRow.count) : 0;
        const platforms = db.prepare(`
      SELECT platform, COUNT(DISTINCT device_id) as count 
      FROM app_installs 
      GROUP BY platform
    `).all();
        const osRows = db.prepare(`
      SELECT os_version as osVersion, COUNT(*) as count 
      FROM app_installs 
      WHERE os_version IS NOT NULL 
      GROUP BY os_version 
      ORDER BY count DESC LIMIT 5
    `).all();
        const recentDevices = db.prepare(`
      SELECT 
        ai.device_id,
        ai.platform,
        ai.app_version,
        ai.device_model,
        ai.os_version,
        ai.first_installed_at,
        ai.last_active_at,
        u.phone,
        u.email,
        p.display_name,
        p.ff_uid,
        p.ff_ign
      FROM app_installs ai
      LEFT JOIN users u ON ai.user_id = u.id
      LEFT JOIN profiles p ON ai.user_id = p.user_id
      ORDER BY ai.last_active_at DESC
      LIMIT 50
    `).all();
        return {
            totalApkInstalls,
            activeToday,
            activeThisWeek,
            totalRegisteredUsersWithApk,
            platformBreakdown: platforms.length > 0 ? platforms : [{ platform: 'android', count: totalApkInstalls }],
            osBreakdown: osRows.length > 0 ? osRows : [{ osVersion: 'Android 14', count: totalApkInstalls }],
            recentDevices,
        };
    }
    /**
     * Result review queue: Lists results with running summary counts
     */
    static async getResultsQueue(tournamentId, statusFilter) {
        const db = (0, db_1.getDb)();
        let query = `
      SELECT r.*, 
             t.title as tournament_title, t.mode as tournament_mode, t.map as tournament_map, t.start_time as tournament_start_time,
             e.slot_number, e.team_name, e.player_ff_uid, e.player_ff_ign,
             u.email as user_email, u.phone as user_phone, p.display_name as player_name
      FROM match_results r
      JOIN tournaments t ON r.tournament_id = t.id
      JOIN tournament_entries e ON r.entry_id = e.id
      JOIN users u ON r.user_id = u.id
      LEFT JOIN profiles p ON r.user_id = p.user_id
      WHERE 1=1
    `;
        const params = [];
        if (tournamentId) {
            query += ' AND r.tournament_id = ?';
            params.push(tournamentId);
        }
        if (statusFilter && statusFilter !== 'all') {
            const dbStatus = statusFilter === 'verified' ? 'approved' : statusFilter;
            query += ' AND r.status = ?';
            params.push(dbStatus);
        }
        query += ' ORDER BY r.created_at DESC';
        const rows = db.prepare(query).all(...params);
        // Calculate running counts
        let countQuery = 'SELECT status, COUNT(*) as count FROM match_results';
        const countParams = [];
        if (tournamentId) {
            countQuery += ' WHERE tournament_id = ?';
            countParams.push(tournamentId);
        }
        countQuery += ' GROUP BY status';
        const countRows = db.prepare(countQuery).all(...countParams);
        const counts = { pending: 0, verified: 0, disputed: 0, rejected: 0, total: 0 };
        for (const row of countRows) {
            if (row.status === 'pending_review')
                counts.pending = row.count;
            else if (row.status === 'approved' || row.status === 'verified')
                counts.verified = row.count;
            else if (row.status === 'disputed')
                counts.disputed = row.count;
            else if (row.status === 'rejected')
                counts.rejected = row.count;
            counts.total += row.count;
        }
        const resultList = rows.map(r => ({
            ...r,
            status: r.status === 'approved' ? 'verified' : r.status,
        }));
        return {
            results: resultList,
            queue: resultList,
            total: resultList.length,
            counts,
        };
    }
    /**
     * Approves and verifies a player's match result claim
     */
    static async verifyResult(adminId, resultId, confirmedRank, confirmedKills) {
        const db = (0, db_1.getDb)();
        const result = db.prepare('SELECT * FROM match_results WHERE id = ?').get(resultId);
        if (!result) {
            throw new error_middleware_1.AppError('Match result claim not found.', 404);
        }
        const rank = confirmedRank !== undefined ? confirmedRank : result.claimed_rank;
        const kills = confirmedKills !== undefined ? confirmedKills : result.claimed_kills;
        // Automatically delete position & kill screenshot proof from server storage upon verification
        if (result.screenshot_url) {
            file_cleanup_util_1.FileCleanupUtil.deleteUploadedFile(result.screenshot_url);
        }
        db.prepare(`
      UPDATE match_results 
      SET status = 'approved', admin_confirmed_rank = ?, admin_confirmed_kills = ?, screenshot_url = '[DELETED_AFTER_APPROVAL]', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(rank, kills, adminId, resultId);
        logger_1.Logger.audit({
            actorId: adminId,
            action: 'RESULT_VERIFIED',
            targetResource: 'match_results',
            targetId: resultId,
            details: {
                tournamentId: result.tournament_id,
                userId: result.user_id,
                previousStatus: result.status,
                newStatus: 'verified',
                confirmedRank: rank,
                confirmedKills: kills,
            },
        });
        return db.prepare('SELECT * FROM match_results WHERE id = ?').get(resultId);
    }
    /**
     * Disputes a player's match result claim with mandatory reason note
     */
    static async disputeResult(adminId, resultId, reasonNote) {
        if (!reasonNote || reasonNote.trim().length === 0) {
            throw new error_middleware_1.AppError('A dispute reason note is mandatory before saving.', 400, 'DISPUTE_REASON_REQUIRED');
        }
        const db = (0, db_1.getDb)();
        const result = db.prepare('SELECT * FROM match_results WHERE id = ?').get(resultId);
        if (!result) {
            throw new error_middleware_1.AppError('Match result claim not found.', 404);
        }
        const cleanReason = reasonNote.trim();
        db.prepare(`
      UPDATE match_results 
      SET status = 'disputed', rejection_reason = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(cleanReason, adminId, resultId);
        logger_1.Logger.audit({
            actorId: adminId,
            action: 'RESULT_DISPUTED',
            targetResource: 'match_results',
            targetId: resultId,
            details: {
                tournamentId: result.tournament_id,
                userId: result.user_id,
                previousStatus: result.status,
                newStatus: 'disputed',
                reasonNote: cleanReason,
            },
        });
        return db.prepare('SELECT * FROM match_results WHERE id = ?').get(resultId);
    }
    /**
     * Payout Run: Generates computed per-player payout breakdown preview before confirmation
     */
    static async getPayoutPreview(tournamentId) {
        const db = (0, db_1.getDb)();
        const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId);
        if (!tournament) {
            throw new error_middleware_1.AppError('Tournament not found.', 404);
        }
        let distribution = [];
        try {
            distribution = JSON.parse(tournament.prize_distribution || '[]');
        }
        catch (_) { }
        const rankPrizeMap = {};
        for (const d of distribution) {
            rankPrizeMap[d.rank] = d.prize;
        }
        const results = db.prepare(`
      SELECT r.*, e.slot_number, e.player_ff_uid, e.player_ff_ign, COALESCE(p.display_name, e.player_ff_ign) as display_name
      FROM match_results r
      JOIN tournament_entries e ON r.entry_id = e.id
      LEFT JOIN profiles p ON r.user_id = p.user_id
      WHERE r.tournament_id = ?
      ORDER BY COALESCE(r.admin_confirmed_rank, r.claimed_rank) ASC
    `).all(tournamentId);
        let unverifiedCount = 0;
        let totalComputedPayout = 0;
        const payoutBreakdown = results.map(r => {
            const isVerified = r.status === 'approved' || r.status === 'verified';
            if (!isVerified)
                unverifiedCount++;
            const finalRank = r.admin_confirmed_rank !== null && r.admin_confirmed_rank !== undefined ? r.admin_confirmed_rank : r.claimed_rank;
            const finalKills = r.admin_confirmed_kills !== null && r.admin_confirmed_kills !== undefined ? r.admin_confirmed_kills : r.claimed_kills;
            const placementPrize = rankPrizeMap[finalRank] || 0;
            const killPrize = finalKills * (tournament.per_kill_prize || 0);
            const totalPayout = placementPrize + killPrize;
            if (isVerified) {
                totalComputedPayout += totalPayout;
            }
            return {
                userId: r.user_id,
                displayName: r.display_name,
                slotNumber: r.slot_number,
                ffUid: r.player_ff_uid,
                ffIgn: r.player_ff_ign,
                rank: finalRank,
                kills: finalKills,
                placementPrize,
                killPrize,
                totalPayout,
                status: isVerified ? 'verified' : r.status,
            };
        });
        return {
            tournament: {
                id: tournament.id,
                title: tournament.title,
                mode: tournament.mode,
                map: tournament.map,
                prizePool: tournament.prize_pool,
                perKillPrize: tournament.per_kill_prize,
                status: tournament.status,
            },
            payoutStatus: tournament.payout_status || 'unpaid',
            totalPrizePool: tournament.prize_pool,
            totalComputedPayout,
            allResultsVerified: unverifiedCount === 0 && results.length > 0,
            unverifiedCount,
            payoutBreakdown,
        };
    }
    /**
     * Payout Run: Executes idempotent payout distribution to user wallets
     */
    static async executePayoutRun(adminId, tournamentId) {
        const db = (0, db_1.getDb)();
        const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId);
        if (!tournament) {
            throw new error_middleware_1.AppError('Tournament not found.', 404);
        }
        // IDEMPOTENCY CHECK: Do not allow re-running payout if already paid
        if (tournament.payout_status === 'paid') {
            throw new error_middleware_1.AppError('Payout for this tournament has already been executed.', 400, 'PAYOUT_ALREADY_EXECUTED');
        }
        const preview = await this.getPayoutPreview(tournamentId);
        // Atomically execute wallet credits and update tournament payout status
        let creditedUsersCount = 0;
        let totalPaid = 0;
        for (const player of preview.payoutBreakdown) {
            if (player.status === 'verified' && player.totalPayout > 0) {
                const ledgerId = (0, uuid_1.v4)();
                db.prepare(`
          INSERT INTO wallet_ledger (id, user_id, type, amount, reference_id, description, created_at)
          VALUES (?, ?, 'prize_credit', ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(ledgerId, player.userId, player.totalPayout, tournamentId, `Tournament Prize Winnings: ${tournament.title} (Rank #${player.rank}, ${player.kills} Kills)`);
                // Update profile career earnings and sync to GDriveAuthStore
                db.prepare(`
          UPDATE profiles 
          SET total_earnings = total_earnings + ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ?
        `).run(player.totalPayout, player.userId);
                gdrive_auth_store_service_1.GDriveAuthStore.getPlayer(player.userId).then((cached) => {
                    if (cached && cached.profile) {
                        cached.profile.total_earnings = (cached.profile.total_earnings || 0) + player.totalPayout;
                        gdrive_auth_store_service_1.GDriveAuthStore.savePlayer(cached).catch(() => { });
                    }
                }).catch(() => { });
                // Create notification
                db.prepare(`
          INSERT INTO notifications (id, user_id, title, body, type, is_read, created_at)
          VALUES (?, ?, ?, ?, 'PRIZE_CREDITED', 0, CURRENT_TIMESTAMP)
        `).run((0, uuid_1.v4)(), player.userId, '🏆 Prize Money Credited!', `You won ₹${player.totalPayout.toFixed(0)} in ${tournament.title}! Balance updated in wallet.`);
                creditedUsersCount++;
                totalPaid += player.totalPayout;
            }
        }
        // Mark tournament payout status as completed and paid (never auto-delete)
        db.prepare(`
      UPDATE tournaments 
      SET status = 'completed', payout_status = 'paid', payout_executed_at = CURRENT_TIMESTAMP, payout_executed_by = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(adminId, tournamentId);
        // Sync updated tournament status to Google Drive
        gdrive_tournament_store_service_1.GDriveTournamentStore.getTournament(tournamentId).then((t) => {
            if (t) {
                t.status = 'completed';
                t.payout_status = 'paid';
                t.payout_executed_at = new Date().toISOString();
                t.payout_executed_by = adminId;
                gdrive_tournament_store_service_1.GDriveTournamentStore.saveTournament(t).catch((e) => logger_1.Logger.warn(`[GDRIVE] Admin payout sync warning: ${e.message}`));
            }
        }).catch(() => { });
        logger_1.Logger.audit({
            actorId: adminId,
            action: 'PAYOUT_RUN_EXECUTED',
            targetResource: 'tournaments',
            targetId: tournamentId,
            details: {
                tournamentTitle: tournament.title,
                totalPaid,
                creditedUsersCount,
            },
        });
        return {
            success: true,
            message: `Payout successfully executed. ₹${totalPaid.toFixed(2)} credited across ${creditedUsersCount} players.`,
            totalPaid,
            creditedUsersCount,
        };
    }
    /**
     * User Management: List users with search, KYC status, and balance
     */
    static async listUsers(search, roleFilter, statusFilter, page = 1, limit = 20) {
        const db = (0, db_1.getDb)();
        const offset = (page - 1) * limit;
        let query = `
      SELECT u.id, u.phone, u.email, u.role, u.status, u.is_phone_verified, u.is_email_verified, u.created_at,
             p.display_name, p.ff_uid, p.ff_ign, p.ff_verification_status, p.total_earnings,
             (SELECT COALESCE(SUM(CASE WHEN type IN ('deposit', 'prize_credit', 'refund') THEN amount ELSE -amount END), 0)
              FROM wallet_ledger WHERE user_id = u.id) as wallet_balance
      FROM users u
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE 1=1
    `;
        const params = [];
        if (search && search.trim().length > 0) {
            const s = `%${search.trim().toLowerCase()}%`;
            query += ' AND (LOWER(u.email) LIKE ? OR u.phone LIKE ? OR LOWER(p.display_name) LIKE ? OR p.ff_uid LIKE ? OR LOWER(p.ff_ign) LIKE ?)';
            params.push(s, s, s, s, s);
        }
        if (roleFilter && roleFilter !== 'all') {
            query += ' AND u.role = ?';
            params.push(roleFilter);
        }
        if (statusFilter && statusFilter !== 'all') {
            query += ' AND u.status = ?';
            params.push(statusFilter);
        }
        const countQuery = query.replace(/SELECT[\s\S]*?FROM users u/i, 'SELECT COUNT(*) as count FROM users u');
        const totalRow = db.prepare(countQuery).get(...params);
        const total = totalRow?.count || 0;
        query += ' ORDER BY u.created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);
        const rows = db.prepare(query).all(...params);
        return {
            users: rows.map(u => ({
                ...u,
                isKycVerified: u.is_phone_verified === 1 && u.is_email_verified === 1,
                walletBalance: Math.max(0, u.wallet_balance || 0),
            })),
            total,
            page,
            limit,
        };
    }
    /**
     * User Management: Updates account status (suspend / reinstate)
     */
    static async updateUserStatus(adminId, targetUserId, newStatus, reason) {
        const db = (0, db_1.getDb)();
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(targetUserId);
        if (!user) {
            throw new error_middleware_1.AppError('User not found.', 404);
        }
        db.prepare('UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStatus, targetUserId);
        logger_1.Logger.audit({
            actorId: adminId,
            action: 'USER_STATUS_UPDATED',
            targetResource: 'users',
            targetId: targetUserId,
            details: { previousStatus: user.status, newStatus, reason: reason || 'Admin action' },
        });
        return db.prepare('SELECT id, phone, email, role, status FROM users WHERE id = ?').get(targetUserId);
    }
    /**
     * User Management: Updates role (Player / Moderator / Admin) - Top-level admin only
     */
    static async updateUserRole(adminId, targetUserId, newRole) {
        const db = (0, db_1.getDb)();
        const caller = db.prepare('SELECT role FROM users WHERE id = ?').get(adminId);
        if (caller?.role !== 'admin') {
            throw new error_middleware_1.AppError('Only super administrators can modify user roles.', 403, 'FORBIDDEN_ADMIN_ONLY');
        }
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(targetUserId);
        if (!user) {
            throw new error_middleware_1.AppError('User not found.', 404);
        }
        db.prepare('UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newRole, targetUserId);
        logger_1.Logger.audit({
            actorId: adminId,
            action: 'USER_ROLE_UPDATED',
            targetResource: 'users',
            targetId: targetUserId,
            details: { previousRole: user.role, newRole },
        });
        return db.prepare('SELECT id, phone, email, role, status FROM users WHERE id = ?').get(targetUserId);
    }
    /**
     * Wallet Adjustment: Retrieves complete passbook ledger for a specific user
     */
    static async getUserLedger(userId) {
        const db = (0, db_1.getDb)();
        const user = db.prepare(`
      SELECT u.id, u.email, u.phone, u.role, u.status, p.display_name, p.ff_uid, p.ff_ign
      FROM users u
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE u.id = ?
    `).get(userId);
        if (!user) {
            throw new error_middleware_1.AppError('User not found.', 404);
        }
        const transactions = db.prepare(`
      SELECT * FROM wallet_ledger 
      WHERE user_id = ? 
      ORDER BY created_at DESC
    `).all(userId);
        const credits = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM wallet_ledger WHERE user_id = ? AND type IN ('deposit', 'prize_credit', 'refund')").get(userId);
        const debits = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM wallet_ledger WHERE user_id = ? AND type IN ('entry_fee_debit', 'withdrawal')").get(userId);
        const balance = Math.max(0, (credits?.total || 0) - (debits?.total || 0));
        return {
            user,
            balance,
            transactions,
        };
    }
    /**
     * Wallet Adjustment: Manual credit/debit adjustment with mandatory reason
     */
    static async adjustUserWallet(adminId, targetUserId, amount, type, reason) {
        if (!reason || reason.trim().length === 0) {
            throw new error_middleware_1.AppError('A reason note is mandatory for all manual wallet adjustments.', 400, 'REASON_REQUIRED');
        }
        if (amount <= 0) {
            throw new error_middleware_1.AppError('Adjustment amount must be greater than zero.', 400, 'INVALID_AMOUNT');
        }
        const db = (0, db_1.getDb)();
        const user = db.prepare('SELECT id FROM users WHERE id = ?').get(targetUserId);
        if (!user) {
            throw new error_middleware_1.AppError('User not found.', 404);
        }
        const cleanReason = reason.trim();
        const ledgerId = (0, uuid_1.v4)();
        db.prepare(`
      INSERT INTO wallet_ledger (id, user_id, type, amount, reference_id, description, created_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(ledgerId, targetUserId, type, amount, `ADJ_${adminId.slice(0, 8)}`, `Manual staff adjustment: ${cleanReason}`);
        logger_1.Logger.audit({
            actorId: adminId,
            action: 'WALLET_MANUALLY_ADJUSTED',
            targetResource: 'wallet_ledger',
            targetId: ledgerId,
            details: {
                targetUserId,
                type,
                amount,
                reason: cleanReason,
            },
        });
        const ledgerSummary = await this.getUserLedger(targetUserId);
        return {
            success: true,
            newBalance: ledgerSummary.balance,
            ledgerId,
        };
    }
    /**
     * Audit Logs: Searchable, filterable, paginated audit log table
     */
    static async getAuditLogs(limit = 50, page = 1, actionFilter, actorId) {
        const db = (0, db_1.getDb)();
        const offset = (page - 1) * limit;
        let query = `
      SELECT a.*, u.email as actor_email, p.display_name as actor_name
      FROM audit_logs a
      LEFT JOIN users u ON a.actor_id = u.id
      LEFT JOIN profiles p ON a.actor_id = p.user_id
      WHERE 1=1
    `;
        const params = [];
        if (actionFilter && actionFilter !== 'all') {
            query += ' AND a.action = ?';
            params.push(actionFilter);
        }
        if (actorId) {
            query += ' AND a.actor_id = ?';
            params.push(actorId);
        }
        const countQuery = query.replace(/SELECT[\s\S]*?FROM audit_logs a/i, 'SELECT COUNT(*) as count FROM audit_logs a');
        const totalRow = db.prepare(countQuery).get(...params);
        const total = totalRow?.count || 0;
        query += ' ORDER BY a.created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);
        const rows = db.prepare(query).all(...params);
        return {
            logs: rows.map(r => {
                let details = {};
                if (typeof r.details === 'object' && r.details !== null)
                    details = r.details;
                else if (typeof r.details === 'string') {
                    try {
                        details = JSON.parse(r.details);
                    }
                    catch (_) {
                        details = {};
                    }
                }
                return { ...r, details };
            }),
            total,
            page,
            limit,
        };
    }
    static async getPendingFFVerifications() {
        const db = (0, db_1.getDb)();
        return db.prepare(`
      SELECT p.*, u.phone, u.email 
      FROM profiles p
      JOIN users u ON p.user_id = u.id
      WHERE p.ff_verification_status = 'pending_review'
      ORDER BY p.updated_at ASC
    `).all();
    }
    static async reviewFFVerification(adminId, userId, approved, rejectionReason) {
        const db = (0, db_1.getDb)();
        const newStatus = approved ? 'verified' : 'rejected';
        db.prepare(`
      UPDATE profiles 
      SET ff_verification_status = ?, ff_verified_at = ${approved ? 'CURRENT_TIMESTAMP' : 'NULL'}, updated_at = CURRENT_TIMESTAMP 
      WHERE user_id = ?
    `).run(newStatus, userId);
        logger_1.Logger.audit({
            actorId: adminId,
            action: 'FF_UID_REVIEWED',
            targetResource: 'profiles',
            targetId: userId,
            details: { approved, rejectionReason },
        });
        return db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(userId);
    }
    static async getPendingKYCSubmissions() {
        const db = (0, db_1.getDb)();
        return db.prepare(`
      SELECT k.*, u.phone, u.email 
      FROM kyc_records k
      JOIN users u ON k.user_id = u.id
      WHERE k.status = 'pending'
      ORDER BY k.created_at ASC
    `).all();
    }
    static async reviewKYC(adminId, kycId, approved, rejectionReason) {
        const db = (0, db_1.getDb)();
        const newStatus = approved ? 'verified' : 'rejected';
        db.prepare(`
      UPDATE kyc_records 
      SET status = ?, rejection_reason = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(newStatus, rejectionReason || null, adminId, kycId);
        logger_1.Logger.audit({
            actorId: adminId,
            action: 'KYC_REVIEWED',
            targetResource: 'kyc_records',
            targetId: kycId,
            details: { approved, rejectionReason },
        });
        return db.prepare('SELECT * FROM kyc_records WHERE id = ?').get(kycId);
    }
    /**
     * ==========================================
     * Staff & Dedicated Authenticator Management
     * ==========================================
     */
    /**
     * List all admin and moderator staff accounts
     */
    static async listStaffUsers() {
        const db = (0, db_1.getDb)();
        const rows = db.prepare(`
      SELECT 
        u.id, 
        u.username, 
        u.email, 
        u.phone, 
        u.role, 
        u.status, 
        u.totp_secret, 
        u.totp_enabled, 
        u.created_at, 
        u.updated_at,
        p.display_name
      FROM users u
      LEFT JOIN profiles p ON p.user_id = u.id
      WHERE u.role IN ('admin', 'moderator')
      ORDER BY u.created_at DESC
    `).all();
        return rows.map((r) => {
            const secret = r.totp_secret || 'FLAADMINAUTHK234';
            const otpauthUri = `otpauth://totp/FLA%20Esports:${encodeURIComponent(r.email || r.username)}?secret=${secret}&issuer=FLA%20Esports&algorithm=SHA1&digits=6&period=30`;
            return {
                ...r,
                totpSecret: secret,
                otpauthUri,
            };
        });
    }
    /**
     * Create a new Staff (Admin / Moderator) account with a dedicated Authenticator
     */
    static async createStaffUser(adminId, data) {
        const cleanEmail = data.email.trim().toLowerCase();
        const cleanUsername = data.username ? data.username.trim() : cleanEmail.split('@')[0];
        const role = data.role === 'admin' ? 'admin' : 'moderator';
        const displayName = data.displayName?.trim() || cleanUsername;
        const db = (0, db_1.getDb)();
        // Check email uniqueness
        const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = ? OR LOWER(username) = ?').get(cleanEmail, cleanUsername.toLowerCase());
        if (existing) {
            throw new error_middleware_1.AppError('An account with this email or username already exists.', 409, 'STAFF_EXISTS');
        }
        const userId = (0, uuid_1.v4)();
        const passHash = crypto_1.CryptoUtil.hashPassword(data.password);
        // Use provided secret or generate a random 16-character Base32 secret key
        const secret = data.totpSecret?.trim().toUpperCase() || crypto_1.CryptoUtil.generateTOTPSecret();
        db.prepare(`
      INSERT INTO users (
        id, username, email, password_hash, totp_secret, totp_enabled, role, status, is_email_verified, is_phone_verified, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, 1, ?, 'active', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `).run(userId, cleanUsername, cleanEmail, passHash, secret, role);
        db.prepare(`
      INSERT INTO profiles (
        id, user_id, display_name, ff_verification_status, created_at, updated_at
      ) VALUES (
        ?, ?, ?, 'verified', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `).run((0, uuid_1.v4)(), userId, displayName);
        const otpauthUri = `otpauth://totp/FLA%20Esports:${encodeURIComponent(cleanEmail)}?secret=${secret}&issuer=FLA%20Esports&algorithm=SHA1&digits=6&period=30`;
        logger_1.Logger.audit({
            actorId: adminId,
            action: 'STAFF_ACCOUNT_CREATED',
            targetResource: 'users',
            targetId: userId,
            details: { email: cleanEmail, username: cleanUsername, role },
        });
        return {
            id: userId,
            username: cleanUsername,
            email: cleanEmail,
            role,
            status: 'active',
            displayName,
            totpSecret: secret,
            otpauthUri,
            createdAt: new Date().toISOString(),
        };
    }
    /**
     * Update staff account (role, status, password, or display name)
     */
    static async updateStaffUser(adminId, targetId, data) {
        const db = (0, db_1.getDb)();
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId);
        if (!user) {
            throw new error_middleware_1.AppError('Staff member not found.', 404);
        }
        if (data.role) {
            db.prepare('UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(data.role, targetId);
        }
        if (data.status) {
            db.prepare('UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(data.status, targetId);
        }
        if (data.password && data.password.trim().length >= 6) {
            const newHash = crypto_1.CryptoUtil.hashPassword(data.password.trim());
            db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newHash, targetId);
        }
        if (data.displayName) {
            db.prepare('UPDATE profiles SET display_name = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?').run(data.displayName.trim(), targetId);
        }
        logger_1.Logger.audit({
            actorId: adminId,
            action: 'STAFF_ACCOUNT_UPDATED',
            targetResource: 'users',
            targetId: targetId,
            details: { role: data.role, status: data.status, passwordUpdated: Boolean(data.password) },
        });
        return db.prepare(`
      SELECT u.id, u.username, u.email, u.role, u.status, u.totp_secret, p.display_name, u.updated_at
      FROM users u
      LEFT JOIN profiles p ON p.user_id = u.id
      WHERE u.id = ?
    `).get(targetId);
    }
    /**
     * Regenerate a new dedicated TOTP Authenticator key for a staff member
     */
    static async regenerateStaffTotp(adminId, targetId) {
        const db = (0, db_1.getDb)();
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId);
        if (!user) {
            throw new error_middleware_1.AppError('Staff member not found.', 404);
        }
        const newSecret = crypto_1.CryptoUtil.generateTOTPSecret();
        db.prepare('UPDATE users SET totp_secret = ?, totp_enabled = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newSecret, targetId);
        const otpauthUri = `otpauth://totp/FLA%20Esports:${encodeURIComponent(user.email || user.username)}?secret=${newSecret}&issuer=FLA%20Esports&algorithm=SHA1&digits=6&period=30`;
        logger_1.Logger.audit({
            actorId: adminId,
            action: 'STAFF_2FA_REGENERATED',
            targetResource: 'users',
            targetId: targetId,
            details: { email: user.email },
        });
        return {
            id: targetId,
            email: user.email,
            totpSecret: newSecret,
            otpauthUri,
        };
    }
    /**
     * Delete or revoke a staff account
     */
    static async deleteStaffUser(adminId, targetId) {
        if (adminId === targetId) {
            throw new error_middleware_1.AppError('You cannot delete your own admin account.', 400);
        }
        const db = (0, db_1.getDb)();
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId);
        if (!user) {
            throw new error_middleware_1.AppError('Staff member not found.', 404);
        }
        db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
        db.prepare('DELETE FROM profiles WHERE user_id = ?').run(targetId);
        logger_1.Logger.audit({
            actorId: adminId,
            action: 'STAFF_ACCOUNT_DELETED',
            targetResource: 'users',
            targetId: targetId,
            details: { email: user.email },
        });
        return true;
    }
}
exports.AdminService = AdminService;
