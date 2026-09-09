"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResultsService = void 0;
const uuid_1 = require("uuid");
const db_1 = require("../../database/db");
const logger_1 = require("../../utils/logger");
const error_middleware_1 = require("../../middleware/error.middleware");
const notification_service_1 = require("../scheduler/notification.service");
const file_cleanup_util_1 = require("../../utils/file_cleanup.util");
const gdrive_auth_store_service_1 = require("../../services/gdrive_auth_store.service");
class ResultsService {
    /**
     * Section 3.4: Player submits match placement rank, kill count, and screenshot proof
     */
    static async submitResult(userId, input) {
        const { tournamentId, claimedRank, claimedKills, screenshotUrl } = input;
        const db = (0, db_1.getDb)();
        // 1. Verify player is a confirmed participant in this tournament
        const entry = db.prepare(`
      SELECT id, slot_number, player_ff_uid, player_ff_ign 
      FROM tournament_entries 
      WHERE tournament_id = ? AND user_id = ? AND status = 'confirmed'
    `).get(tournamentId, userId);
        if (!entry) {
            throw new error_middleware_1.AppError('You must be a confirmed participant in this tournament match to submit results.', 403, 'FORBIDDEN_NOT_PARTICIPANT');
        }
        // 2. Verify tournament exists and is eligible for result submissions
        const tournament = db.prepare('SELECT id, title, max_slots, status FROM tournaments WHERE id = ?').get(tournamentId);
        if (!tournament) {
            throw new error_middleware_1.AppError('Tournament match not found.', 404);
        }
        if (tournament.status === 'cancelled') {
            throw new error_middleware_1.AppError('Cannot submit results for a cancelled match.', 400);
        }
        // 3. Validate ranks and kills
        if (claimedRank < 1 || claimedRank > tournament.max_slots) {
            throw new error_middleware_1.AppError(`Claimed rank must be between 1 and ${tournament.max_slots}.`, 400);
        }
        if (claimedKills < 0) {
            throw new error_middleware_1.AppError('Claimed kills cannot be negative.', 400);
        }
        // 4. Check for duplicate submission by the same user in this tournament
        const existingSubmission = db.prepare(`
      SELECT id, status FROM match_results 
      WHERE tournament_id = ? AND user_id = ?
    `).get(tournamentId, userId);
        if (existingSubmission) {
            throw new error_middleware_1.AppError(`You have already submitted a result claim for this match (Status: ${existingSubmission.status}).`, 409, 'ALREADY_SUBMITTED');
        }
        // 5. Insert result submission
        const resultId = (0, uuid_1.v4)();
        db.prepare(`
      INSERT INTO match_results (
        id, tournament_id, entry_id, user_id, 
        claimed_rank, claimed_kills, screenshot_url, 
        status, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, 
        ?, ?, ?, 
        'pending_review', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `).run(resultId, tournamentId, entry.id, userId, claimedRank, claimedKills, screenshotUrl);
        logger_1.Logger.audit({
            actorId: userId,
            action: 'RESULT_SUBMITTED',
            targetResource: 'match_results',
            targetId: resultId,
            details: {
                tournamentId,
                claimedRank,
                claimedKills,
                screenshotUrl,
            },
        });
        return db.prepare('SELECT * FROM match_results WHERE id = ?').get(resultId);
    }
    /**
     * Section 3.4: Admin Review Queue to inspect screenshots and verify claims
     */
    static async getAdminQueue(filters) {
        const db = (0, db_1.getDb)();
        const page = filters.page || 1;
        const limit = filters.limit || 20;
        const offset = (page - 1) * limit;
        let query = `
      SELECT 
        r.*,
        t.title AS tournament_title,
        t.mode AS tournament_mode,
        t.map AS tournament_map,
        e.slot_number,
        p.display_name AS player_display_name,
        p.ff_uid AS player_ff_uid,
        p.ff_ign AS player_ff_ign
      FROM match_results r
      JOIN tournaments t ON t.id = r.tournament_id
      JOIN tournament_entries e ON e.id = r.entry_id
      JOIN profiles p ON p.user_id = r.user_id
      WHERE 1=1
    `;
        let countQuery = 'SELECT COUNT(*) as count FROM match_results r WHERE 1=1';
        const params = [];
        const countParams = [];
        if (filters.tournamentId) {
            query += ' AND r.tournament_id = ?';
            countQuery += ' AND r.tournament_id = ?';
            params.push(filters.tournamentId);
            countParams.push(filters.tournamentId);
        }
        if (filters.status) {
            query += ' AND r.status = ?';
            countQuery += ' AND r.status = ?';
            params.push(filters.status);
            countParams.push(filters.status);
        }
        query += ' ORDER BY r.created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);
        const queue = db.prepare(query).all(...params);
        const totalCountRow = db.prepare(countQuery).get(...countParams);
        return {
            queue,
            total: totalCountRow?.count || 0,
            page,
            limit,
        };
    }
    /**
     * Section 3.4: Admin approves or rejects match result and synchronizes player stats
     */
    static async reviewResult(adminUserId, resultId, input) {
        const { decision, confirmedRank, confirmedKills, rejectionReason } = input;
        const db = (0, db_1.getDb)();
        const result = db.prepare('SELECT * FROM match_results WHERE id = ?').get(resultId);
        if (!result) {
            throw new error_middleware_1.AppError('Match result submission not found.', 404);
        }
        const rankToConfirm = confirmedRank !== undefined ? confirmedRank : result.claimed_rank;
        const killsToConfirm = confirmedKills !== undefined ? confirmedKills : result.claimed_kills;
        db.exec('BEGIN TRANSACTION;');
        try {
            if (decision === 'approved') {
                // Automatically delete the position and kill screenshot proof from server storage
                if (result.screenshot_url) {
                    file_cleanup_util_1.FileCleanupUtil.deleteUploadedFile(result.screenshot_url);
                }
                db.prepare(`
          UPDATE match_results 
          SET status = 'approved',
              admin_confirmed_rank = ?,
              admin_confirmed_kills = ?,
              screenshot_url = '[DELETED_AFTER_APPROVAL]',
              rejection_reason = NULL,
              reviewed_by = ?,
              reviewed_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(rankToConfirm, killsToConfirm, adminUserId, resultId);
                // Synchronize player profile statistics
                const isWin = rankToConfirm === 1 ? 1 : 0;
                db.prepare(`
          UPDATE profiles 
          SET matches_played = matches_played + 1,
              wins = wins + ?,
              total_kills = total_kills + ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ?
        `).run(isWin, killsToConfirm, result.user_id);
                gdrive_auth_store_service_1.GDriveAuthStore.getPlayer(result.user_id).then((cached) => {
                    if (cached && cached.profile) {
                        cached.profile.matches_played = (cached.profile.matches_played || 0) + 1;
                        cached.profile.wins = (cached.profile.wins || 0) + isWin;
                        cached.profile.total_kills = (cached.profile.total_kills || 0) + killsToConfirm;
                        gdrive_auth_store_service_1.GDriveAuthStore.savePlayer(cached).catch(() => { });
                    }
                }).catch(() => { });
            }
            else {
                db.prepare(`
          UPDATE match_results 
          SET status = 'rejected',
              rejection_reason = ?,
              reviewed_by = ?,
              reviewed_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(rejectionReason || 'Screenshot proof rejected by moderator.', adminUserId, resultId);
            }
            db.exec('COMMIT;');
        }
        catch (err) {
            try {
                db.exec('ROLLBACK;');
            }
            catch (_) { }
            throw err;
        }
        logger_1.Logger.audit({
            actorId: adminUserId,
            action: 'RESULT_REVIEWED',
            targetResource: 'match_results',
            targetId: resultId,
            details: {
                decision,
                confirmedRank: rankToConfirm,
                confirmedKills: killsToConfirm,
                rejectionReason,
            },
        });
        if (decision === 'approved') {
            notification_service_1.NotificationService.sendNotificationToUser(result.user_id, {
                title: 'Match Result Approved! 🏆',
                body: `Your match claim for Rank #${rankToConfirm} with ${killsToConfirm} kills has been approved!`,
                type: 'RESULT_APPROVED',
                data: { tournamentId: result.tournament_id, rank: rankToConfirm, kills: killsToConfirm },
            }).catch((e) => logger_1.Logger.error(`Failed to send result approval notification: ${e.message}`));
        }
        else {
            notification_service_1.NotificationService.sendNotificationToUser(result.user_id, {
                title: 'Match Result Rejected ⚠️',
                body: `Your match claim was rejected: ${rejectionReason || 'Proof not clear'}`,
                type: 'RESULT_REJECTED',
                data: { tournamentId: result.tournament_id, reason: rejectionReason },
            }).catch((e) => logger_1.Logger.error(`Failed to send result rejection notification: ${e.message}`));
        }
        return db.prepare('SELECT * FROM match_results WHERE id = ?').get(resultId);
    }
    /**
     * Returns player's result submission for a match
     */
    static async getUserSubmission(userId, tournamentId) {
        const db = (0, db_1.getDb)();
        const row = db.prepare(`
      SELECT * FROM match_results 
      WHERE tournament_id = ? AND user_id = ?
    `).get(tournamentId, userId);
        return row ? row : null;
    }
}
exports.ResultsService = ResultsService;
