import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../../database/db';
import { Logger } from '../../utils/logger';
import { AppError } from '../../middleware/error.middleware';
import { MatchResult, AdminResultQueueItem, ResultStatus } from '../../types';
import { NotificationService } from '../scheduler/notification.service';
import { FileCleanupUtil } from '../../utils/file_cleanup.util';
import { GDriveAuthStore } from '../../services/gdrive_auth_store.service';


export interface SubmitResultInput {
  tournamentId: string;
  claimedRank: number;
  claimedKills: number;
  screenshotUrl: string;
}

export interface ReviewResultInput {
  decision: 'approved' | 'rejected';
  confirmedRank?: number;
  confirmedKills?: number;
  rejectionReason?: string;
}

export class ResultsService {
  /**
   * Section 3.4: Player submits match placement rank, kill count, and screenshot proof
   */
  public static async submitResult(userId: string, input: SubmitResultInput): Promise<MatchResult> {
    const { tournamentId, claimedRank, claimedKills, screenshotUrl } = input;
    const db = getDb();

    // 1. Verify player is a confirmed participant in this tournament
    const entry = db.prepare(`
      SELECT id, slot_number, player_ff_uid, player_ff_ign 
      FROM tournament_entries 
      WHERE tournament_id = ? AND user_id = ? AND status = 'confirmed'
    `).get(tournamentId, userId) as any;

    if (!entry) {
      throw new AppError(
        'You must be a confirmed participant in this tournament match to submit results.',
        403,
        'FORBIDDEN_NOT_PARTICIPANT'
      );
    }

    // 2. Verify tournament exists and is eligible for result submissions
    const tournament = db.prepare('SELECT id, title, max_slots, status FROM tournaments WHERE id = ?').get(tournamentId) as any;
    if (!tournament) {
      throw new AppError('Tournament match not found.', 404);
    }

    if (tournament.status === 'cancelled') {
      throw new AppError('Cannot submit results for a cancelled match.', 400);
    }

    // 3. Validate ranks and kills
    if (claimedRank < 1 || claimedRank > tournament.max_slots) {
      throw new AppError(`Claimed rank must be between 1 and ${tournament.max_slots}.`, 400);
    }
    if (claimedKills < 0) {
      throw new AppError('Claimed kills cannot be negative.', 400);
    }

    // 4. Check for duplicate submission by the same user in this tournament
    const existingSubmission = db.prepare(`
      SELECT id, status FROM match_results 
      WHERE tournament_id = ? AND user_id = ?
    `).get(tournamentId, userId) as any;

    if (existingSubmission) {
      throw new AppError(
        `You have already submitted a result claim for this match (Status: ${existingSubmission.status}).`,
        409,
        'ALREADY_SUBMITTED'
      );
    }

    // 5. Insert result submission
    const resultId = uuidv4();
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

    Logger.audit({
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

    return db.prepare('SELECT * FROM match_results WHERE id = ?').get(resultId) as unknown as MatchResult;
  }

  /**
   * Section 3.4: Admin Review Queue to inspect screenshots and verify claims
   */
  public static async getAdminQueue(filters: {
    tournamentId?: string;
    status?: ResultStatus;
    page?: number;
    limit?: number;
  }): Promise<{ queue: AdminResultQueueItem[]; total: number; page: number; limit: number }> {
    const db = getDb();
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
    const params: any[] = [];
    const countParams: any[] = [];

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

    const queue = db.prepare(query).all(...params) as unknown as AdminResultQueueItem[];
    const totalCountRow = db.prepare(countQuery).get(...countParams) as any;

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
  public static async reviewResult(
    adminUserId: string,
    resultId: string,
    input: ReviewResultInput
  ): Promise<MatchResult> {
    const { decision, confirmedRank, confirmedKills, rejectionReason } = input;
    const db = getDb();

    const result = db.prepare('SELECT * FROM match_results WHERE id = ?').get(resultId) as any;
    if (!result) {
      throw new AppError('Match result submission not found.', 404);
    }

    const rankToConfirm = confirmedRank !== undefined ? confirmedRank : result.claimed_rank;
    const killsToConfirm = confirmedKills !== undefined ? confirmedKills : result.claimed_kills;

    db.exec('BEGIN TRANSACTION;');
    try {
      if (decision === 'approved') {
        // Automatically delete the position and kill screenshot proof from server storage
        if (result.screenshot_url) {
          FileCleanupUtil.deleteUploadedFile(result.screenshot_url);
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

        GDriveAuthStore.getPlayer(result.user_id).then((cached) => {
          if (cached && cached.profile) {
            cached.profile.matches_played = (cached.profile.matches_played || 0) + 1;
            cached.profile.wins = (cached.profile.wins || 0) + isWin;
            cached.profile.total_kills = (cached.profile.total_kills || 0) + killsToConfirm;
            GDriveAuthStore.savePlayer(cached).catch(() => {});
          }
        }).catch(() => {});

      } else {
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
    } catch (err) {
      try { db.exec('ROLLBACK;'); } catch (_) {}
      throw err;
    }

    Logger.audit({
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
      NotificationService.sendNotificationToUser(result.user_id, {
        title: 'Match Result Approved! 🏆',
        body: `Your match claim for Rank #${rankToConfirm} with ${killsToConfirm} kills has been approved!`,
        type: 'RESULT_APPROVED',
        data: { tournamentId: result.tournament_id, rank: rankToConfirm, kills: killsToConfirm },
      }).catch((e) => Logger.error(`Failed to send result approval notification: ${e.message}`));
    } else {
      NotificationService.sendNotificationToUser(result.user_id, {
        title: 'Match Result Rejected ⚠️',
        body: `Your match claim was rejected: ${rejectionReason || 'Proof not clear'}`,
        type: 'RESULT_REJECTED',
        data: { tournamentId: result.tournament_id, reason: rejectionReason },
      }).catch((e) => Logger.error(`Failed to send result rejection notification: ${e.message}`));
    }

    return db.prepare('SELECT * FROM match_results WHERE id = ?').get(resultId) as unknown as MatchResult;
  }

  /**
   * Returns player's result submission for a match
   */
  public static async getUserSubmission(userId: string, tournamentId: string): Promise<MatchResult | null> {
    const db = getDb();
    const row = db.prepare(`
      SELECT * FROM match_results 
      WHERE tournament_id = ? AND user_id = ?
    `).get(tournamentId, userId) as any;

    return row ? (row as MatchResult) : null;
  }
}
