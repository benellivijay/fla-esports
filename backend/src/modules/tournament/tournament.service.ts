import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../../database/db';
import { Logger } from '../../utils/logger';
import { AppError } from '../../middleware/error.middleware';
import { Tournament, TournamentMode, GameMode, TournamentMap, EntryType, TournamentStatus, PrizeDistributionItem } from '../../types';
import { NotificationService } from '../scheduler/notification.service';
import { GDriveTournamentStore } from '../../services/gdrive_tournament_store.service';

export interface CreateTournamentDTO {
  title: string;
  description?: string;
  game?: string;
  game_mode?: GameMode;
  gameMode?: GameMode;
  mode: TournamentMode;
  map: TournamentMap;
  entryType: EntryType;
  entryFee?: number;
  prizePool: number;
  prizeDistribution: PrizeDistributionItem[];
  perKillPrize?: number;
  maxSlots: number;
  startTime: string;
  registrationClosesAt?: string;
  roomRevealTimeMinutes?: number;
  roomId?: string;
  roomPassword?: string;
  bannerUrl?: string;
  rules?: string;
}

export interface UpdateTournamentDTO {
  title?: string;
  description?: string;
  game_mode?: GameMode;
  gameMode?: GameMode;
  mode?: TournamentMode;
  map?: TournamentMap;
  entryType?: EntryType;
  entryFee?: number;
  prizePool?: number;
  prizeDistribution?: PrizeDistributionItem[];
  perKillPrize?: number;
  maxSlots?: number;
  startTime?: string;
  registrationClosesAt?: string;
  roomRevealTimeMinutes?: number;
  roomId?: string;
  roomPassword?: string;
  status?: TournamentStatus;
  bannerUrl?: string;
  rules?: string;
}

export interface TournamentFilters {
  game?: string;
  game_mode?: string;
  gameMode?: string;
  mode?: string;
  map?: string;
  entryType?: string;
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export class TournamentService {
  /**
   * Admin: Creates a new tournament
   */
  public static async createTournament(adminId: string, data: CreateTournamentDTO): Promise<Tournament> {
    const db = getDb();
    const tournamentId = uuidv4();

    const startDate = new Date(data.startTime);
    if (isNaN(startDate.getTime())) {
      throw new AppError('Invalid start time format (ISO date string expected).', 400);
    }

    if (data.entryType === 'paid' && (!data.entryFee || data.entryFee <= 0)) {
      throw new AppError('Paid tournaments must have an entry fee greater than 0.', 400);
    }

    if (data.prizePool < 0) {
      throw new AppError('Prize pool cannot be negative.', 400);
    }

    if (data.maxSlots <= 0 || data.maxSlots > 100) {
      throw new AppError('Max slots must be between 1 and 100.', 400);
    }

    let finalMaxSlots = data.maxSlots;
    if (data.mode === 'squad' && finalMaxSlots <= 12) {
      finalMaxSlots = finalMaxSlots * 4; // 12 squad teams = 48 player slots
    } else if (data.mode === 'duo' && finalMaxSlots <= 24) {
      finalMaxSlots = finalMaxSlots * 2; // 24 duos = 48 player slots
    }

    const prizeDistributionJson = JSON.stringify(data.prizeDistribution || []);
    const gameMode = data.game_mode || data.gameMode || 'survival';

    const stmt = db.prepare(`
      INSERT INTO tournaments (
        id, title, description, game, game_mode, mode, map, entry_type, entry_fee, 
        prize_pool, prize_distribution, per_kill_prize, max_slots, filled_slots, 
        start_time, registration_closes_at, room_reveal_time_minutes, 
        room_id, room_password, room_revealed, status, banner_url, rules, 
        created_by, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, 
        ?, ?, ?, ?, 0, 
        ?, ?, ?, 
        ?, ?, 0, 'upcoming', ?, ?, 
        ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `);

    stmt.run(
      tournamentId,
      data.title.trim(),
      data.description || null,
      data.game || 'Free Fire',
      gameMode,
      data.mode,
      data.map,
      data.entryType,
      data.entryFee || 0.0,
      data.prizePool,
      prizeDistributionJson,
      data.perKillPrize || 0.0,
      finalMaxSlots,
      startDate.toISOString(),
      data.registrationClosesAt || null,
      data.roomRevealTimeMinutes || 15,
      data.roomId || null,
      data.roomPassword || null,
      data.bannerUrl || null,
      data.rules || null,
      adminId
    );

    Logger.audit({
      actorId: adminId,
      action: 'TOURNAMENT_CREATED',
      targetResource: 'tournaments',
      targetId: tournamentId,
      details: { title: data.title, gameMode, mode: data.mode, map: data.map, entryType: data.entryType, prizePool: data.prizePool },
    });

    const created = await this.getTournamentById(tournamentId, 'admin');

    // Persist to Google Drive Cloud Storage
    GDriveTournamentStore.saveTournament(created as any).catch((e) =>
      Logger.warn(`[GDRIVE] Save new tournament warning: ${e.message}`)
    );

    // Broadcast new tournament notification to all registered players
    try {
      await NotificationService.broadcastNewTournamentNotification(created);
    } catch (notifErr) {
      Logger.error('Failed to broadcast tournament creation notification', notifErr);
    }

    return created;
  }

  /**
   * Admin: Updates an existing tournament
   */
  public static async updateTournament(adminId: string, tournamentId: string, data: UpdateTournamentDTO): Promise<Tournament> {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId) as any;

    if (!existing) {
      throw new AppError('Tournament not found.', 404);
    }

    if (existing.status === 'completed' || existing.status === 'cancelled') {
      throw new AppError(`Cannot modify a tournament that is ${existing.status}.`, 400);
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (data.title !== undefined) { updates.push('title = ?'); values.push(data.title.trim()); }
    if (data.description !== undefined) { updates.push('description = ?'); values.push(data.description); }
    const gameMode = data.game_mode || data.gameMode;
    if (gameMode !== undefined) { updates.push('game_mode = ?'); values.push(gameMode); }
    if (data.mode !== undefined) { updates.push('mode = ?'); values.push(data.mode); }
    if (data.map !== undefined) { updates.push('map = ?'); values.push(data.map); }
    if (data.entryType !== undefined) { updates.push('entry_type = ?'); values.push(data.entryType); }
    if (data.entryFee !== undefined) { updates.push('entry_fee = ?'); values.push(data.entryFee); }
    if (data.prizePool !== undefined) { updates.push('prize_pool = ?'); values.push(data.prizePool); }
    if (data.prizeDistribution !== undefined) { updates.push('prize_distribution = ?'); values.push(JSON.stringify(data.prizeDistribution)); }
    if (data.perKillPrize !== undefined) { updates.push('per_kill_prize = ?'); values.push(data.perKillPrize); }
    if (data.maxSlots !== undefined) { updates.push('max_slots = ?'); values.push(data.maxSlots); }
    if (data.startTime !== undefined) {
      const parsedStart = new Date(data.startTime);
      if (isNaN(parsedStart.getTime())) {
        throw new AppError('Invalid start time format (ISO date string expected).', 400);
      }
      updates.push('start_time = ?');
      values.push(parsedStart.toISOString());
    }
    if (data.registrationClosesAt !== undefined) { updates.push('registration_closes_at = ?'); values.push(data.registrationClosesAt); }
    if (data.roomRevealTimeMinutes !== undefined) { updates.push('room_reveal_time_minutes = ?'); values.push(data.roomRevealTimeMinutes); }
    if (data.roomId !== undefined) { updates.push('room_id = ?'); values.push(data.roomId); }
    if (data.roomPassword !== undefined) { updates.push('room_password = ?'); values.push(data.roomPassword); }
    if (data.status !== undefined) { updates.push('status = ?'); values.push(data.status); }
    if (data.bannerUrl !== undefined) { updates.push('banner_url = ?'); values.push(data.bannerUrl); }
    if (data.rules !== undefined) { updates.push('rules = ?'); values.push(data.rules); }

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(tournamentId);

      const sql = `UPDATE tournaments SET ${updates.join(', ')} WHERE id = ?`;
      db.prepare(sql).run(...values);

      Logger.audit({
        actorId: adminId,
        action: 'TOURNAMENT_UPDATED',
        targetResource: 'tournaments',
        targetId: tournamentId,
        details: data,
      });
    }

    const updated = await this.getTournamentById(tournamentId, 'admin');

    // Persist changes to Google Drive
    GDriveTournamentStore.saveTournament(updated as any).catch((e) =>
      Logger.warn(`[GDRIVE] Save updated tournament warning: ${e.message}`)
    );

    return updated;
  }

  /**
   * Admin: Sets or updates in-game custom room credentials independently at any time before start
   */
  public static async updateRoomCredentials(
    adminId: string, 
    tournamentId: string, 
    credentials: { roomId: string; roomPassword?: string; forceUpdateAfterStart?: boolean }
  ): Promise<Tournament> {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId) as any;

    if (!existing) {
      throw new AppError('Tournament not found.', 404);
    }

    if (!credentials.roomId || credentials.roomId.trim() === '') {
      throw new AppError('Room ID cannot be empty.', 400, 'INVALID_ROOM_ID');
    }

    const now = Date.now();
    const startTimeParsed = new Date(
      existing.start_time.includes('T') ? existing.start_time : existing.start_time.replace(' ', 'T') + 'Z'
    ).getTime();

    const isMatchStarted = (!isNaN(startTimeParsed) && now >= startTimeParsed) || ['ongoing', 'completed'].includes(existing.status);
    const isRoomRevealed = existing.room_revealed === 1 || existing.room_revealed === true;

    // Validation: Block room updates once match started and room is revealed, unless force flag is passed
    if (isMatchStarted && isRoomRevealed && !credentials.forceUpdateAfterStart) {
      throw new AppError(
        'Match has already started and room was revealed. To force update (e.g. for lobby recreation), pass forceUpdateAfterStart: true.',
        400,
        'MATCH_ALREADY_STARTED'
      );
    }

    const newRoomId = credentials.roomId.trim();
    const newRoomPass = credentials.roomPassword !== undefined ? (credentials.roomPassword?.trim() || null) : existing.room_password;

    const revealThreshold = startTimeParsed - (existing.room_reveal_time_minutes * 60 * 1000);
    const shouldRevealNow = Boolean(
      newRoomId && (
        isRoomRevealed ||
        isMatchStarted ||
        existing.status === 'ongoing' ||
        now >= revealThreshold
      )
    );

    const finalRoomRevealed = shouldRevealNow ? 1 : (existing.room_revealed === 1 ? 1 : 0);

    db.prepare(`
      UPDATE tournaments 
      SET room_id = ?, 
          room_password = ?, 
          room_revealed = ?,
          room_revealed_at = CASE WHEN room_revealed_at IS NULL AND ? = 1 THEN CURRENT_TIMESTAMP ELSE room_revealed_at END,
          room_updated_at = CURRENT_TIMESTAMP, 
          room_updated_by = ?,
          updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(newRoomId, newRoomPass, finalRoomRevealed, finalRoomRevealed, adminId, tournamentId);

    Logger.audit({
      actorId: adminId,
      action: 'ROOM_CREDENTIALS_UPDATED',
      targetResource: 'tournaments',
      targetId: tournamentId,
      details: { 
        roomId: newRoomId,
        isAfterReveal: isRoomRevealed,
        isAfterStart: isMatchStarted,
        forceUpdate: !!credentials.forceUpdateAfterStart,
        revealedNow: shouldRevealNow,
      },
    });

    // Send instant notification alert to confirmed participants
    if (shouldRevealNow) {
      const participants = db.prepare(`
        SELECT user_id, player_ff_ign, slot_number 
        FROM tournament_entries 
        WHERE tournament_id = ? AND status = 'confirmed'
      `).all(tournamentId) as any[];

      for (const p of participants) {
        NotificationService.sendNotificationToUser(p.user_id, {
          title: '🔑 Room Credentials Unlocked!',
          body: `Room ID: ${newRoomId} | Password: ${newRoomPass || 'None'} | Your Slot: #${p.slot_number}`,
          type: 'ROOM_REVEALED',
          data: { tournamentId, roomId: newRoomId, password: newRoomPass, slotNumber: p.slot_number },
        }).catch((e) => Logger.error(`Failed to notify room update: ${e.message}`));
      }
    }

    const updated = await this.getTournamentById(tournamentId, 'admin');
    GDriveTournamentStore.saveTournament(updated as any).catch((e) =>
      Logger.warn(`[GDRIVE] Save room credentials warning: ${e.message}`)
    );

    return updated;
  }

  /**
   * Admin: Cancels tournament
   */
  public static async cancelTournament(adminId: string, tournamentId: string, reason?: string): Promise<void> {
    const db = getDb();
    const existing = db.prepare('SELECT id, status, filled_slots FROM tournaments WHERE id = ?').get(tournamentId) as any;

    if (!existing) {
      throw new AppError('Tournament not found.', 404);
    }

    db.prepare(`
      UPDATE tournaments 
      SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(tournamentId);

    // Sync cancelled status to Google Drive
    GDriveTournamentStore.getTournament(tournamentId).then((t) => {
      if (t) {
        t.status = 'cancelled';
        t.updated_at = new Date().toISOString();
        GDriveTournamentStore.saveTournament(t).catch(() => {});
      }
    }).catch(() => {});

    Logger.audit({
      actorId: adminId,
      action: 'TOURNAMENT_CANCELLED',
      targetResource: 'tournaments',
      targetId: tournamentId,
      details: { reason, filledSlots: existing.filled_slots },
    });
  }

  /**
   * Admin: Permanently deletes a tournament and its associated records
   */
  public static async deleteTournament(adminId: string, tournamentId: string): Promise<void> {
    const db = getDb();
    const existing = db.prepare('SELECT id, title, status, filled_slots FROM tournaments WHERE id = ?').get(tournamentId) as any;

    if (!existing) {
      throw new AppError('Tournament not found.', 404);
    }

    try {
      db.prepare('DELETE FROM tournament_entries WHERE tournament_id = ?').run(tournamentId);
    } catch (_) {}

    try {
      db.prepare('DELETE FROM tournament_results WHERE tournament_id = ?').run(tournamentId);
    } catch (_) {}

    try {
      db.prepare('DELETE FROM payout_distributions WHERE tournament_id = ?').run(tournamentId);
    } catch (_) {}

    db.prepare('DELETE FROM tournaments WHERE id = ?').run(tournamentId);

    // Explicitly delete from Google Drive persistent cloud storage and record tombstone
    GDriveTournamentStore.deleteTournament(tournamentId, adminId).catch(() => {});

    Logger.audit({
      actorId: adminId,
      action: 'TOURNAMENT_DELETED',
      targetResource: 'tournaments',
      targetId: tournamentId,
      details: { title: existing.title, status: existing.status, filledSlots: existing.filled_slots },
    });
  }

  /**
   * Client & Admin: Lists tournaments with multi-dimensional filtering
   */
  public static async listTournaments(filters: TournamentFilters, userRole?: string): Promise<{ count: number; tournaments: Tournament[] }> {
    const db = getDb();
    const whereClauses: string[] = [];
    const params: any[] = [];

    if (filters.game) {
      whereClauses.push('game = ?');
      params.push(filters.game);
    }

    const requestedGameMode = filters.game_mode || filters.gameMode;
    if (requestedGameMode && requestedGameMode !== 'all') {
      whereClauses.push('game_mode = ?');
      params.push(requestedGameMode);
    }

    if (filters.mode && filters.mode !== 'all') {
      whereClauses.push('mode = ?');
      params.push(filters.mode);
    }

    if (filters.map && filters.map !== 'all') {
      whereClauses.push('map = ?');
      params.push(filters.map);
    }

    if (filters.entryType && filters.entryType !== 'all') {
      whereClauses.push('entry_type = ?');
      params.push(filters.entryType);
    }

    if (filters.status && filters.status !== 'all') {
      whereClauses.push('status = ?');
      params.push(filters.status);
    } else {
      // Default: do not show cancelled tournaments to regular users unless explicitly requested
      if (userRole !== 'admin') {
        whereClauses.push("status != 'cancelled'");
      }
    }

    if (filters.search) {
      whereClauses.push('(title LIKE ? OR description LIKE ?)');
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const countRow = db.prepare(`SELECT COUNT(*) as total FROM tournaments ${whereSql}`).get(...params) as any;
    const total = countRow ? countRow.total : 0;
    const isAdmin = userRole === 'admin' || userRole === 'moderator';

    const orderSql = isAdmin
      ? 'ORDER BY created_at DESC'
      : `ORDER BY 
          CASE 
            WHEN status = 'open' THEN 1 
            WHEN status = 'upcoming' THEN 2 
            WHEN status = 'ongoing' THEN 3 
            ELSE 4 
          END,
          start_time ASC`;

    const querySql = `
      SELECT * FROM tournaments 
      ${whereSql} 
      ${orderSql}
      LIMIT ? OFFSET ?
    `;

    const rows = db.prepare(querySql).all(...params, limit, offset) as any[];

    const tournaments = rows.map((row) => this.formatAndSanitizeTournament(row, isAdmin));

    return {
      count: total,
      tournaments,
    };
  }

  /**
   * Client: Retrieves live and total match counts per game mode
   */
  public static async getGameModeStats(): Promise<Record<string, { liveCount: number; totalCount: number }>> {
    const db = getDb();
    const rows = db.prepare(`
      SELECT game_mode, 
             SUM(CASE WHEN status IN ('ongoing', 'open') THEN 1 ELSE 0 END) as live_count,
             COUNT(*) as total_count
      FROM tournaments 
      WHERE status != 'cancelled'
      GROUP BY game_mode
    `).all() as any[];

    const stats: Record<string, { liveCount: number; totalCount: number }> = {
      ff_max: { liveCount: 0, totalCount: 0 },
      survival: { liveCount: 0, totalCount: 0 },
      free_match: { liveCount: 0, totalCount: 0 },
      lone_wolf: { liveCount: 0, totalCount: 0 },
      headshot_only: { liveCount: 0, totalCount: 0 },
      one_tap: { liveCount: 0, totalCount: 0 },
      sniper_1v1: { liveCount: 0, totalCount: 0 },
      lone_wolf_headshot: { liveCount: 0, totalCount: 0 },
    };

    for (const r of rows) {
      const modeKey = r.game_mode || 'survival';
      stats[modeKey] = {
        liveCount: Number(r.live_count || 0),
        totalCount: Number(r.total_count || 0),
      };
    }
    return stats;
  }

  /**
   * Client & Admin: Retrieves detailed tournament information
   */
  public static async getTournamentById(tournamentId: string, userRole?: string): Promise<Tournament> {
    const db = getDb();
    const row = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId) as any;

    if (!row) {
      throw new AppError('Tournament not found.', 404);
    }

    const isAdmin = userRole === 'admin' || userRole === 'moderator';
    return this.formatAndSanitizeTournament(row, isAdmin);
  }

  /**
   * Internal Helper: Parses JSON fields and sanitizes room credentials if not revealed
   */
  private static formatAndSanitizeTournament(row: any, isAdmin: boolean): Tournament {
    let prizeDistribution: PrizeDistributionItem[] = [];
    try {
      prizeDistribution = typeof row.prize_distribution === 'string' 
        ? JSON.parse(row.prize_distribution) 
        : row.prize_distribution || [];
    } catch {
      prizeDistribution = [];
    }

    const isRoomRevealed = row.room_revealed === 1 || row.room_revealed === true;

    // Security Section 3.2: Never expose room_id / room_password to clients before room reveal flip
    const canSeeRoom = isAdmin || isRoomRevealed;

    return {
      id: row.id,
      title: row.title,
      description: row.description,
      game: row.game,
      game_mode: row.game_mode || 'survival',
      mode: row.mode,
      map: row.map,
      entry_type: row.entry_type,
      entry_fee: Number(row.entry_fee),
      prize_pool: Number(row.prize_pool),
      prize_distribution: prizeDistribution,
      per_kill_prize: Number(row.per_kill_prize || 0),
      max_slots: Number(row.max_slots),
      filled_slots: Number(row.filled_slots || 0),
      start_time: row.start_time,
      registration_closes_at: row.registration_closes_at,
      room_reveal_time_minutes: Number(row.room_reveal_time_minutes || 15),
      room_id: canSeeRoom ? row.room_id : null,
      room_password: canSeeRoom ? row.room_password : null,
      room_revealed: isRoomRevealed,
      room_revealed_at: row.room_revealed_at || null,
      room_updated_at: row.room_updated_at || null,
      room_updated_by: row.room_updated_by || null,
      status: row.status,
      banner_url: row.banner_url,
      rules: row.rules,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}
