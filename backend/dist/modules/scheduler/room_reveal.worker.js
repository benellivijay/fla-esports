"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomRevealWorker = void 0;
const db_1 = require("../../database/db");
const logger_1 = require("../../utils/logger");
const notification_service_1 = require("./notification.service");
class RoomRevealWorker {
    static timer = null;
    static isRunning = false;
    /**
     * Evaluates all upcoming tournaments and reveals room credentials when threshold is crossed.
     * Also transitions matches from 'open' -> 'ongoing' once start time arrives.
     */
    static async checkAndRevealRooms() {
        const db = (0, db_1.getDb)();
        let revealedCount = 0;
        let ongoingCount = 0;
        const revealedTournaments = [];
        const ongoingTournaments = [];
        const now = Date.now();
        // 1. Fetch unrevealed tournaments with room credentials set
        const candidates = db.prepare(`
      SELECT id, title, room_id, room_password, room_revealed, room_reveal_time_minutes, start_time, status 
      FROM tournaments 
      WHERE status IN ('upcoming', 'open', 'ongoing') AND room_id IS NOT NULL AND room_id != '' AND (room_revealed = 0 OR room_revealed IS NULL)
    `).all();
        for (const t of candidates) {
            const startTimeParsed = new Date(t.start_time.includes('T') ? t.start_time : t.start_time.replace(' ', 'T') + 'Z').getTime();
            if (isNaN(startTimeParsed))
                continue;
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
                }
                catch (err) {
                    try {
                        db.exec('ROLLBACK;');
                    }
                    catch (_) { }
                    logger_1.Logger.error(`Failed to reveal room for tournament ${t.id}`, err);
                    continue;
                }
                revealedCount++;
                revealedTournaments.push(t.id);
                logger_1.Logger.audit({
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
        `).all(t.id);
                await notification_service_1.NotificationService.notifyRoomRevealed({ id: t.id, title: t.title, roomId: t.room_id, roomPassword: t.room_password }, participants.map((p) => ({
                    userId: p.user_id,
                    playerIgn: p.player_ff_ign,
                    slotNumber: p.slot_number,
                })));
            }
        }
        // 2. Transition matches to 'ongoing' once start time arrives
        const upcomingMatches = db.prepare(`
      SELECT id, title, start_time, status 
      FROM tournaments 
      WHERE status IN ('upcoming', 'open')
    `).all();
        for (const match of upcomingMatches) {
            const matchStart = new Date(match.start_time.includes('T') ? match.start_time : match.start_time.replace(' ', 'T') + 'Z').getTime();
            if (!isNaN(matchStart) && now >= matchStart) {
                db.prepare(`
          UPDATE tournaments 
          SET status = 'ongoing', updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `).run(match.id);
                ongoingCount++;
                ongoingTournaments.push(match.id);
                logger_1.Logger.audit({
                    action: 'TOURNAMENT_STATUS_UPDATED',
                    targetResource: 'tournaments',
                    targetId: match.id,
                    details: { oldStatus: match.status, newStatus: 'ongoing' },
                });
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
    static start(intervalMs = 30000) {
        if (this.timer)
            return;
        this.isRunning = true;
        logger_1.Logger.info(`⏱️  RoomRevealWorker started (Polling every ${intervalMs / 1000}s)`);
        this.timer = setInterval(async () => {
            try {
                await this.checkAndRevealRooms();
            }
            catch (err) {
                logger_1.Logger.error('Error during RoomRevealWorker execution cycle', err);
            }
        }, intervalMs);
    }
    /**
     * Stops background loop
     */
    static stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
            this.isRunning = false;
            logger_1.Logger.info('🛑 RoomRevealWorker stopped.');
        }
    }
    static isWorkerRunning() {
        return this.isRunning;
    }
}
exports.RoomRevealWorker = RoomRevealWorker;
