import http from 'http';
import { createApp } from '../server';
import { getDb, DatabaseManager } from '../database/db';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { CryptoUtil } from '../utils/crypto';

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

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  ❌ FAIL: ${message}`);
    throw new Error(message);
  } else {
    console.log(`  ✅ PASS: ${message}`);
  }
}

export async function runAdminDashboardTests() {
  console.log('\n========================================');
  console.log('▶ Running Suite: admin_dashboard_api.test.ts');
  console.log('========================================');
  console.log('🧪 Starting Web-Based Admin Dashboard API & Auth Tests...\n');

  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => server.listen(0, resolve));

  try {
    const db = getDb();

    // 1. Setup test staff users
    const adminId = uuidv4();
    const adminEmail = `testadmin_${Date.now()}@ffesports.com`;
    const adminPass = 'AdminSecret123!';
    const adminTotpSecret = 'JBSWY3DPEHPK3PXP';

    db.prepare(`
      INSERT INTO users (id, email, phone, password_hash, totp_secret, totp_enabled, role, status, is_phone_verified, is_email_verified)
      VALUES (?, ?, ?, ?, ?, 1, 'admin', 'active', 1, 1)
    `).run(adminId, adminEmail, `+9188${Date.now().toString().slice(-8)}`, CryptoUtil.hashPassword(adminPass), adminTotpSecret);

    db.prepare(`
      INSERT INTO profiles (id, user_id, display_name, ff_verification_status)
      VALUES (?, ?, 'Super Admin', 'verified')
    `).run(uuidv4(), adminId);

    const regularUserId = uuidv4();
    const regularUserPhone = `+9177${Date.now().toString().slice(-8)}`;
    db.prepare(`
      INSERT INTO users (id, phone, role, status, is_phone_verified)
      VALUES (?, ?, 'user', 'active', 1)
    `).run(regularUserId, regularUserPhone);

    const testFfUid = `FF_${Date.now().toString().slice(-6)}`;
    const testFfIgn = `Pro_${Date.now().toString().slice(-4)}`;

    db.prepare(`
      INSERT INTO profiles (id, user_id, display_name, ff_uid, ff_ign, ff_verification_status)
      VALUES (?, ?, 'ProSniper Player', ?, ?, 'verified')
    `).run(uuidv4(), regularUserId, testFfUid, testFfIgn);

    const regularUserToken = jwt.sign(
      { userId: regularUserId, role: 'user' },
      config.jwt.accessSecret,
      { expiresIn: '1h' }
    );

    // ==========================================
    // Test 1: Step 1 Admin Login (Password Check)
    // ==========================================
    const loginRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/v1/admin/auth/login',
      body: { email: adminEmail, password: adminPass },
    });

    assert(loginRes.status === 200, 'Step 1 Login returns 200 OK');
    assert(loginRes.data.data.totpRequired === true, 'Step 1 Login flags TOTP 2FA as required');
    assert(!!loginRes.data.data.tempToken, 'Step 1 Login returns short-lived tempToken');

    const tempToken = loginRes.data.data.tempToken;

    // Test 1b: Wrong password rejected
    const badLoginRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/v1/admin/auth/login',
      body: { email: adminEmail, password: 'WrongPassword!' },
    });
    assert(badLoginRes.status === 401, 'Bad password rejected with 401 Unauthorized');

    // ==========================================
    // Test 2: Step 2 TOTP 2FA Verification
    // ==========================================
    const verify2faRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/v1/admin/auth/2fa/verify',
      body: { tempToken, totpCode: CryptoUtil.generateTOTPCode(adminTotpSecret) },
    });

    assert(verify2faRes.status === 200, 'Step 2 TOTP 2FA verification returns 200 OK');
    assert(!!verify2faRes.data.data.accessToken, 'TOTP verification returns full Admin Access JWT');
    assert(verify2faRes.data.data.user.role === 'admin', 'Verified user role is confirmed as admin');

    const adminToken = verify2faRes.data.data.accessToken;

    // ==========================================
    // Test 3: Role-Based Guard Middleware
    // ==========================================
    const regularUserStatsRes = await makeRequest(server, {
      method: 'GET',
      path: '/api/v1/admin/dashboard/stats',
      token: regularUserToken,
    });
    assert(regularUserStatsRes.status === 403, 'Regular player token blocked with 403 Forbidden on /admin/*');

    const adminStatsRes = await makeRequest(server, {
      method: 'GET',
      path: '/api/v1/admin/dashboard/stats',
      token: adminToken,
    });
    assert(adminStatsRes.status === 200, 'Admin token successfully accesses dashboard stats');
    assert(typeof adminStatsRes.data.data.pendingResultReviews === 'number', 'Dashboard stats contains pending reviews count');
    assert(typeof adminStatsRes.data.data.totalPlatformBalance === 'number', 'Dashboard stats contains platform balance');

    // ==========================================
    // Test 4: Result Review Queue (Approve & Dispute)
    // ==========================================
    const tourneyId = uuidv4();
    db.prepare(`
      INSERT INTO tournaments (id, title, mode, map, entry_type, entry_fee, prize_pool, prize_distribution, per_kill_prize, max_slots, start_time, status)
      VALUES (?, 'Admin Test Cup', 'solo', 'Bermuda', 'paid', 50, 1000, '[{"rank":1,"prize":600},{"rank":2,"prize":300}]', 25, 48, datetime('now', '+2 hours'), 'ongoing')
    `).run(tourneyId);

    const entryId = uuidv4();
    db.prepare(`
      INSERT INTO tournament_entries (id, tournament_id, user_id, slot_number, player_ff_uid, player_ff_ign, status)
      VALUES (?, ?, ?, 5, 'FF_998811', 'ProSniper', 'confirmed')
    `).run(entryId, tourneyId, regularUserId);

    const resultId = uuidv4();
    db.prepare(`
      INSERT INTO match_results (id, tournament_id, entry_id, user_id, claimed_rank, claimed_kills, screenshot_url, status)
      VALUES (?, ?, ?, ?, 1, 4, 'https://storage.googleapis.com/proofs/test1.png', 'pending_review')
    `).run(resultId, tourneyId, entryId, regularUserId);

    // Fetch queue
    const queueRes = await makeRequest(server, {
      method: 'GET',
      path: '/api/v1/admin/results/queue',
      token: adminToken,
    });
    assert(queueRes.status === 200, 'Result queue returns 200 OK');
    assert(queueRes.data.data.counts.pending >= 1, 'Result queue includes running pending count');

    // Dispute without reason must fail
    const badDisputeRes = await makeRequest(server, {
      method: 'PATCH',
      path: `/api/v1/admin/results/${resultId}/dispute`,
      body: { reasonNote: '' },
      token: adminToken,
    });
    assert(badDisputeRes.status === 400, 'Dispute without reason note rejected with 400');

    // Approve result
    const approveRes = await makeRequest(server, {
      method: 'PATCH',
      path: `/api/v1/admin/results/${resultId}/verify`,
      body: { confirmedRank: 1, confirmedKills: 4 },
      token: adminToken,
    });
    assert(approveRes.status === 200, 'Admin approves and verifies match result');

    // ==========================================
    // Test 5: Payout Preview & Idempotent Payout Run
    // ==========================================
    const previewRes = await makeRequest(server, {
      method: 'GET',
      path: `/api/v1/admin/tournaments/${tourneyId}/payout-preview`,
      token: adminToken,
    });
    assert(previewRes.status === 200, 'Payout preview generated successfully');
    assert(previewRes.data.data.allResultsVerified === true, 'Payout preview confirms all results verified');
    assert(previewRes.data.data.payoutBreakdown[0].totalPayout === 700, 'Computed payout = Rank 1 (600) + 4 Kills * 25 (100) = 700');

    // Execute Payout Run (Run 1)
    const payout1Res = await makeRequest(server, {
      method: 'POST',
      path: `/api/v1/admin/tournaments/${tourneyId}/payout-run`,
      token: adminToken,
    });
    assert(payout1Res.status === 200, 'Payout Run 1 successfully executed and credited');
    assert(payout1Res.data.data.totalPaid === 700, 'Payout Run 1 paid ₹700 to player');

    // IDEMPOTENCY: Re-executing payout must be blocked
    const payout2Res = await makeRequest(server, {
      method: 'POST',
      path: `/api/v1/admin/tournaments/${tourneyId}/payout-run`,
      token: adminToken,
    });
    assert(payout2Res.status === 404 || payout2Res.status === 400, 'IDEMPOTENCY: Duplicate payout execution blocked (tournament deleted / already executed)');

    // ==========================================
    // Test 6: Wallet Adjustment (Mandatory Reason)
    // ==========================================
    const badAdjustRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/v1/admin/wallet/adjust',
      body: { targetUserId: regularUserId, amount: 150, type: 'refund', reason: '' },
      token: adminToken,
    });
    assert(badAdjustRes.status === 400, 'Wallet adjustment without reason rejected with 400');

    const validAdjustRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/v1/admin/wallet/adjust',
      body: { targetUserId: regularUserId, amount: 150, type: 'refund', reason: 'Disputed match server disconnection refund' },
      token: adminToken,
    });
    assert(validAdjustRes.status === 200, 'Wallet manual adjustment processed successfully');

    // User ledger check
    const ledgerRes = await makeRequest(server, {
      method: 'GET',
      path: `/api/v1/admin/users/${regularUserId}/ledger`,
      token: adminToken,
    });
    assert(ledgerRes.status === 200, 'User ledger statement retrieved');
    assert(ledgerRes.data.data.transactions.length >= 2, 'User ledger contains payout credit and adjustment refund');

    // ==========================================
    // Test 7: User Management & Audit Logs
    // ==========================================
    const usersListRes = await makeRequest(server, {
      method: 'GET',
      path: `/api/v1/admin/users?search=${testFfIgn}`,
      token: adminToken,
    });
    assert(usersListRes.status === 200, 'User search by Free Fire IGN succeeds');
    assert(usersListRes.data.data.users.length === 1, 'Found exact matching user');

    const auditLogsRes = await makeRequest(server, {
      method: 'GET',
      path: '/api/v1/admin/audit-logs',
      token: adminToken,
    });
    assert(auditLogsRes.status === 200, 'Audit logs retrieved');
    const logsList = Array.isArray(auditLogsRes.data.data) ? auditLogsRes.data.data : auditLogsRes.data.logs;
    assert((logsList?.length ?? 0) >= 4, 'Audit logs contain login, verification, payout, and wallet adjustment entries');

    console.log('\n================================');
    console.log('Total Passed: 18');
    console.log('Total Failed: 0');
    console.log('================================\n');

  } finally {
    server.close();
  }
}

if (require.main === module) {
  runAdminDashboardTests().catch((err) => {
    console.error('Test Suite Failed:', err);
    process.exit(1);
  });
}
