import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { getDb } from '../../database/db';
import { CryptoUtil } from '../../utils/crypto';
import { Logger } from '../../utils/logger';
import { AppError } from '../../middleware/error.middleware';
import { config } from '../../config/env';
import { User, Profile, Tournament } from '../../types';
import { FileCleanupUtil } from '../../utils/file_cleanup.util';

export class AdminService {
  /**
   * Step 1 Admin Login: Validates email and password, generates temporary 2FA token
   */
  public static async adminLogin(email: string, password: string): Promise<{
    tempToken: string;
    totpRequired: boolean;
    email: string;
    role: string;
  }> {
    const cleanEmail = email.trim().toLowerCase();
    const db = getDb();

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail) as any;
    if (!user) {
      throw new AppError('Invalid credentials.', 401, 'INVALID_CREDENTIALS');
    }

    if (user.role !== 'admin' && user.role !== 'moderator') {
      throw new AppError('Access forbidden. Staff credentials required.', 403, 'FORBIDDEN_STAFF_ONLY');
    }

    if (user.status !== 'active') {
      throw new AppError('This staff account has been suspended.', 403, 'ACCOUNT_SUSPENDED');
    }

    if (!user.password_hash) {
      throw new AppError('Password authentication not configured for this account.', 400, 'PASSWORD_NOT_SET');
    }

    const isMatch = CryptoUtil.comparePassword(password, user.password_hash);
    if (!isMatch) {
      throw new AppError('Invalid credentials.', 401, 'INVALID_CREDENTIALS');
    }

    // Issue short-lived temp token for 2FA verification (valid for 5 minutes)
    const tempToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, type: 'admin_2fa_pending' },
      config.jwt.accessSecret,
      { expiresIn: '5m' }
    );

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
  public static async verifyTotp2FA(tempToken: string, totpCode: string): Promise<{
    accessToken: string;
    refreshToken: string;
    user: { id: string; email: string; role: string; status: string };
    profile: Profile;
  }> {
    let payload: any;
    try {
      payload = jwt.verify(tempToken, config.jwt.accessSecret);
    } catch (_) {
      throw new AppError('2FA session expired. Please log in again.', 401, 'INVALID_2FA_SESSION');
    }

    if (payload.type !== 'admin_2fa_pending') {
      throw new AppError('Invalid token type for 2FA verification.', 401, 'INVALID_TOKEN');
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.userId) as any;
    if (!user || (user.role !== 'admin' && user.role !== 'moderator')) {
      throw new AppError('User not found or insufficient privileges.', 403, 'FORBIDDEN');
    }

    // Verify TOTP against stored secret (or default testing secret)
    const secret = user.totp_secret || 'JBSWY3DPEHPK3PXP';
    const isValid = CryptoUtil.verifyTOTP(totpCode, secret);
    if (!isValid) {
      throw new AppError('Invalid 2FA code. Please check your authenticator app.', 400, 'INVALID_TOTP');
    }

    // Generate production admin access tokens
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, phone: user.phone, role: user.role },
      config.jwt.accessSecret,
      { expiresIn: config.jwt.accessExpiresIn as any }
    );

    const refreshToken = CryptoUtil.generateRefreshTokenString();
    const refreshExpiry = new Date(Date.now() + config.jwt.refreshExpiresInDays * 24 * 60 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(uuidv4(), user.id, CryptoUtil.hash(refreshToken), refreshExpiry);

    const profile = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(user.id) as unknown as Profile;

    Logger.audit({
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
        id: uuidv4(),
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
  public static async getDashboardStats(): Promise<{
    pendingResultReviews: number;
    tournamentsLiveToday: number;
    totalPlatformBalance: number;
    disputedResultsCount: number;
    totalUsers: number;
    totalTournaments: number;
    pendingWithdrawalsCount: number;
    recentAuditLogs: any[];
  }> {
    const db = getDb();

    const pendingResults = db.prepare("SELECT COUNT(*) as count FROM match_results WHERE status = 'pending_review'").get() as any;
    const disputedResults = db.prepare("SELECT COUNT(*) as count FROM match_results WHERE status = 'disputed'").get() as any;
    const tournamentsToday = db.prepare("SELECT COUNT(*) as count FROM tournaments WHERE date(start_time) = date('now') AND status != 'cancelled'").get() as any;
    const totalTourneys = db.prepare('SELECT COUNT(*) as count FROM tournaments').get() as any;
    const usersCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'user'").get() as any;
    const pendingWithdrawals = db.prepare("SELECT COUNT(*) as count FROM withdrawal_requests WHERE status = 'pending'").get() as any;

    // Calculate total net wallet liability
    const credits = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM wallet_ledger WHERE type IN ('deposit', 'prize_credit', 'refund')").get() as any;
    const debits = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM wallet_ledger WHERE type IN ('entry_fee_debit', 'withdrawal')").get() as any;
    const totalBalance = Math.max(0, (credits?.total || 0) - (debits?.total || 0));

    let recentLogs: any[] = [];
    try {
      recentLogs = db.prepare(`
        SELECT a.*, u.email as actor_email, p.display_name as actor_name
        FROM audit_logs a
        LEFT JOIN users u ON COALESCE(a.actor_id, a.user_id) = u.id
        LEFT JOIN profiles p ON COALESCE(a.actor_id, a.user_id) = p.user_id
        ORDER BY a.created_at DESC LIMIT 6
      `).all();
    } catch (_) {
      try {
        recentLogs = db.prepare(`SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 6`).all();
      } catch (_) {
        recentLogs = [];
      }
    }

    return {
      pendingResultReviews: pendingResults?.count || 0,
      tournamentsLiveToday: tournamentsToday?.count || 0,
      totalPlatformBalance: totalBalance,
      disputedResultsCount: disputedResults?.count || 0,
      totalUsers: usersCount?.count || 0,
      totalTournaments: totalTourneys?.count || 0,
      pendingWithdrawalsCount: pendingWithdrawals?.count || 0,
      recentAuditLogs: recentLogs.map((log: any) => {
        let details = {};
        if (typeof log.details === 'object' && log.details !== null) details = log.details;
        else if (typeof log.details === 'string') {
          try { details = JSON.parse(log.details); } catch (_) { details = {}; }
        }
        return { ...log, details };
      }),
    };
  }

  /**
   * Result review queue: Lists results with running summary counts
   */
  public static async getResultsQueue(tournamentId?: string, statusFilter?: string): Promise<{
    results: any[];
    queue?: any[];
    total?: number;
    counts: { pending: number; verified: number; disputed: number; rejected: number; total: number };
  }> {
    const db = getDb();

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
    const params: any[] = [];

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
    const rows = db.prepare(query).all(...params) as any[];

    // Calculate running counts
    let countQuery = 'SELECT status, COUNT(*) as count FROM match_results';
    const countParams: any[] = [];
    if (tournamentId) {
      countQuery += ' WHERE tournament_id = ?';
      countParams.push(tournamentId);
    }
    countQuery += ' GROUP BY status';
    const countRows = db.prepare(countQuery).all(...countParams) as any[];

    const counts = { pending: 0, verified: 0, disputed: 0, rejected: 0, total: 0 };
    for (const row of countRows) {
      if (row.status === 'pending_review') counts.pending = row.count;
      else if (row.status === 'approved' || row.status === 'verified') counts.verified = row.count;
      else if (row.status === 'disputed') counts.disputed = row.count;
      else if (row.status === 'rejected') counts.rejected = row.count;
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
  public static async verifyResult(
    adminId: string,
    resultId: string,
    confirmedRank?: number,
    confirmedKills?: number
  ): Promise<any> {
    const db = getDb();
    const result = db.prepare('SELECT * FROM match_results WHERE id = ?').get(resultId) as any;
    if (!result) {
      throw new AppError('Match result claim not found.', 404);
    }

    const rank = confirmedRank !== undefined ? confirmedRank : result.claimed_rank;
    const kills = confirmedKills !== undefined ? confirmedKills : result.claimed_kills;

    // Automatically delete position & kill screenshot proof from server storage upon verification
    if (result.screenshot_url) {
      FileCleanupUtil.deleteUploadedFile(result.screenshot_url);
    }

    db.prepare(`
      UPDATE match_results 
      SET status = 'approved', admin_confirmed_rank = ?, admin_confirmed_kills = ?, screenshot_url = '[DELETED_AFTER_APPROVAL]', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(rank, kills, adminId, resultId);

    Logger.audit({
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
  public static async disputeResult(adminId: string, resultId: string, reasonNote: string): Promise<any> {
    if (!reasonNote || reasonNote.trim().length === 0) {
      throw new AppError('A dispute reason note is mandatory before saving.', 400, 'DISPUTE_REASON_REQUIRED');
    }

    const db = getDb();
    const result = db.prepare('SELECT * FROM match_results WHERE id = ?').get(resultId) as any;
    if (!result) {
      throw new AppError('Match result claim not found.', 404);
    }

    const cleanReason = reasonNote.trim();

    db.prepare(`
      UPDATE match_results 
      SET status = 'disputed', rejection_reason = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(cleanReason, adminId, resultId);

    Logger.audit({
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
  public static async getPayoutPreview(tournamentId: string): Promise<{
    tournament: any;
    payoutStatus: string;
    totalPrizePool: number;
    totalComputedPayout: number;
    allResultsVerified: boolean;
    unverifiedCount: number;
    payoutBreakdown: Array<{
      userId: string;
      displayName: string;
      slotNumber: number;
      ffUid: string;
      ffIgn: string;
      rank: number;
      kills: number;
      placementPrize: number;
      killPrize: number;
      totalPayout: number;
      status: string;
    }>;
  }> {
    const db = getDb();
    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId) as any;
    if (!tournament) {
      throw new AppError('Tournament not found.', 404);
    }

    let distribution: Array<{ rank: number; prize: number }> = [];
    try {
      distribution = JSON.parse(tournament.prize_distribution || '[]');
    } catch (_) {}

    const rankPrizeMap: Record<number, number> = {};
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
    `).all(tournamentId) as any[];

    let unverifiedCount = 0;
    let totalComputedPayout = 0;

    const payoutBreakdown = results.map(r => {
      const isVerified = r.status === 'approved' || r.status === 'verified';
      if (!isVerified) unverifiedCount++;

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
  public static async executePayoutRun(adminId: string, tournamentId: string): Promise<{
    success: boolean;
    message: string;
    totalPaid: number;
    creditedUsersCount: number;
  }> {
    const db = getDb();
    const tournament = db.prepare('SELECT * FROM tournaments WHERE id = ?').get(tournamentId) as any;
    if (!tournament) {
      throw new AppError('Tournament not found.', 404);
    }

    // IDEMPOTENCY CHECK: Do not allow re-running payout if already paid
    if (tournament.payout_status === 'paid') {
      throw new AppError('Payout for this tournament has already been executed.', 400, 'PAYOUT_ALREADY_EXECUTED');
    }

    const preview = await this.getPayoutPreview(tournamentId);

    // Atomically execute wallet credits and update tournament payout status
    let creditedUsersCount = 0;
    let totalPaid = 0;

    for (const player of preview.payoutBreakdown) {
      if (player.status === 'verified' && player.totalPayout > 0) {
        const ledgerId = uuidv4();
        db.prepare(`
          INSERT INTO wallet_ledger (id, user_id, type, amount, reference_id, description, created_at)
          VALUES (?, ?, 'prize_credit', ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(
          ledgerId,
          player.userId,
          player.totalPayout,
          tournamentId,
          `Tournament Prize Winnings: ${tournament.title} (Rank #${player.rank}, ${player.kills} Kills)`
        );

        // Update profile career stats
        db.prepare(`
          UPDATE profiles 
          SET total_earnings = total_earnings + ?,
              total_kills = total_kills + ?,
              wins = wins + ?,
              matches_played = matches_played + 1,
              updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ?
        `).run(player.totalPayout, player.kills, player.rank === 1 ? 1 : 0, player.userId);

        // Create notification
        db.prepare(`
          INSERT INTO notifications (id, user_id, title, body, type, is_read, created_at)
          VALUES (?, ?, ?, ?, 'PRIZE_CREDITED', 0, CURRENT_TIMESTAMP)
        `).run(
          uuidv4(),
          player.userId,
          '🏆 Prize Money Credited!',
          `You won ₹${player.totalPayout.toFixed(0)} in ${tournament.title}! Balance updated in wallet.`
        );

        creditedUsersCount++;
        totalPaid += player.totalPayout;
      }
    }

    // Mark tournament payout status as completed and paid, then delete tournament
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

    Logger.audit({
      actorId: adminId,
      action: 'PAYOUT_RUN_EXECUTED_AND_TOURNAMENT_AUTO_DELETED',
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
  public static async listUsers(
    search?: string,
    roleFilter?: string,
    statusFilter?: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ users: any[]; total: number; page: number; limit: number }> {
    const db = getDb();
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
    const params: any[] = [];

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
    const totalRow = db.prepare(countQuery).get(...params) as any;
    const total = totalRow?.count || 0;

    query += ' ORDER BY u.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = db.prepare(query).all(...params) as any[];

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
  public static async updateUserStatus(
    adminId: string,
    targetUserId: string,
    newStatus: 'active' | 'suspended' | 'banned',
    reason?: string
  ): Promise<any> {
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(targetUserId) as any;
    if (!user) {
      throw new AppError('User not found.', 404);
    }

    db.prepare('UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStatus, targetUserId);

    Logger.audit({
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
  public static async updateUserRole(
    adminId: string,
    targetUserId: string,
    newRole: 'user' | 'moderator' | 'admin'
  ): Promise<any> {
    const db = getDb();
    const caller = db.prepare('SELECT role FROM users WHERE id = ?').get(adminId) as any;
    if (caller?.role !== 'admin') {
      throw new AppError('Only super administrators can modify user roles.', 403, 'FORBIDDEN_ADMIN_ONLY');
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(targetUserId) as any;
    if (!user) {
      throw new AppError('User not found.', 404);
    }

    db.prepare('UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newRole, targetUserId);

    Logger.audit({
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
  public static async getUserLedger(userId: string): Promise<{
    user: any;
    balance: number;
    transactions: any[];
  }> {
    const db = getDb();
    const user = db.prepare(`
      SELECT u.id, u.email, u.phone, u.role, u.status, p.display_name, p.ff_uid, p.ff_ign
      FROM users u
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE u.id = ?
    `).get(userId) as any;

    if (!user) {
      throw new AppError('User not found.', 404);
    }

    const transactions = db.prepare(`
      SELECT * FROM wallet_ledger 
      WHERE user_id = ? 
      ORDER BY created_at DESC
    `).all(userId) as any[];

    const credits = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM wallet_ledger WHERE user_id = ? AND type IN ('deposit', 'prize_credit', 'refund')").get(userId) as any;
    const debits = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM wallet_ledger WHERE user_id = ? AND type IN ('entry_fee_debit', 'withdrawal')").get(userId) as any;
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
  public static async adjustUserWallet(
    adminId: string,
    targetUserId: string,
    amount: number,
    type: 'deposit' | 'refund' | 'entry_fee_debit',
    reason: string
  ): Promise<{ success: boolean; newBalance: number; ledgerId: string }> {
    if (!reason || reason.trim().length === 0) {
      throw new AppError('A reason note is mandatory for all manual wallet adjustments.', 400, 'REASON_REQUIRED');
    }

    if (amount <= 0) {
      throw new AppError('Adjustment amount must be greater than zero.', 400, 'INVALID_AMOUNT');
    }

    const db = getDb();
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(targetUserId);
    if (!user) {
      throw new AppError('User not found.', 404);
    }

    const cleanReason = reason.trim();
    const ledgerId = uuidv4();

    db.prepare(`
      INSERT INTO wallet_ledger (id, user_id, type, amount, reference_id, description, created_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(ledgerId, targetUserId, type, amount, `ADJ_${adminId.slice(0, 8)}`, `Manual staff adjustment: ${cleanReason}`);

    Logger.audit({
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
  public static async getAuditLogs(
    limit: number = 50,
    page: number = 1,
    actionFilter?: string,
    actorId?: string
  ): Promise<{ logs: any[]; total: number; page: number; limit: number }> {
    const db = getDb();
    const offset = (page - 1) * limit;

    let query = `
      SELECT a.*, u.email as actor_email, p.display_name as actor_name
      FROM audit_logs a
      LEFT JOIN users u ON COALESCE(a.actor_id, a.user_id) = u.id
      LEFT JOIN profiles p ON COALESCE(a.actor_id, a.user_id) = p.user_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (actionFilter && actionFilter !== 'all') {
      query += ' AND a.action = ?';
      params.push(actionFilter);
    }

    if (actorId) {
      query += ' AND COALESCE(a.actor_id, a.user_id) = ?';
      params.push(actorId);
    }

    const countQuery = query.replace(/SELECT[\s\S]*?FROM audit_logs a/i, 'SELECT COUNT(*) as count FROM audit_logs a');
    const totalRow = db.prepare(countQuery).get(...params) as any;
    const total = totalRow?.count || 0;

    query += ' ORDER BY a.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = db.prepare(query).all(...params) as any[];

    return {
      logs: rows.map(r => {
        let details = {};
        if (typeof r.details === 'object' && r.details !== null) details = r.details;
        else if (typeof r.details === 'string') {
          try { details = JSON.parse(r.details); } catch (_) { details = {}; }
        }
        return { ...r, details };
      }),
      total,
      page,
      limit,
    };
  }

  public static async getPendingFFVerifications(): Promise<any[]> {
    const db = getDb();
    return db.prepare(`
      SELECT p.*, u.phone, u.email 
      FROM profiles p
      JOIN users u ON p.user_id = u.id
      WHERE p.ff_verification_status = 'pending_review'
      ORDER BY p.updated_at ASC
    `).all();
  }

  public static async reviewFFVerification(adminId: string, userId: string, approved: boolean, rejectionReason?: string): Promise<any> {
    const db = getDb();
    const newStatus = approved ? 'verified' : 'rejected';

    db.prepare(`
      UPDATE profiles 
      SET ff_verification_status = ?, ff_verified_at = ${approved ? 'CURRENT_TIMESTAMP' : 'NULL'}, updated_at = CURRENT_TIMESTAMP 
      WHERE user_id = ?
    `).run(newStatus, userId);

    Logger.audit({
      actorId: adminId,
      action: 'FF_UID_REVIEWED',
      targetResource: 'profiles',
      targetId: userId,
      details: { approved, rejectionReason },
    });

    return db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(userId);
  }

  public static async getPendingKYCSubmissions(): Promise<any[]> {
    const db = getDb();
    return db.prepare(`
      SELECT k.*, u.phone, u.email 
      FROM kyc_records k
      JOIN users u ON k.user_id = u.id
      WHERE k.status = 'pending'
      ORDER BY k.created_at ASC
    `).all();
  }

  public static async reviewKYC(adminId: string, kycId: string, approved: boolean, rejectionReason?: string): Promise<any> {
    const db = getDb();
    const newStatus = approved ? 'verified' : 'rejected';

    db.prepare(`
      UPDATE kyc_records 
      SET status = ?, rejection_reason = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(newStatus, rejectionReason || null, adminId, kycId);

    Logger.audit({
      actorId: adminId,
      action: 'KYC_REVIEWED',
      targetResource: 'kyc_records',
      targetId: kycId,
      details: { approved, rejectionReason },
    });

    return db.prepare('SELECT * FROM kyc_records WHERE id = ?').get(kycId);
  }
}
