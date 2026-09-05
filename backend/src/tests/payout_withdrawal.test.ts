import http from 'http';
import { createApp } from '../server';
import { getDb, DatabaseManager } from '../database/db';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';

interface ApiResponse {
  status: number;
  data: any;
}

function makeRequest(server: http.Server, options: {
  method: string;
  path: string;
  body?: any;
  token?: string;
}): Promise<ApiResponse> {
  return new Promise((resolve, reject) => {
    const port = (server.address() as any).port;
    const postData = options.body ? JSON.stringify(options.body) : '';

    const headers: Record<string, string | number> = {
      'Content-Type': 'application/json',
    };

    if (postData) {
      headers['Content-Length'] = Buffer.byteLength(postData);
    }

    if (options.token) {
      headers['Authorization'] = `Bearer ${options.token}`;
    }

    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: options.path,
      method: options.method,
      headers,
    }, (res) => {
      let rawData = '';
      res.on('data', (chunk) => { rawData += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(rawData);
          resolve({ status: res.statusCode || 500, data: parsed });
        } catch {
          resolve({ status: res.statusCode || 500, data: rawData });
        }
      });
    });

    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function runPayoutWithdrawalTests() {
  console.log('🧪 Starting Step 7: Payout Calculation + Withdrawal Flow Automated Tests...\n');
  let passedCount = 0;
  let failedCount = 0;

  function assert(condition: boolean, testName: string, detail?: any) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passedCount++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      if (detail) console.error('     Detail:', detail);
      failedCount++;
    }
  }

  const app = createApp();
  const server = http.createServer(app);
  
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const rand = Math.floor(100000 + Math.random() * 900000);
  const db = getDb();

  // Helper to create users
  function createUser(phoneSuffix: string, role: 'user' | 'admin' = 'user', isKycVerified: boolean = true) {
    const uId = uuidv4();
    const phone = `94${rand}${phoneSuffix}`;
    db.prepare(`
      INSERT INTO users (id, phone, role, status, is_phone_verified, is_email_verified, created_at, updated_at)
      VALUES (?, ?, ?, 'active', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(uId, phone, role, isKycVerified ? 1 : 1, isKycVerified ? 1 : 0);

    db.prepare(`
      INSERT INTO profiles (id, user_id, display_name, ff_uid, ff_ign, ff_verification_status, matches_played, wins, total_kills, total_earnings, created_at, updated_at)
      VALUES (?, ?, 'Player_${phoneSuffix}', 'FF_PO_${rand}_${phoneSuffix}', 'IGN_${phoneSuffix}', 'verified', 1, 1, 7, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(uuidv4(), uId);

    const token = jwt.sign({ userId: uId, role, phone }, config.jwt.accessSecret, { expiresIn: '1h' });
    return { userId: uId, token, phone };
  }

  const winnerPlayer = createUser('01', 'user', true);
  const unverifiedPlayer = createUser('02', 'user', false);
  const admin = createUser('99', 'admin', true);

  // Create tournament with prize distribution
  const tourneyId = uuidv4();
  const prizeDistribution = [
    { rank: 1, amount: 1000.0 },
    { rank: 2, amount: 500.0 },
  ];

  db.prepare(`
    INSERT INTO tournaments (
      id, title, game, mode, map, entry_type, entry_fee, prize_pool, prize_distribution, per_kill_prize,
      max_slots, filled_slots, start_time, room_reveal_time_minutes, room_id, room_password, room_revealed, status, created_at, updated_at
    ) VALUES (
      ?, 'Grand Free Fire Invitational', 'Free Fire', 'solo', 'Bermuda', 'paid', 50.0, 1500.0, ?, 10.0,
      48, 2, datetime('now', '-2 hours'), 15, 'ROOM_GF_1', 'PASS_GF_1', 1, 'ongoing', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `).run(tourneyId, JSON.stringify(prizeDistribution));

  // Approved result for winner: Rank 1, 7 kills
  const entryId = uuidv4();
  db.prepare(`
    INSERT INTO tournament_entries (id, tournament_id, user_id, slot_number, player_ff_uid, player_ff_ign, entry_fee_paid, status, created_at, updated_at)
    VALUES (?, ?, ?, 1, 'FF_WINNER', 'WINNER_IGN', 50.0, 'confirmed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(entryId, tourneyId, winnerPlayer.userId);

  const resultId = uuidv4();
  db.prepare(`
    INSERT INTO match_results (id, tournament_id, entry_id, user_id, claimed_rank, claimed_kills, screenshot_url, admin_confirmed_rank, admin_confirmed_kills, status, reviewed_by, reviewed_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, 1, 7, '/uploads/proof_winner.jpg', 1, 7, 'approved', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(resultId, tourneyId, entryId, winnerPlayer.userId, admin.userId);

  try {
    // 1. Admin triggers automated tournament payout distribution
    const payoutRes = await makeRequest(server, {
      method: 'POST',
      path: `/api/v1/tournaments/${tourneyId}/payouts/distribute`,
      token: admin.token,
    });
    assert(
      payoutRes.status === 200 &&
      payoutRes.data.data.totalWinners === 1 &&
      payoutRes.data.data.totalAmountPaid === 1070.0 && // ₹1000 rank + (7 * ₹10 kill) = ₹1070
      payoutRes.data.data.distributions[0].totalPrize === 1070.0,
      'Automated payout distributed ₹1,070.00 (₹1000 Rank 1 + ₹70 for 7 kills)'
    );

    // 2. Tournament status is updated to completed / cleaned up
    const tourneyRow = db.prepare('SELECT status FROM tournaments WHERE id = ?').get(tourneyId) as any;
    assert(!tourneyRow || tourneyRow.status === 'completed', 'Tournament status transitioned to completed / purged');

    // 3. Winner player's wallet balance is ₹1,070.00 and earnings recorded
    const balanceRes = await makeRequest(server, {
      method: 'GET',
      path: '/api/v1/wallet/summary',
      token: winnerPlayer.token,
    });
    assert(
      balanceRes.status === 200 && balanceRes.data.data.balance === 1070.0,
      'Winner wallet balance reflects ₹1,070.00 prize credit'
    );

    const profileRow = db.prepare('SELECT total_earnings FROM profiles WHERE user_id = ?').get(winnerPlayer.userId) as any;
    assert(profileRow.total_earnings === 1070.0, 'Player profile total_earnings updated to ₹1,070.00');

    // 4. Duplicate payout distribution on completed tournament is rejected
    const dupPayoutRes = await makeRequest(server, {
      method: 'POST',
      path: `/api/v1/tournaments/${tourneyId}/payouts/distribute`,
      token: admin.token,
    });
    assert(
      (dupPayoutRes.status === 400 && dupPayoutRes.data.code === 'PAYOUTS_ALREADY_DISTRIBUTED') ||
      dupPayoutRes.status === 404,
      'Duplicate payout distribution rejected'
    );

    // 5. Unverified KYC user blocked from withdrawal
    const kycBlockedRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/v1/wallet/withdraw/request',
      token: unverifiedPlayer.token,
      body: { amount: 200, payoutMethod: 'upi', upiId: 'test@upi' },
    });
    assert(kycBlockedRes.status === 403 && kycBlockedRes.data.code === 'KYC_NOT_VERIFIED', 'Unverified KYC user blocked from withdrawal (403)');

    // 6. Withdrawal exceeding balance rejected
    const excessRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/v1/wallet/withdraw/request',
      token: winnerPlayer.token,
      body: { amount: 5000, payoutMethod: 'upi', upiId: 'winner@okhdfcbank' },
    });
    assert(
      excessRes.status === 400 &&
      (excessRes.data.code === 'INSUFFICIENT_FUNDS' || excessRes.data.code === 'INSUFFICIENT_WINNINGS'),
      'Withdrawal exceeding wallet balance rejected'
    );

    // 7. Verified player requests ₹1,000 withdrawal with 30% TDS deduction
    const withdrawRes1 = await makeRequest(server, {
      method: 'POST',
      path: '/api/v1/wallet/withdraw/request',
      token: winnerPlayer.token,
      body: { amount: 1000, payoutMethod: 'upi', upiId: 'winner@okaxis' },
    });
    assert(
      withdrawRes1.status === 201 &&
      withdrawRes1.data.data.amount === 1000.0 &&
      withdrawRes1.data.data.tds_deducted === 300.0 && // 30% of ₹1000
      withdrawRes1.data.data.net_payable_amount === 700.0 && // ₹700 net
      withdrawRes1.data.data.status === 'pending',
      'Withdrawal requested for ₹1,000 with ₹300.00 (30%) TDS deducted and ₹700.00 net payout'
    );

    const withdrawal1Id = withdrawRes1.data.data.id;

    // 8. Player wallet balance is debited by gross ₹1000 (Remaining: ₹70.00)
    const afterDebitRes = await makeRequest(server, {
      method: 'GET',
      path: '/api/v1/wallet/summary',
      token: winnerPlayer.token,
    });
    assert(afterDebitRes.data.data.balance === 70.0, 'Player wallet balance reduced to ₹70.00 after withdrawal debit');

    // 9. Admin retrieves withdrawal queue and approves request
    const adminQueueRes = await makeRequest(server, {
      method: 'GET',
      path: '/api/v1/admin/withdrawals/queue?status=pending',
      token: admin.token,
    });
    assert(adminQueueRes.status === 200 && adminQueueRes.data.data.total >= 1, 'Admin retrieves pending withdrawal queue');

    const approveWithdrawRes = await makeRequest(server, {
      method: 'POST',
      path: `/api/v1/admin/withdrawals/${withdrawal1Id}/process`,
      token: admin.token,
      body: { decision: 'completed', payoutReferenceId: 'UTR_HDFC_99887766' },
    });
    assert(
      approveWithdrawRes.status === 200 &&
      approveWithdrawRes.data.data.status === 'completed' &&
      approveWithdrawRes.data.data.payout_reference_id === 'UTR_HDFC_99887766',
      'Admin approves withdrawal with UTR number'
    );

    // 10. Rejection & Refund Flow: Player has ₹500 prize credit, requests ₹500 withdrawal, admin rejects -> ₹500 refunded
    db.prepare(`
      INSERT INTO wallet_ledger (id, user_id, type, amount, reference_id, description, created_at)
      VALUES (?, ?, 'prize_credit', 500.0, 'PRIZE_TEST', 'Test prize winnings', CURRENT_TIMESTAMP)
    `).run(uuidv4(), winnerPlayer.userId);

    const withdrawRes2 = await makeRequest(server, {
      method: 'POST',
      path: '/api/v1/wallet/withdraw/request',
      token: winnerPlayer.token,
      body: {
        amount: 500,
        payoutMethod: 'bank_transfer',
        bankAccountNumber: '1234567890',
        bankIfsc: 'HDFC0001234',
        bankAccountHolderName: 'Winner Player',
      },
    });
    const withdrawal2Id = withdrawRes2.data.data.id;

    // Balance after debiting ₹500: ₹70 + ₹500 - ₹500 = ₹70
    const midBalance = db.prepare("SELECT SUM(CASE WHEN type IN ('deposit', 'prize_credit', 'refund') THEN amount ELSE -amount END) as bal FROM wallet_ledger WHERE user_id = ?").get(winnerPlayer.userId) as any;
    assert(midBalance.bal === 70.0, 'Balance is ₹70.00 while second withdrawal is pending');

    // Admin rejects second withdrawal
    const rejectWithdrawRes = await makeRequest(server, {
      method: 'POST',
      path: `/api/v1/admin/withdrawals/${withdrawal2Id}/process`,
      token: admin.token,
      body: { decision: 'rejected', rejectionReason: 'Invalid bank account number.' },
    });
    assert(
      rejectWithdrawRes.status === 200 &&
      rejectWithdrawRes.data.data.status === 'rejected',
      'Admin rejects second withdrawal request'
    );

    // Verify ₹500 was automatically refunded to wallet ledger -> Balance restored to ₹570.00
    const finalBalance = db.prepare("SELECT SUM(CASE WHEN type IN ('deposit', 'prize_credit', 'refund') THEN amount ELSE -amount END) as bal FROM wallet_ledger WHERE user_id = ?").get(winnerPlayer.userId) as any;
    assert(finalBalance.bal === 570.0, 'Gross amount ₹500.00 automatically refunded to wallet ledger upon rejection (Balance: ₹570.00)');

    // 11. Audit logs contain records
    const auditLogs = db.prepare("SELECT action FROM audit_logs WHERE action IN ('TOURNAMENT_PAYOUTS_DISTRIBUTED', 'WITHDRAWAL_REQUESTED', 'WITHDRAWAL_PROCESSED')").all() as any[];
    assert(auditLogs.length >= 4, 'Audit logs recorded payout distribution and withdrawal operations');

  } catch (err) {
    console.error('Unexpected test error:', err);
    failedCount++;
  } finally {
    server.close();
    DatabaseManager.close();
  }

  console.log(`\n================================`);
  console.log(`Total Passed: ${passedCount}`);
  console.log(`Total Failed: ${failedCount}`);
  console.log(`================================\n`);

  if (failedCount > 0) {
    process.exit(1);
  }
}

runPayoutWithdrawalTests();
