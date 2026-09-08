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

async function runAdminRoomManagementTests() {
  console.log('🧪 Starting Admin Pre-Match Room ID/Password Management & Reveal Tests...\n');
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
  function createUser(suffix: string, role: 'user' | 'admin' = 'user') {
    const uId = uuidv4();
    const phone = `94${rand}${suffix}`;
    db.prepare(`
      INSERT INTO users (id, phone, role, status, is_phone_verified, is_email_verified, created_at, updated_at)
      VALUES (?, ?, ?, 'active', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(uId, phone, role);

    db.prepare(`
      INSERT INTO profiles (id, user_id, display_name, ff_uid, ff_ign, ff_verification_status, created_at, updated_at)
      VALUES (?, ?, 'User_${suffix}', 'FF_RM_${rand}_${suffix}', 'IGN_${suffix}', 'verified', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(uuidv4(), uId);

    // Give user funds
    db.prepare(`
      INSERT INTO wallet_ledger (id, user_id, type, amount, reference_id, description, created_at)
      VALUES (?, ?, 'deposit', 500.0, 'SEED', 'Seed balance', CURRENT_TIMESTAMP)
    `).run(uuidv4(), uId);

    const token = jwt.sign({ userId: uId, role, phone }, config.jwt.accessSecret, { expiresIn: '1h' });
    return { userId: uId, token, phone };
  }

  const admin = createUser('99', 'admin');
  const player = createUser('01', 'user');

  try {
    // 1. Create tournament with NO room_id or room_password (empty/null)
    const createRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/v1/tournaments',
      token: admin.token,
      body: {
        title: 'Free Fire Weekend Clash (Room Not Set Yet)',
        game: 'Free Fire',
        mode: 'solo',
        map: 'Bermuda',
        entryType: 'paid',
        entryFee: 50.0,
        prizePool: 1000.0,
        prizeDistribution: [{ rank: 1, amount: 1000.0 }],
        perKillPrize: 0,
        maxSlots: 48,
        startTime: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
        roomRevealTimeMinutes: 15,
        // Notice: No roomId or roomPassword provided
      },
    });

    assert(
      createRes.status === 201 && createRes.data.data.room_id === null,
      'Tournament created successfully without room credentials (room_id is null)'
    );
    const tournamentId = createRes.data.data.id;

    // 2. Player joins tournament slot before room is set
    const bookRes = await makeRequest(server, {
      method: 'POST',
      path: `/api/v1/tournaments/${tournamentId}/book`,
      token: player.token,
      body: { slotNumber: 1 },
    });
    assert(bookRes.status === 201, 'Player can book a slot in a published tournament before room credentials are set');

    // 3. Attempt to reveal room before credentials are set (must fail gracefully)
    const earlyRevealRes = await makeRequest(server, {
      method: 'POST',
      path: `/api/v1/tournaments/${tournamentId}/reveal-now`,
      token: admin.token,
    });
    assert(
      earlyRevealRes.status === 400 && earlyRevealRes.data.code === 'ROOM_DETAILS_NOT_SET',
      'Reveal endpoint rejects reveal when room credentials are not set yet (400 ROOM_DETAILS_NOT_SET)'
    );

    // 4. Regular player blocked from setting room credentials
    const forbiddenRes = await makeRequest(server, {
      method: 'PATCH',
      path: `/api/v1/admin/tournaments/${tournamentId}/room`,
      token: player.token,
      body: { roomId: '999999' },
    });
    assert(forbiddenRes.status === 403, 'Regular player blocked from admin room management endpoint (403)');

    // 5. Admin sets Room ID and Password via PATCH /admin/tournaments/:id/room
    const setRoomRes = await makeRequest(server, {
      method: 'PATCH',
      path: `/api/v1/admin/tournaments/${tournamentId}/room`,
      token: admin.token,
      body: {
        roomId: 'FF_ROOM_101',
        roomPassword: 'PASS_ALPHA_99',
      },
    });
    assert(
      setRoomRes.status === 200 &&
      setRoomRes.data.data.room_id === 'FF_ROOM_101' &&
      setRoomRes.data.data.room_password === 'PASS_ALPHA_99' &&
      setRoomRes.data.data.room_revealed === false &&
      setRoomRes.data.data.room_updated_at !== null,
      'Admin successfully sets Room ID & Password independently before reveal'
    );

    // Verify player still CANNOT see room credentials because room is not revealed yet
    const playerGetRes = await makeRequest(server, {
      method: 'GET',
      path: `/api/v1/tournaments/${tournamentId}`,
      token: player.token,
    });
    assert(
      playerGetRes.data.data.room_id === null && playerGetRes.data.data.room_password === null,
      'Separation of Concerns: Player cannot see room credentials before reveal even after admin sets them'
    );

    // 6. Admin updates / overwrites room credentials (e.g. lobby recreated)
    const updateRoomRes = await makeRequest(server, {
      method: 'PATCH',
      path: `/api/v1/admin/tournaments/${tournamentId}/room`,
      token: admin.token,
      body: {
        roomId: 'FF_ROOM_102_RECREATED',
        roomPassword: 'PASS_BETA_88',
      },
    });
    assert(
      updateRoomRes.status === 200 && updateRoomRes.data.data.room_id === 'FF_ROOM_102_RECREATED',
      'Admin can update room credentials multiple times before match start'
    );

    // 7. Admin reveals room credentials to players
    const revealRes = await makeRequest(server, {
      method: 'POST',
      path: `/api/v1/tournaments/${tournamentId}/reveal-now`,
      token: admin.token,
    });
    assert(revealRes.status === 200, 'Admin successfully reveals room credentials to players');

    // Verify player can now see room credentials
    const playerRoomRes = await makeRequest(server, {
      method: 'GET',
      path: `/api/v1/tournaments/${tournamentId}/room`,
      token: player.token,
    });
    assert(
      playerRoomRes.data.data.isRevealed === true &&
      playerRoomRes.data.data.roomId === 'FF_ROOM_102_RECREATED' &&
      playerRoomRes.data.data.roomPassword === 'PASS_BETA_88',
      'Player can now access revealed Room ID and Password'
    );

    // 8. Attempt room update when match is ongoing / started without force flag
    // Set match status to 'ongoing' and start_time in the past to simulate mid-match
    db.prepare(`
      UPDATE tournaments 
      SET status = 'ongoing', start_time = datetime('now', '-10 minutes') 
      WHERE id = ?
    `).run(tournamentId);

    const midMatchBlockedRes = await makeRequest(server, {
      method: 'PATCH',
      path: `/api/v1/admin/tournaments/${tournamentId}/room`,
      token: admin.token,
      body: { roomId: 'FF_ROOM_MID_MATCH' },
    });
    assert(
      midMatchBlockedRes.status === 400 && midMatchBlockedRes.data.code === 'MATCH_ALREADY_STARTED',
      'Safeguard: Block mid-match room overwrite when match is started & revealed without force flag (400 MATCH_ALREADY_STARTED)'
    );

    // 9. Force update room after match started (e.g. lobby crash requiring restart)
    const forceUpdateRes = await makeRequest(server, {
      method: 'PATCH',
      path: `/api/v1/admin/tournaments/${tournamentId}/room`,
      token: admin.token,
      body: {
        roomId: 'FF_ROOM_EMERGENCY_RESTART',
        roomPassword: 'EMERGENCY_PASS',
        forceUpdateAfterStart: true,
      },
    });
    assert(
      forceUpdateRes.status === 200 && forceUpdateRes.data.data.room_id === 'FF_ROOM_EMERGENCY_RESTART',
      'Admin can force update room credentials mid-match with forceUpdateAfterStart: true'
    );

    // 10. Verify audit log entry was created for room updates
    const auditRow = db.prepare(`
      SELECT * FROM audit_logs 
      WHERE target_id = ? AND action = 'ROOM_CREDENTIALS_UPDATED' 
      ORDER BY rowid DESC LIMIT 1
    `).get(tournamentId) as any;
    assert(
      auditRow && auditRow.actor_id === admin.userId && JSON.parse(auditRow.details).forceUpdate === true,
      'Audit log tracks room credentials update with admin attribution and force update flag'
    );

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

runAdminRoomManagementTests();
