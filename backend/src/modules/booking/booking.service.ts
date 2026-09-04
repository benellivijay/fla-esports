import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../../database/db';
import { Logger } from '../../utils/logger';
import { AppError } from '../../middleware/error.middleware';
import { SlotInfo, TournamentEntry, TeammateDetail } from '../../types';
import { NotificationService } from '../scheduler/notification.service';

export interface BookSlotDTO {
  tournamentId: string;
  slotNumber: number;
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

    entries.forEach((e) => {
      entriesMap.set(e.slot_number, e);
      if (currentUserId && e.user_id === currentUserId) {
        currentUserBookedSlot = e.slot_number;
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
      slots,
    };
  }

  /**
   * Atomically books a tournament slot with double-booking prevention & wallet debit
   */
  public static async bookSlot(userId: string, data: BookSlotDTO): Promise<TournamentEntry> {
    const db = getDb();
    const { tournamentId, slotNumber, teamName, teammates } = data;

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

    // Validate slot number range
    if (slotNumber < 1 || slotNumber > effectiveMaxSlots) {
      throw new AppError(`Invalid slot number. Must be between 1 and ${effectiveMaxSlots}.`, 400);
    }

    // 3. Check user profile for Free Fire UID (auto-initialize default if player has not customized it yet)
    let profile = db.prepare('SELECT ff_uid, ff_ign, display_name FROM profiles WHERE user_id = ?').get(userId) as any;
    let userFfUid = profile?.ff_uid;
    let userFfIgn = profile?.ff_ign;

    if (!userFfUid || userFfUid.trim() === '') {
      userFfUid = `FF_${userId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
      userFfIgn = profile?.display_name || `Player_${userId.slice(-4)}`;
      db.prepare(`
        UPDATE profiles 
        SET ff_uid = ?, ff_ign = ?, ff_verification_status = 'verified', updated_at = CURRENT_TIMESTAMP 
        WHERE user_id = ?
      `).run(userFfUid, userFfIgn, userId);
    }

    // 4. Check if user already booked a slot in this tournament
    const existingUserEntry = db.prepare(`
      SELECT id, slot_number FROM tournament_entries 
      WHERE tournament_id = ? AND user_id = ? AND status = 'confirmed'
    `).get(tournamentId, userId) as any;

    if (existingUserEntry) {
      throw new AppError(`You are already registered in this tournament (Slot #${existingUserEntry.slot_number}).`, 409, 'ALREADY_REGISTERED');
    }

    // 5. Check wallet balance for paid tournaments
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

    // 6. Execute ACID Atomic Transaction
    const entryId = uuidv4();
    const teammatesJson = teammates && teammates.length > 0 ? JSON.stringify(teammates) : null;

    db.exec('BEGIN TRANSACTION;');
    try {
      // Re-verify slot availability under lock
      const slotOccupied = db.prepare(`
        SELECT id FROM tournament_entries 
        WHERE tournament_id = ? AND slot_number = ? AND status = 'confirmed'
      `).get(tournamentId, slotNumber) as any;

      if (slotOccupied) {
        throw new AppError(`Slot #${slotNumber} has just been taken by another player. Please select another slot.`, 409, 'SLOT_ALREADY_TAKEN');
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
          `Entry fee for ${tournament.title} (Slot #${slotNumber})`
        );
      }

      // Insert confirmed entry
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
        teamName || null,
        userFfUid,
        userFfIgn,
        teammatesJson,
        entryFee
      );

      // Increment filled_slots
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
        throw new AppError(`Slot #${slotNumber} is already booked. Please choose another slot.`, 409, 'SLOT_ALREADY_TAKEN');
      }
      throw err;
    }

    Logger.audit({
      actorId: userId,
      action: 'SLOT_BOOKED',
      targetResource: 'tournament_entries',
      targetId: entryId,
      details: { tournamentId, slotNumber, entryFee, isPaid },
    });

    NotificationService.sendNotificationToUser(userId, {
      title: 'Slot Confirmed! 🎮',
      body: `You are booked in Slot #${slotNumber} for ${tournament.title}.`,
      type: 'BOOKING_CONFIRMED',
      data: { tournamentId, slotNumber },
    }).catch((e) => Logger.error(`Failed to send booking notification: ${e.message}`));

    return db.prepare('SELECT * FROM tournament_entries WHERE id = ?').get(entryId) as unknown as TournamentEntry;
  }

  /**
   * Cancels a slot booking and issues automatic refund to wallet ledger
   */
  public static async cancelBooking(userId: string, tournamentId: string): Promise<{ success: boolean; refundedAmount: number }> {
    const db = getDb();
    const entry = db.prepare(`
      SELECT * FROM tournament_entries 
      WHERE tournament_id = ? AND user_id = ? AND status = 'confirmed'
    `).get(tournamentId, userId) as any;

    if (!entry) {
      throw new AppError('No active booking found for this tournament.', 404);
    }

    const tournament = db.prepare('SELECT title, start_time FROM tournaments WHERE id = ?').get(tournamentId) as any;
    if (tournament && tournament.start_time) {
      const parsedTime = new Date(tournament.start_time.includes('T') ? tournament.start_time : tournament.start_time.replace(' ', 'T') + 'Z').getTime();
      if (!isNaN(parsedTime) && parsedTime <= Date.now()) {
        throw new AppError('Cannot cancel booking after tournament match has started.', 400);
      }
    }

    const refundAmount = Number(entry.entry_fee_paid || 0);

    db.exec('BEGIN TRANSACTION;');
    try {
      // Mark entry cancelled
      db.prepare(`
        UPDATE tournament_entries 
        SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(entry.id);

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
          `Refund for cancelled slot #${entry.slot_number} in ${tournament?.title || 'Tournament'}`
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
      targetId: entry.id,
      details: { tournamentId, slotNumber: entry.slot_number, refundAmount },
    });

    NotificationService.sendNotificationToUser(userId, {
      title: 'Booking Cancelled & Refunded 💸',
      body: `Your slot for ${tournament?.title || 'tournament'} has been cancelled and ₹${refundAmount.toFixed(2)} refunded to your wallet.`,
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
      WHERE e.user_id = ?
      ORDER BY t.start_time ASC
    `).all(userId) as any[];

    return rows.map((r) => {
      const isRoomRevealed = r.room_revealed === 1 || r.room_revealed === true;
      return {
        ...r,
        room_id: isRoomRevealed ? r.room_id : null,
        room_password: isRoomRevealed ? r.room_password : null,
        room_revealed: isRoomRevealed,
        teammate_details: r.teammate_details ? JSON.parse(r.teammate_details) : [],
      };
    });
  }
}
