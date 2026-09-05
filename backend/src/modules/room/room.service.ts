import { getDb } from '../../database/db';
import { Logger } from '../../utils/logger';
import { AppError } from '../../middleware/error.middleware';
import { NotificationService } from '../scheduler/notification.service';

export interface RoomDetailsResponse {
  tournamentId: string;
  title: string;
  isRevealed: boolean;
  roomId?: string | null;
  roomPassword?: string | null;
  slotNumber?: number | null;
  teamName?: string | null;
  timeRemainingSeconds: number;
  revealTimeRemainingSeconds: number;
  mode: string;
  map: string;
  status: string;
  rules?: string | null;
}

export class RoomService {
  /**
   * Returns match room credentials gated by participant entry & scheduled reveal status
   */
  public static async getRoomDetails(
    tournamentId: string,
    userId: string,
    isAdmin: boolean = false
  ): Promise<RoomDetailsResponse> {
    const db = getDb();
    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId) as any;

    if (!tournament) {
      throw new AppError('Tournament match not found.', 404);
    }

    // Check user's participant entry
    const entry = db.prepare(`
      SELECT slot_number, team_name 
      FROM tournament_entries 
      WHERE tournament_id = ? AND user_id = ? AND status = 'confirmed'
    `).get(tournamentId, userId) as any;

    if (!isAdmin && !entry) {
      throw new AppError(
        'Access denied. You must be a confirmed joined participant to enter this match room.',
        403,
        'FORBIDDEN_NOT_JOINED'
      );
    }

    const now = Date.now();
    const startTimeParsed = new Date(
      tournament.start_time.includes('T') ? tournament.start_time : tournament.start_time.replace(' ', 'T') + 'Z'
    ).getTime();

    const revealThreshold = startTimeParsed - (tournament.room_reveal_time_minutes * 60 * 1000);
    const timeRemainingSeconds = Math.max(0, Math.floor((startTimeParsed - now) / 1000));
    const revealTimeRemainingSeconds = Math.max(0, Math.floor((revealThreshold - now) / 1000));
    const hasRoomCredentials = Boolean(tournament.room_id && tournament.room_id.trim() !== '');
    const isPastRevealTime = revealTimeRemainingSeconds <= 0 && hasRoomCredentials;
    const isRevealed = Boolean(
      tournament.room_revealed === 1 || 
      tournament.room_revealed === true || 
      isPastRevealTime || 
      tournament.status === 'ongoing' || 
      isAdmin
    );

    // If past reveal time but db flag was 0, auto-heal db flag
    if (isPastRevealTime && tournament.room_revealed !== 1) {
      try {
        db.prepare('UPDATE tournaments SET room_revealed = 1, room_revealed_at = CURRENT_TIMESTAMP WHERE id = ?').run(tournament.id);
      } catch (_) {}
    }

    return {
      tournamentId: tournament.id,
      title: tournament.title,
      isRevealed,
      roomId: isRevealed ? tournament.room_id : null,
      roomPassword: isRevealed ? tournament.room_password : null,
      slotNumber: entry ? entry.slot_number : null,
      teamName: entry ? entry.team_name : null,
      timeRemainingSeconds,
      revealTimeRemainingSeconds,
      mode: tournament.mode,
      map: tournament.map,
      status: tournament.status,
      rules: tournament.rules,
    };
  }

  /**
   * Admin-only: Force immediate early reveal of room credentials
   */
  public static async revealRoomNow(tournamentId: string, adminUserId: string): Promise<boolean> {
    const db = getDb();
    const tournament = db.prepare('SELECT id, title, room_id, room_password FROM tournaments WHERE id = ?').get(tournamentId) as any;

    if (!tournament) {
      throw new AppError('Tournament not found.', 404);
    }

    if (!tournament.room_id || tournament.room_id.trim() === '') {
      throw new AppError(
        'Cannot reveal room: Room ID and Password have not been set yet by an admin.',
        400,
        'ROOM_DETAILS_NOT_SET'
      );
    }

    db.prepare(`
      UPDATE tournaments 
      SET room_revealed = 1, 
          room_revealed_at = CURRENT_TIMESTAMP, 
          status = 'open', 
          updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(tournamentId);

    Logger.audit({
      actorId: adminUserId,
      action: 'MANUAL_ROOM_REVEAL',
      targetResource: 'tournaments',
      targetId: tournamentId,
      details: { title: tournament.title, roomId: tournament.room_id },
    });

    const participants = db.prepare(`
      SELECT user_id, player_ff_ign, slot_number 
      FROM tournament_entries 
      WHERE tournament_id = ? AND status = 'confirmed'
    `).all(tournamentId) as any[];

    try {
      await NotificationService.notifyRoomRevealed(
        { id: tournament.id, title: tournament.title, roomId: tournament.room_id, roomPassword: tournament.room_password },
        participants.map((p) => ({
          userId: p.user_id,
          playerIgn: p.player_ff_ign,
          slotNumber: p.slot_number,
        }))
      );
    } catch (err) {
      console.warn('[NOTIFICATIONS] Push notification skipped or failed:', err);
    }

    return true;
  }
}
