import http from 'http';
import { createApp } from '../server';
import { getDb, DatabaseManager } from '../database/db';
import { RoomRevealWorker } from '../modules/scheduler/room_reveal.worker';
import { NotificationService } from '../modules/scheduler/notification.service';
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

async function runRoomRevealTests() {
  console.log('🧪 Starting Step 5: Room Reveal Scheduled Worker Automated Tests...\n');
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
    const phone = `93${rand}${phoneSuffix}`;
    db.prepare(`
      INSERT INTO users (id, phone, role, status, is_phone_verified, is_email_verified, created_at, updated_at)
      VALUES (?, ?, ?, 'active', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(uId, phone, role);

    db.prepare(`
      INSERT INTO profiles (id, user_id, display_name, ff_uid, ff_ign, ff_verification_status, created_at, updated_at)
      VALUES (?, ?, 'Player_${phoneSuffix}', 'FF_REV_${rand}_${phoneSuffix}', 'IGN_${phoneSuffix}', 'verified', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(uuidv4(), uId);

    const token = jwt.sign({ userId: uId, role, phone }, config.jwt.accessSecret, { expiresIn: '1h' });
    return { userId: uId, token, phone };
  }

  const joinedUser = createUser('01');
  const nonJoinedUser = createUser('02');
  const adminUser = createUser('99', 'admin');

  // Create Tournament A: Starting in 10 minutes (reveal threshold 15m -> eligible for reveal!)
  const tourneyAId = uuidv4();
  const startTimeA = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 mins in future

  db.prepare(`
    INSERT INTO tournaments (
      id, title, game, mode, map, entry_type, entry_fee, prize_pool, prize_distribution, 
      max_slots, filled_slots, start_time, room_reveal_time_minutes, room_id, room_password, room_revealed, status, created_at, updated_at
    ) VALUES (
      ?, 'Apex Bermuda Clash', 'Free Fire', 'solo', 'Bermuda', 'free', 0.0, 1000.0, '[]', 
      48, 1, ?, 15, 'FF_ROOM_101', 'PASS_9988', 0, 'upcoming', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `).run(tourneyAId, startTimeA);

  // Register joinedUser into Tournament A (Slot 7)
  db.prepare(`
    INSERT INTO tournament_entries (
      id, tournament_id, user_id, slot_number, player_ff_uid, player_ff_ign, entry_fee_paid, status, created_at, updated_at
    ) VALUES (
      ?, ?, ?, 7, 'FF_REV_${rand}_01', 'IGN_01', 0.0, 'confirmed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `).run(uuidv4(), tourneyAId, joinedUser.userId);

  // Create Tournament B: Starting in 3 hours (NOT yet eligible for auto-reveal)
  const tourneyBId = uuidv4();
  const startTimeB = new Date(Date.now() + 3 * 3600 * 1000).toISOString();

  db.prepare(`
    INSERT INTO tournaments (
      id, title, game, mode, map, entry_type, entry_fee, prize_pool, prize_distribution, 
      max_slots, filled_slots, start_time, room_reveal_time_minutes, room_id, room_password, room_revealed, status, created_at, updated_at
    ) VALUES (
      ?, 'Future Squad Championship', 'Free Fire', 'squad', 'Purgatory', 'free', 0.0, 5000.0, '[]', 
      48, 0, ?, 15, 'FF_ROOM_202', 'PASS_SECRET', 0, 'upcoming', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `).run(tourneyBId, startTimeB);

  // Create Tournament C: Start time is 1 minute in the past (eligible for transition to 'ongoing')
  const tourneyCId = uuidv4();
  const startTimeC = new Date(Date.now() - 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO tournaments (
      id, title, game, mode, map, entry_type, entry_fee, prize_pool, prize_distribution, 
      max_slots, filled_slots, start_time, room_reveal_time_minutes, room_id, room_password, room_revealed, status, created_at, updated_at
    ) VALUES (
      ?, 'Live Active Match', 'Free Fire', 'solo', 'Kalahari', 'free', 0.0, 1000.0, '[]', 
      48, 12, ?, 15, 'FF_ROOM_303', 'PASS_303', 1, 'open', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `).run(tourneyCId, startTimeC);

  try {
    // 1. Non-joined user is denied entry to room
    const deniedRes = await makeRequest(server, {
      method: 'GET',
      path: `/api/v1/tournaments/${tourneyAId}/room`,
      token: nonJoinedUser.token,
    });
    assert(deniedRes.status === 403 && deniedRes.data.code === 'FORBIDDEN_NOT_JOINED', 'Non-joined user forbidden from match room (403)');

    // 2. Joined user queries room BEFORE worker runs -> receives isRevealed: false and null credentials
    const preRevealRes = await makeRequest(server, {
      method: 'GET',
      path: `/api/v1/tournaments/${tourneyAId}/room`,
      token: joinedUser.token,
    });
    assert(
      preRevealRes.status === 200 &&
      preRevealRes.data.data.isRevealed === false &&
      preRevealRes.data.data.roomId === null &&
      preRevealRes.data.data.slotNumber === 7,
      'Joined user receives redacted room details prior to reveal threshold execution'
    );

    // 3. Admin can always view room credentials
    const adminViewRes = await makeRequest(server, {
      method: 'GET',
      path: `/api/v1/tournaments/${tourneyAId}/room`,
      token: adminUser.token,
    });
    assert(
      adminViewRes.status === 200 &&
      adminViewRes.data.data.isRevealed === true &&
      adminViewRes.data.data.roomId === 'FF_ROOM_101',
      'Admin can view room credentials at any time'
    );

    // 4. Execute RoomRevealWorker cycle
    const workerResult = await RoomRevealWorker.checkAndRevealRooms();
    assert(
      workerResult.revealedCount >= 1 &&
      workerResult.revealedTournaments.includes(tourneyAId) &&
      !workerResult.revealedTournaments.includes(tourneyBId),
      'RoomRevealWorker automatically unlocks Tournament A and leaves Tournament B hidden'
    );

    // 5. Notification Hook: Verify push notification was sent to joinedUser
    const deliveredNotifs = (await NotificationService.getUserNotifications(joinedUser.userId)).notifications;
    const tourneyANotif = deliveredNotifs.find((n: any) => n.user_id === joinedUser.userId || n.userId === joinedUser.userId);
    assert(
      !!tourneyANotif &&
      tourneyANotif.body.includes('FF_ROOM_101') &&
      (tourneyANotif.body.includes('Slot #7') || tourneyANotif.body.includes('Slot: #7')),
      'Push notification dispatched to joined player with Room ID, Password, and Slot Number'
    );

    // 6. Joined user queries room AFTER worker runs -> receives full room credentials
    const postRevealRes = await makeRequest(server, {
      method: 'GET',
      path: `/api/v1/tournaments/${tourneyAId}/room`,
      token: joinedUser.token,
    });
    assert(
      postRevealRes.status === 200 &&
      postRevealRes.data.data.isRevealed === true &&
      postRevealRes.data.data.roomId === 'FF_ROOM_101' &&
      postRevealRes.data.data.roomPassword === 'PASS_9988',
      'Joined user successfully accesses unlocked Room ID & Password'
    );

    // 7. Admin triggers manual early reveal for Tournament B
    const manualRevealRes = await makeRequest(server, {
      method: 'POST',
      path: `/api/v1/tournaments/${tourneyBId}/reveal-now`,
      token: adminUser.token,
    });
    assert(manualRevealRes.status === 200 && manualRevealRes.data.success === true, 'Admin successfully triggers manual early room reveal');

    // 8. Match lifecycle transition to 'ongoing'
    assert(
      workerResult.ongoingCount >= 1 && workerResult.ongoingTournaments.includes(tourneyCId),
      'RoomRevealWorker transitions started match to ongoing status'
    );

    const tourneyCRow = db.prepare('SELECT status FROM tournaments WHERE id = ?').get(tourneyCId) as any;
    assert(tourneyCRow.status === 'ongoing', 'Tournament status in database is updated to ongoing');

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

runRoomRevealTests();
