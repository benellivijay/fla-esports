process.env.NODE_ENV = 'test';
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

async function runResultsTests() {
  console.log('🧪 Starting Step 6: Result Submission + Admin Review Queue Automated Tests...\n');
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
  function createUser(phoneSuffix: string, role: 'user' | 'admin' = 'user') {
    const uId = uuidv4();
    const phone = `95${rand}${phoneSuffix}`;
    db.prepare(`
      INSERT INTO users (id, phone, role, status, is_phone_verified, is_email_verified, created_at, updated_at)
      VALUES (?, ?, ?, 'active', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(uId, phone, role);

    db.prepare(`
      INSERT INTO profiles (id, user_id, display_name, ff_uid, ff_ign, ff_verification_status, matches_played, wins, total_kills, created_at, updated_at)
      VALUES (?, ?, 'Player_${phoneSuffix}', 'FF_RES_${rand}_${phoneSuffix}', 'IGN_${phoneSuffix}', 'verified', 0, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(uuidv4(), uId);

    const token = jwt.sign({ userId: uId, role, phone }, config.jwt.accessSecret, { expiresIn: '1h' });
    return { userId: uId, token, phone };
  }

  const player1 = createUser('01');
  const player2 = createUser('02');
  const outsider = createUser('03');
  const admin = createUser('99', 'admin');

  // Create completed tournament
  const tourneyId = uuidv4();
  db.prepare(`
    INSERT INTO tournaments (
      id, title, game, mode, map, entry_type, entry_fee, prize_pool, prize_distribution, 
      max_slots, filled_slots, start_time, room_reveal_time_minutes, room_id, room_password, room_revealed, status, created_at, updated_at
    ) VALUES (
      ?, 'Champions Cup Season 1', 'Free Fire', 'solo', 'Bermuda', 'paid', 50.0, 3000.0, '[]', 
      48, 2, datetime('now', '-1 hour'), 15, 'ROOM_CC1', 'PASS_CC1', 1, 'ongoing', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `).run(tourneyId);

  // Register player1 (Slot 1) and player2 (Slot 2)
  const entry1Id = uuidv4();
  db.prepare(`
    INSERT INTO tournament_entries (
      id, tournament_id, user_id, slot_number, player_ff_uid, player_ff_ign, entry_fee_paid, status, created_at, updated_at
    ) VALUES (?, ?, ?, 1, 'FF_RES_${rand}_01', 'IGN_01', 50.0, 'confirmed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(entry1Id, tourneyId, player1.userId);

  const entry2Id = uuidv4();
  db.prepare(`
    INSERT INTO tournament_entries (
      id, tournament_id, user_id, slot_number, player_ff_uid, player_ff_ign, entry_fee_paid, status, created_at, updated_at
    ) VALUES (?, ?, ?, 2, 'FF_RES_${rand}_02', 'IGN_02', 50.0, 'confirmed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(entry2Id, tourneyId, player2.userId);

  try {
    // 1. Non-participant is rejected from submitting result
    const nonPartRes = await makeRequest(server, {
      method: 'POST',
      path: `/api/v1/tournaments/${tourneyId}/results/submit`,
      token: outsider.token,
      body: { claimedRank: 1, claimedKills: 5, screenshotUrl: '/uploads/fake.png' },
    });
    assert(nonPartRes.status === 403 && nonPartRes.data.code === 'FORBIDDEN_NOT_PARTICIPANT', 'Non-participant blocked from result submission (403)');

    // 2. Player 1 submits match result (Rank 1, 7 kills)
    const submitRes1 = await makeRequest(server, {
      method: 'POST',
      path: `/api/v1/tournaments/${tourneyId}/results/submit`,
      token: player1.token,
      body: { claimedRank: 1, claimedKills: 7, screenshotUrl: '/uploads/proof_winner.jpg' },
    });
    assert(
      submitRes1.status === 201 &&
      submitRes1.data.data.claimed_rank === 1 &&
      submitRes1.data.data.claimed_kills === 7 &&
      submitRes1.data.data.status === 'pending_review',
      'Player 1 successfully submits result claim with screenshot proof'
    );

    const result1Id = submitRes1.data.data.id;

    // 3. Duplicate submission rejected
    const duplicateRes = await makeRequest(server, {
      method: 'POST',
      path: `/api/v1/tournaments/${tourneyId}/results/submit`,
      token: player1.token,
      body: { claimedRank: 1, claimedKills: 7, screenshotUrl: '/uploads/proof_winner.jpg' },
    });
    assert(duplicateRes.status === 409 && duplicateRes.data.code === 'ALREADY_SUBMITTED', 'Duplicate result submission rejected with 409 Conflict');

    // 4. Player retrieves their submission status
    const mySubRes = await makeRequest(server, {
      method: 'GET',
      path: `/api/v1/tournaments/${tourneyId}/results/my-submission`,
      token: player1.token,
    });
    assert(
      mySubRes.status === 200 && mySubRes.data.data.status === 'pending_review',
      'Player retrieves their submitted result status'
    );

    // 5. Regular user forbidden from admin review queue
    const forbiddenQueueRes = await makeRequest(server, {
      method: 'GET',
      path: '/api/v1/admin/results/queue',
      token: player1.token,
    });
    assert(forbiddenQueueRes.status === 403, 'Regular player blocked from admin results queue (403)');

    // 6. Admin accesses results review queue
    const queueRes = await makeRequest(server, {
      method: 'GET',
      path: `/api/v1/admin/results/queue?tournamentId=${tourneyId}`,
      token: admin.token,
    });
    assert(
      queueRes.status === 200 &&
      queueRes.data.data.total >= 1 &&
      queueRes.data.data.queue[0].screenshot_url === '/uploads/proof_winner.jpg',
      'Admin retrieves pending results review queue with screenshot proofs'
    );

    // 7. Admin approves Player 1 submission (Confirmed Rank 1, 7 Kills)
    const approveRes = await makeRequest(server, {
      method: 'POST',
      path: `/api/v1/admin/results/${result1Id}/review`,
      token: admin.token,
      body: { decision: 'approved', confirmedRank: 1, confirmedKills: 7 },
    });
    assert(
      approveRes.status === 200 &&
      approveRes.data.data.status === 'approved' &&
      approveRes.data.data.admin_confirmed_rank === 1 &&
      approveRes.data.data.admin_confirmed_kills === 7,
      'Admin approves Player 1 result claim'
    );

    // 8. Player 1 profile statistics automatically increment
    const profileRow = db.prepare('SELECT matches_played, wins, total_kills FROM profiles WHERE user_id = ?').get(player1.userId) as any;
    assert(
      profileRow.matches_played === 1 && profileRow.wins === 1 && profileRow.total_kills === 7,
      'Player 1 profile statistics incremented (Matches: 1, Wins: 1, Kills: 7)'
    );

    // 9. Player 2 submits result and Admin rejects with reason
    const submitRes2 = await makeRequest(server, {
      method: 'POST',
      path: `/api/v1/tournaments/${tourneyId}/results/submit`,
      token: player2.token,
      body: { claimedRank: 2, claimedKills: 3, screenshotUrl: '/uploads/proof_p2.jpg' },
    });
    const result2Id = submitRes2.data.data.id;

    const rejectRes = await makeRequest(server, {
      method: 'POST',
      path: `/api/v1/admin/results/${result2Id}/review`,
      token: admin.token,
      body: { decision: 'rejected', rejectionReason: 'Screenshot is blurry and UID is not visible.' },
    });
    assert(
      rejectRes.status === 200 &&
      rejectRes.data.data.status === 'rejected' &&
      rejectRes.data.data.rejection_reason === 'Screenshot is blurry and UID is not visible.',
      'Admin rejects Player 2 claim with documented reason'
    );

    // 10. Audit log contains result actions
    const auditLogs = db.prepare("SELECT action FROM audit_logs WHERE action IN ('RESULT_SUBMITTED', 'RESULT_REVIEWED')").all() as any[];
    assert(auditLogs.length >= 3, 'Audit log recorded result submission and review operations');

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

runResultsTests();
