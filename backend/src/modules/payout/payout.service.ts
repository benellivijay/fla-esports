import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../../database/db';
import { Logger } from '../../utils/logger';
import { AppError } from '../../middleware/error.middleware';
import { PayoutDistributionSummary, PayoutDistributionItem, PrizeDistributionItem } from '../../types';
import { NotificationService } from '../scheduler/notification.service';

export class PayoutService {
  /**
   * Section 3.4: Automated payout calculation & distribution
   * Calculates rank-based prizes + per-kill bounties, credits winner wallets in ledger, and marks match completed.
   */
  public static async distributeTournamentPayouts(
    adminUserId: string,
    tournamentId: string
  ): Promise<PayoutDistributionSummary> {
    const db = getDb();

    // 1. Fetch tournament
    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId) as any;
    if (!tournament) {
      throw new AppError('Tournament not found.', 404);
    }

    if (tournament.status === 'completed') {
      throw new AppError('Payouts have already been distributed for this tournament match.', 400, 'PAYOUTS_ALREADY_DISTRIBUTED');
    }

    if (tournament.status === 'cancelled') {
      throw new AppError('Cannot distribute payouts for a cancelled tournament.', 400);
    }

    // 2. Parse prize distribution schema
    let prizeDistribution: PrizeDistributionItem[] = [];
    try {
      prizeDistribution = typeof tournament.prize_distribution === 'string'
        ? JSON.parse(tournament.prize_distribution)
        : tournament.prize_distribution || [];
    } catch {
      prizeDistribution = [];
    }

    const perKillPrize = Number(tournament.per_kill_prize || 0.0);

    // 3. Fetch approved results for this tournament
    const approvedResults = db.prepare(`
      SELECT 
        r.user_id,
        r.admin_confirmed_rank,
        r.admin_confirmed_kills,
        p.display_name AS player_ign
      FROM match_results r
      JOIN profiles p ON p.user_id = r.user_id
      WHERE r.tournament_id = ? AND r.status = 'approved'
    `).all(tournamentId) as any[];

    if (approvedResults.length === 0) {
      throw new AppError('No approved match results found to distribute payouts for.', 400, 'NO_APPROVED_RESULTS');
    }

    const distributions: PayoutDistributionItem[] = [];
    let totalAmountPaid = 0.0;

    for (const result of approvedResults) {
      const rank = Number(result.admin_confirmed_rank);
      const kills = Number(result.admin_confirmed_kills || 0);

      // Find rank prize
      const rankPrizeItem = prizeDistribution.find(
        (p) => Number(p.rank) === rank || p.rank.toString() === rank.toString()
      );
      const rankPrize = rankPrizeItem ? Number(rankPrizeItem.amount) : 0.0;
      const killPrize = kills * perKillPrize;
      const totalPrize = rankPrize + killPrize;

      if (totalPrize > 0) {
        distributions.push({
          userId: result.user_id,
          playerIgn: result.player_ign || 'Player',
          rank,
          kills,
          rankPrize,
          killPrize,
          totalPrize,
        });
        totalAmountPaid += totalPrize;
      }
    }

    // 4. ACID Transaction: Credit winners & complete match
    db.exec('BEGIN TRANSACTION;');
    try {
      for (const dist of distributions) {
        const ledgerId = uuidv4();
        const desc = `Prize for ${tournament.title} (Rank #${dist.rank}, ${dist.kills} Kills)`;

        // Immutable prize credit in ledger
        db.prepare(`
          INSERT INTO wallet_ledger (id, user_id, type, amount, reference_id, description, created_at)
          VALUES (?, ?, 'prize_credit', ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(ledgerId, dist.userId, dist.totalPrize, tournamentId, desc);

        // Update player total earnings
        db.prepare(`
          UPDATE profiles 
          SET total_earnings = total_earnings + ?, updated_at = CURRENT_TIMESTAMP 
          WHERE user_id = ?
        `).run(dist.totalPrize, dist.userId);
      }

      // Delete completed tournament
      try { db.prepare('DELETE FROM tournament_entries WHERE tournament_id = ?').run(tournamentId); } catch (_) {}
      try { db.prepare('DELETE FROM tournament_results WHERE tournament_id = ?').run(tournamentId); } catch (_) {}
      try { db.prepare('DELETE FROM payout_distributions WHERE tournament_id = ?').run(tournamentId); } catch (_) {}
      db.prepare('DELETE FROM tournaments WHERE id = ?').run(tournamentId);

      db.exec('COMMIT;');
    } catch (err) {
      try { db.exec('ROLLBACK;'); } catch (_) {}
      throw err;
    }

    Logger.audit({
      actorId: adminUserId,
      action: 'TOURNAMENT_PAYOUTS_DISTRIBUTED',
      targetResource: 'tournaments',
      targetId: tournamentId,
      details: {
        totalWinners: distributions.length,
        totalAmountPaid,
        distributions,
      },
    });

    // Notify all prize winners
    for (const dist of distributions) {
      NotificationService.sendNotificationToUser(dist.userId, {
        title: 'Prize Money Credited! 💰',
        body: `₹${dist.totalPrize.toFixed(2)} won in ${tournament.title} (Rank #${dist.rank}, ${dist.kills} Kills).`,
        type: 'PRIZE_CREDITED',
        data: { tournamentId, totalPrize: dist.totalPrize, rank: dist.rank, kills: dist.kills },
      }).catch((e) => Logger.error(`Failed to send prize notification: ${e.message}`));
    }

    return {
      tournamentId: tournament.id,
      tournamentTitle: tournament.title,
      totalWinners: distributions.length,
      totalAmountPaid,
      distributions,
    };
  }
}
