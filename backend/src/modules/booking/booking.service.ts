import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../../database/db';
import { Logger } from '../../utils/logger';
import { AppError } from '../../middleware/error.middleware';
import { SlotInfo, TournamentEntry, TeammateDetail } from '../../types';
import { NotificationService } from '../scheduler/notification.service';
import { GDriveTournamentStore } from '../../services/gdrive_tournament_store.service';

export interface BookSlotDTO {
  tournamentId: string;
  slotNumber?: number;
  slotNumbers?: number[];
  teamName?: string;
  teammates?: TeammateDetail[];
}

export class BookingService {
  /**
   * Returns current user wallet balance calculated directly from immutable ledger entries.
   * Section 3.3: Balance = sum of ledger entries for a user (ledger is the source of truth)
   */
  public static getUserWalletBalance(userId: string): number {
    const db = getDb();
    const row = db.prepare(`
      SELECT COALESCE(SUM(
        CASE 
          WHEN type IN ('deposit', 'prize_credit', 'refund') THEN amount
          WHEN type IN ('entry_fee_debit', 'withdrawal') THEN -amount
          ELSE 0 
        END
      ), 0.0) as balance 
      FROM wallet_ledger 
      WHERE user_id = ?
    `).get(userId) as any;

    return Number(row?.balance || 0.0);
  }

  /**
   * Helper: Add test deposit funds (used in testing and payment gateway deposit webhook)
   */
  public static recordDeposit(userId: string, amount: number, referenceId?: string): void {
    const db = getDb();
    db.prepare(`
      INSERT INTO wallet_ledger (id, user_id, type, amount, reference_id, description, created_at)
      VALUES (?, ?, 'deposit', ?, ?, 'Wallet Top-up', CURRENT_TIMESTAMP)
    `).run(uuidv4(), userId, amount, referenceId || `DEP_${Date.now()}`);
  }

  /**
   * Get interactive slot grid state for a tournament
   */
  public static async getSlotGrid(tournamentId: string, currentUserId?: string): Promise<{
    tournamentId: string;
    mode: string;
    maxSlots: number;
    filledSlots: number;
    availableSlotsCount: number;
    currentUserBookedSlot?: number;
    currentUserBookedSlots?: number[];
    slots: SlotInfo[];
  }> {
    const db = getDb();
    const tournament = db.prepare('SELECT id, mode, max_slots, filled_slots FROM tournaments WHERE id = ?').get(tournamentId) as any;

    if (!tournament) {
      throw new AppError('Tournament not found.', 404);
    }

    const entries = db.prepare(`
      SELECT slot_number, user_id, team_name, player_ff_ign 
      FROM tournament_entries 
      WHERE tournament_id = ? AND status = 'confirmed'
    `).all(tournamentId) as any[];

    const entriesMap = new Map<number, any>();
    let currentUserBookedSlot: number | undefined;
    const currentUserBookedSlots: number[] = [];

    entries.forEach((e) => {
      entriesMap.set(e.slot_number, e);
      if (currentUserId && e.user_id === currentUserId) {
        if (!currentUserBookedSlot) currentUserBookedSlot = e.slot_number;
        currentUserBookedSlots.push(e.slot_number);
      }
    });

    const slots: SlotInfo[] = [];
    let maxSlots = tournament.max_slots;
    if (tournament.mode === 'squad' && maxSlots <= 12) {
      maxSlots = maxSlots * 4;
    } else if (tournament.mode === 'duo' && maxSlots <= 24) {
      maxSlots = maxSlots * 2;
    }

    for (let i = 1; i <= maxSlots; i++) {
      const bookedEntry = entriesMap.get(i);
      const isBooked = !!bookedEntry;
      const isUser = isBooked && currentUserId && bookedEntry.user_id === currentUserId;

      slots.push({
        slotNumber: i,
        status: isBooked ? 'booked' : 'available',
        bookedBy: isBooked ? (bookedEntry.team_name || bookedEntry.player_ff_ign || 'Occupied') : null,
        isCurrentUser: !!isUser,
      });
    }

    return {
      tournamentId,
      mode: tournament.mode,
      maxSlots,
      filledSlots: entries.length,
      availableSlotsCount: Math.max(0, maxSlots - entries.length),
      currentUserBookedSlot,
      currentUserBookedSlots,
      slots,
    };
  }

  /**
   * Atomically books tournament slot(s) with double-booking prevention & wallet debit.
   * In Squad matches: a player books all 4 player slots for the team.
   * In Duo matches: a player books both 2 player slots for the team.
   * In Solo matches: a player books 1 slot.
   */
  public static async bookSlot(userId: string, data: BookSlotDTO): Promise<TournamentEntry> {
    const db = getDb();
    const { tournamentId, teamName, teammates } = data;

    // 1. Fetch tournament
    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId) as any;
    if (!tournament) {
      throw new AppError('Tournament not found.', 404);
    }

    if (tournament.status === 'completed' || tournament.status === 'cancelled') {
      throw new AppError(`Cannot join a tournament that is ${tournament.status}.`, 400);
    }

    // 2. Compute effective max slots (e.g. 12 squad teams = 48 player slots)
    let effectiveMaxSlots = tournament.max_slots;
    if (tournament.mode === 'squad' && effectiveMaxSlots <= 12) {
      effectiveMaxSlots = effectiveMaxSlots * 4;
    } else if (tournament.mode === 'duo' && effectiveMaxSlots <= 24) {
      effectiveMaxSlots = effectiveMaxSlots * 2;
    }

    // 3. Resolve requested slots list
    let requestedSlots: number[] = [];
    if (data.slotNumbers && Array.isArray(data.slotNumbers) && data.slotNumbers.length > 0) {
      requestedSlots = [...new Set(data.slotNumbers.map(Number))].sort((a, b) => a - b);
    } else if (data.slotNumber !== undefined) {
      requestedSlots = [Number(data.slotNumber)];
    }

    if (requestedSlots.length === 0) {
      throw new AppError('At least one slot number must be selected.', 400);
    }

    // Auto-expand single slot selection to full team requirement if mode is squad or duo
    if (tournament.mode === 'squad') {
      if (requestedSlots.length === 1) {
        const teamNum = Math.floor((requestedSlots[0] - 1) / 4) + 1;
        const startSlot = (teamNum - 1) * 4 + 1;
        requestedSlots = [startSlot, startSlot + 1, startSlot + 2, startSlot + 3];
      }
      if (requestedSlots.length !== 4) {
        throw new AppError('Squad tournament registration requires selecting 4 player slots (A, B, C, D).', 400);
      }
      const teamNum = Math.floor((requestedSlots[0] - 1) / 4) + 1;
      for (const s of requestedSlots) {
        if (Math.floor((s - 1) / 4) + 1 !== teamNum) {
          throw new AppError('All 4 squad slots must belong to the same team.', 400);
        }
      }
    } else if (tournament.mode === 'duo') {
      if (requestedSlots.length === 1) {
        const teamNum = Math.floor((requestedSlots[0] - 1) / 2) + 1;
        const startSlot = (teamNum - 1) * 2 + 1;
        requestedSlots = [startSlot, startSlot + 1];
      }
      if (requestedSlots.length !== 2) {
        throw new AppError('Duo tournament registration requires selecting 2 player slots (A, B).', 400);
      }
      const teamNum = Math.floor((requestedSlots[0] - 1) / 2) + 1;
      for (const s of requestedSlots) {
        if (Math.floor((s - 1) / 2) + 1 !== teamNum) {
          throw new AppError('Both duo slots must belong to the same team.', 400);
        }
      }
    }

    // Validate slot number range
    for (const slotNumber of requestedSlots) {
      if (slotNumber < 1 || slotNumber > effectiveMaxSlots) {
        throw new AppError(`Invalid slot number ${slotNumber}. Must be between 1 and ${effectiveMaxSlots}.`, 400);
      }
    }

    // 4. Check user profile for Free Fire UID
    let profile = db.prepare('SELECT ff_uid, ff_ign, display_name FROM profiles WHERE user_id = ?').get(userId) as any;
    if ((!profile || !profile.ff_uid || profile.ff_uid.trim() === '') && teammates && teammates.length > 0 && teammates[0].ffUid) {
      db.prepare(`
        UPDATE profiles 
        SET ff_uid = ?, ff_ign = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE user_id = ?
      `).run(teammates[0].ffUid.trim(), teammates[0].ffIgn?.trim() || profile?.display_name || 'Player', userId);
      profile = db.prepare('SELECT ff_uid, ff_ign, display_name FROM profiles WHERE user_id = ?').get(userId) as any;
    }

    if (!profile || !profile.ff_uid || profile.ff_uid.trim() === '') {
      throw new AppError('Please link your Free Fire UID in your profile before booking a slot.', 400, 'FF_UID_REQUIRED');
    }
    const userFfUid = (teammates && teammates[0]?.ffUid) ? teammates[0].ffUid.trim() : profile.ff_uid;
    const userFfIgn = (teammates && teammates[0]?.ffIgn) ? teammates[0].ffIgn.trim() : (profile.ff_ign || profile.display_name || `Player_${userId.slice(-4)}`);

    // 5. Check if user already booked slots in this tournament
    const existingUserEntries = db.prepare(`
      SELECT id, slot_number FROM tournament_entries 
      WHERE tournament_id = ? AND user_id = ? AND status = 'confirmed'
    `).all(tournamentId, userId) as any[];

    if (existingUserEntries.length > 0) {
      const slotsList = existingUserEntries.map(e => '#' + e.slot_number).join(', ');
      throw new AppError(`You are already registered in this tournament (Slots: ${slotsList}).`, 409, 'ALREADY_REGISTERED');
    }

    // 6. Check wallet balance for paid tournaments
    const isPaid = tournament.entry_type === 'paid' && tournament.entry_fee > 0;
    const entryFee = isPaid ? Number(tournament.entry_fee) : 0.0;

    if (isPaid) {
      const balance = this.getUserWalletBalance(userId);
      if (balance < entryFee) {
        throw new AppError(
          `Insufficient wallet balance (Current: ₹${balance.toFixed(2)}, Required: ₹${entryFee.toFixed(2)}). Please add money to your wallet.`,
          400,
          'INSUFFICIENT_WALLET_BALANCE'
        );
      }
    }

    // 7. Execute ACID Atomic Transaction
    const teammatesJson = teammates && teammates.length > 0 ? JSON.stringify(teammates) : null;
    let firstEntryId = '';

    db.exec('BEGIN TRANSACTION;');
    try {
      // Re-verify slot availability under lock
      for (const slotNumber of requestedSlots) {
        const slotOccupied = db.prepare(`
          SELECT id FROM tournament_entries 
          WHERE tournament_id = ? AND slot_number = ? AND status = 'confirmed'
        `).get(tournamentId, slotNumber) as any;

        if (slotOccupied) {
          throw new AppError(`Slot #${slotNumber} has just been taken by another team. Please choose another slot.`, 409, 'SLOT_ALREADY_TAKEN');
        }
      }

      // If paid match, record atomic ledger debit
      if (isPaid) {
        db.prepare(`
          INSERT INTO wallet_ledger (id, user_id, type, amount, reference_id, description, created_at)
          VALUES (?, ?, 'entry_fee_debit', ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(
          uuidv4(),
          userId,
          entryFee,
          tournamentId,
          `Entry fee for ${tournament.title} (Slots #${requestedSlots.join(', #')})`
        );
      }

      const entryFeePerSlot = entryFee / requestedSlots.length;
      const teamNumber = tournament.mode === 'squad'
        ? Math.floor((requestedSlots[0] - 1) / 4) + 1
        : tournament.mode === 'duo'
        ? Math.floor((requestedSlots[0] - 1) / 2) + 1
        : null;

      const defaultTeamName = teamName || (teamNumber ? `Team ${teamNumber}` : null);

      // Insert confirmed entry for each selected slot
      for (let i = 0; i < requestedSlots.length; i++) {
        const slotNumber = requestedSlots[i];
        const entryId = uuidv4();
        if (i === 0) firstEntryId = entryId;

        let slotIgn = userFfIgn;
        let slotUid = userFfUid;

        if (tournament.mode === 'squad') {
          const pos = ['A', 'B', 'C', 'D'][(slotNumber - 1) % 4];
          slotIgn = (i === 0) ? userFfIgn : `${userFfIgn} (${pos})`;
          slotUid = (i === 0) ? userFfUid : `${userFfUid}_${pos}`;
        } else if (tournament.mode === 'duo') {
          const pos = ['A', 'B'][(slotNumber - 1) % 2];
          slotIgn = (i === 0) ? userFfIgn : `${userFfIgn} (${pos})`;
          slotUid = (i === 0) ? userFfUid : `${userFfUid}_${pos}`;
        }

        if (teammates && teammates[i]) {
          slotUid = teammates[i].ffUid ? teammates[i].ffUid.trim() : slotUid;
          slotIgn = teammates[i].ffIgn ? teammates[i].ffIgn.trim() : slotIgn;
        }

        db.prepare(`
          INSERT INTO tournament_entries (
            id, tournament_id, user_id, slot_number, team_name, 
            player_ff_uid, player_ff_ign, teammate_details, 
            entry_fee_paid, status, created_at, updated_at
          ) VALUES (
            ?, ?, ?, ?, ?, 
            ?, ?, ?, 
            ?, 'confirmed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
        `).run(
          entryId,
          tournamentId,
          userId,
          slotNumber,
          defaultTeamName,
          slotUid,
          slotIgn,
          teammatesJson,
          entryFeePerSlot
        );
      }

      // Update filled_slots in tournament
      db.prepare(`
        UPDATE tournaments 
        SET filled_slots = (SELECT COUNT(*) FROM tournament_entries WHERE tournament_id = ? AND status = 'confirmed'), 
            updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(tournamentId, tournamentId);

      db.exec('COMMIT;');
    } catch (err: any) {
      try { db.exec('ROLLBACK;'); } catch (_) {}
      
      if (err.message && (err.message.includes('UNIQUE constraint failed') || err.message.includes('ERR_SQLITE_ERROR'))) {
        throw new AppError(`One or more of the selected slots are already booked. Please choose another slot.`, 409, 'SLOT_ALREADY_TAKEN');
      }
      throw err;
    }

    Logger.audit({
      actorId: userId,
      action: 'SLOT_BOOKED',
      targetResource: 'tournament_entries',
      targetId: firstEntryId,
      details: { tournamentId, requestedSlots, entryFee, isPaid },
    });

    // Sync booked entries to GDriveTournamentStore for persistent cloud backup
    try {
      const insertedEntries = db.prepare(`
        SELECT * FROM tournament_entries 
        WHERE tournament_id = ? AND user_id = ? AND status = 'confirmed'
      `).all(tournamentId, userId) as any[];

      for (const entry of insertedEntries) {
        GDriveTournamentStore.syncEntry(tournamentId, entry).catch((err) => {
          Logger.warn(`[BOOKING] Failed to sync entry to GDrive store: ${err.message}`);
        });
      }
    } catch (gdriveErr: any) {
      Logger.warn(`[BOOKING] GDrive store sync error: ${gdriveErr.message}`);
    }

    const slotsLabel = requestedSlots.length > 1
      ? `Slots #${requestedSlots.join(', #')}`
      : `Slot #${requestedSlots[0]}`;

    NotificationService.sendNotificationToUser(userId, {
      title: 'Slot Confirmed! 🎮',
      body: `You are booked in ${slotsLabel} for ${tournament.title}.`,
      type: 'BOOKING_CONFIRMED',
      data: { tournamentId, slotNumber: requestedSlots[0], slotNumbers: requestedSlots },
    }).catch((e) => Logger.error(`Failed to send booking notification: ${e.message}`));

    return db.prepare('SELECT * FROM tournament_entries WHERE id = ?').get(firstEntryId) as unknown as TournamentEntry;
  }

  /**
   * Cancels a slot booking (or full squad/duo booking) and issues automatic refund to wallet ledger
   */
  public static async cancelBooking(userId: string, tournamentId: string): Promise<{ success: boolean; refundedAmount: number }> {
    const db = getDb();
    const entries = db.prepare(`
      SELECT * FROM tournament_entries 
      WHERE tournament_id = ? AND user_id = ? AND status = 'confirmed'
    `).all(tournamentId, userId) as any[];

    if (!entries || entries.length === 0) {
      throw new AppError('No active booking found for this tournament.', 404);
    }

    const tournament = db.prepare('SELECT title, start_time FROM tournaments WHERE id = ?').get(tournamentId) as any;
    if (tournament && tournament.start_time) {
      const parsedTime = new Date(tournament.start_time.includes('T') ? tournament.start_time : tournament.start_time.replace(' ', 'T') + 'Z').getTime();
      if (!isNaN(parsedTime) && parsedTime <= Date.now()) {
        throw new AppError('Cannot cancel booking after tournament match has started.', 400);
      }
    }

    const refundAmount = entries.reduce((sum: number, e: any) => sum + Number(e.entry_fee_paid || 0), 0);
    const slotNumbers = entries.map((e: any) => e.slot_number);

    db.exec('BEGIN TRANSACTION;');
    try {
      // Mark all confirmed entries cancelled for this user
      db.prepare(`
        UPDATE tournament_entries 
        SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP 
        WHERE tournament_id = ? AND user_id = ? AND status = 'confirmed'
      `).run(tournamentId, userId);

      // Refund to wallet ledger if paid
      if (refundAmount > 0) {
        db.prepare(`
          INSERT INTO wallet_ledger (id, user_id, type, amount, reference_id, description, created_at)
          VALUES (?, ?, 'refund', ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(
          uuidv4(),
          userId,
          refundAmount,
          tournamentId,
          `Refund for cancelled booking in ${tournament?.title || 'Tournament'} (Slots #${slotNumbers.join(', #')})`
        );
      }

      // Update tournament filled slots
      db.prepare(`
        UPDATE tournaments 
        SET filled_slots = (SELECT COUNT(*) FROM tournament_entries WHERE tournament_id = ? AND status = 'confirmed'), 
            updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(tournamentId, tournamentId);

      db.exec('COMMIT;');
    } catch (err) {
      try { db.exec('ROLLBACK;'); } catch (_) {}
      throw err;
    }

    Logger.audit({
      actorId: userId,
      action: 'SLOT_BOOKING_CANCELLED',
      targetResource: 'tournament_entries',
      targetId: entries[0].id,
      details: { tournamentId, slotNumbers, refundAmount },
    });

    // Sync cancelled entries to GDriveTournamentStore for persistent cloud backup
    try {
      for (const entry of entries) {
        GDriveTournamentStore.syncEntry(tournamentId, {
          ...entry,
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        }).catch((err) => {
          Logger.warn(`[BOOKING] Failed to sync cancelled entry to GDrive store: ${err.message}`);
        });
      }
    } catch (gdriveErr: any) {
      Logger.warn(`[BOOKING] GDrive store cancel sync error: ${gdriveErr.message}`);
    }

    NotificationService.sendNotificationToUser(userId, {
      title: 'Booking Cancelled & Refunded 💸',
      body: `Your booking for ${tournament?.title || 'tournament'} has been cancelled and ₹${refundAmount.toFixed(2)} refunded to your wallet.`,
      type: 'BOOKING_REFUNDED',
      data: { tournamentId, refundedAmount: refundAmount },
    }).catch((e) => Logger.error(`Failed to send cancellation notification: ${e.message}`));

    return {
      success: true,
      refundedAmount: refundAmount,
    };
  }

  /**
   * Retrieves all tournament matches joined by current user
   */
  public static async getMyBookings(userId: string): Promise<any[]> {
    const db = getDb();
    const rows = db.prepare(`
      SELECT 
        e.id AS entry_id,
        e.slot_number,
        e.team_name,
        e.player_ff_uid,
        e.player_ff_ign,
        e.teammate_details,
        e.entry_fee_paid,
        e.status AS booking_status,
        e.created_at AS booked_at,
        t.id AS tournament_id,
        t.title,
        t.game,
        t.mode,
        t.map,
        t.entry_type,
        t.prize_pool,
        t.per_kill_prize,
        t.start_time,
        t.room_id,
        t.room_password,
        t.room_revealed,
        t.status AS tournament_status
      FROM tournament_entries e
      JOIN tournaments t ON t.id = e.tournament_id
      WHERE e.user_id = ? AND e.status = 'confirmed'
      ORDER BY t.start_time ASC
    `).all(userId) as any[];

    // Group rows by tournament_id so multi-slot bookings (Squad/Duo) collapse to single match card
    const tournamentMap = new Map<string, any>();
    for (const r of rows) {
      const isRoomRevealed = r.room_revealed === 1 || r.room_revealed === true;
      if (!tournamentMap.has(r.tournament_id)) {
        let parsedTeammates: any[] = [];
        try {
          if (r.teammate_details) {
            parsedTeammates = typeof r.teammate_details === 'string' ? JSON.parse(r.teammate_details) : r.teammate_details;
          }
        } catch (_) {
          parsedTeammates = [];
        }

        tournamentMap.set(r.tournament_id, {
          ...r,
          slot_numbers: [r.slot_number],
          room_id: isRoomRevealed ? r.room_id : null,
          room_password: isRoomRevealed ? r.room_password : null,
          room_revealed: isRoomRevealed,
          teammate_details: parsedTeammates,
          teammates: parsedTeammates,
        });
      } else {
        const item = tournamentMap.get(r.tournament_id);
        item.slot_numbers.push(r.slot_number);
        item.entry_fee_paid = Number(item.entry_fee_paid || 0) + Number(r.entry_fee_paid || 0);
      }
    }

    return Array.from(tournamentMap.values());
  }
}
