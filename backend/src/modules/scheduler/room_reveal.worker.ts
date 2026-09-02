import { getDb } from '../../database/db';
import { Logger } from '../../utils/logger';
import { NotificationService } from './notification.service';

export class RoomRevealWorker {
  private static timer: NodeJS.Timeout | null = null;
  private static isRunning = false;

  /**
   * Evaluates all upcoming tournaments and reveals room credentials when threshold is crossed.
   * Also transitions matches from 'open' -> 'ongoing' once start time arrives.
   */
  public static async checkAndRevealRooms(): Promise<{
    revealedCount: number;
    ongoingCount: number;
    revealedTournaments: string[];
    ongoingTournaments: string[];
  }> {
    const db = getDb();
    let revealedCount = 0;
    let ongoingCount = 0;
    const revealedTournaments: string[] = [];
    const ongoingTournaments: string[] = [];

    const now = Date.now();

    // 1. Fetch unrevealed tournaments with room credentials set
    const candidates = db.prepare(`
      SELECT id, title, room_id, room_password, room_revealed, room_reveal_time_minutes, start_time, status 
      FROM tournaments 
      WHERE status IN ('upcoming', 'open', 'ongoing') AND room_id IS NOT NULL AND room_id != '' AND (room_revealed = 0 OR room_revealed IS NULL)
    `).all() as any[];

    for (const t of candidates) {
      const startTimeParsed = new Date(
        t.start_time.includes('T') ? t.start_time : t.start_time.replace(' ', 'T') + 'Z'
      ).getTime();

      if (isNaN(startTimeParsed)) continue;

      const revealThreshold = startTimeParsed - (t.room_reveal_time_minutes * 60 * 1000);

      // Check if threshold reached
      if (now >= revealThreshold) {
        db.exec('BEGIN TRANSACTION;');
        try {
          db.prepare(`
            UPDATE tournaments 
            SET room_revealed = 1, 
                room_revealed_at = CURRENT_TIMESTAMP,
                status = CASE WHEN status = 'upcoming' THEN 'open' ELSE status END,
                updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
          `).run(t.id);

          db.exec('COMMIT;');
        } catch (err) {
          try { db.exec('ROLLBACK;'); } catch (_) {}
          Logger.error(`Failed to reveal room for tournament ${t.id}`, err);
          continue;
        }

        revealedCount++;
        revealedTournaments.push(t.id);

        Logger.audit({
          action: 'ROOM_CREDENTIALS_REVEALED',
          targetResource: 'tournaments',
          targetId: t.id,
          details: {
            title: t.title,
            revealThresholdMinutes: t.room_reveal_time_minutes,
            roomId: t.room_id,
          },
        });

        // Fetch confirmed participants
        const participants = db.prepare(`
          SELECT user_id, player_ff_ign, slot_number 
          FROM tournament_entries 
          WHERE tournament_id = ? AND status = 'confirmed'
        `).all(t.id) as any[];

        await NotificationService.notifyRoomRevealed(
          { id: t.id, title: t.title, roomId: t.room_id, roomPassword: t.room_password },
          participants.map((p) => ({
            userId: p.user_id,
            playerIgn: p.player_ff_ign,
            slotNumber: p.slot_number,
          }))
        );
      }
    }

    // 2. Transition matches to 'ongoing' once start time arrives
    const upcomingMatches = db.prepare(`
      SELECT id, title, start_time, status 
      FROM tournaments 
      WHERE status IN ('upcoming', 'open')
    `).all() as any[];

    for (const match of upcomingMatches) {
      const matchStart = new Date(
        match.start_time.includes('T') ? match.start_time : match.start_time.replace(' ', 'T') + 'Z'
      ).getTime();

      if (!isNaN(matchStart) && now >= matchStart) {
        db.prepare(`
          UPDATE tournaments 
          SET status = 'ongoing', updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `).run(match.id);

        ongoingCount++;
        ongoingTournaments.push(match.id);

        Logger.audit({
          action: 'TOURNAMENT_STATUS_UPDATED',
          targetResource: 'tournaments',
          targetId: match.id,
          details: { oldStatus: match.status, newStatus: 'ongoing' },
        });
      }
    }

    // 3. Auto-delete completed tournaments
    const completedTournaments = db.prepare(`
      SELECT id, title FROM tournaments WHERE status = 'completed'
    `).all() as any[];

    for (const ct of completedTournaments) {
      try {
        try { db.prepare('DELETE FROM tournament_entries WHERE tournament_id = ?').run(ct.id); } catch (_) {}
        try { db.prepare('DELETE FROM tournament_results WHERE tournament_id = ?').run(ct.id); } catch (_) {}
        try { db.prepare('DELETE FROM payout_distributions WHERE tournament_id = ?').run(ct.id); } catch (_) {}
        db.prepare('DELETE FROM tournaments WHERE id = ?').run(ct.id);

        Logger.info(`[AUTO-CLEANUP] Deleted completed tournament: ${ct.title} (${ct.id})`);
      } catch (err: any) {
        Logger.error(`[AUTO-CLEANUP] Failed to delete completed tournament ${ct.id}: ${err.message}`);
      }
    }

    return {
      revealedCount,
      ongoingCount,
      revealedTournaments,
      ongoingTournaments,
    };
  }

  /**
   * Starts periodic execution loop
   */
  public static start(intervalMs = 30000): void {
    if (this.timer) return;
    this.isRunning = true;
    Logger.info(`⏱️  RoomRevealWorker started (Polling every ${intervalMs / 1000}s)`);

    this.timer = setInterval(async () => {
      try {
        await this.checkAndRevealRooms();
      } catch (err) {
        Logger.error('Error during RoomRevealWorker execution cycle', err);
      }
    }, intervalMs);
  }

  /**
   * Stops background loop
   */
  public static stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.isRunning = false;
      Logger.info('🛑 RoomRevealWorker stopped.');
    }
  }

  public static isWorkerRunning(): boolean {
    return this.isRunning;
  }
}
