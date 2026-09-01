import http from 'http';
import { createApp } from '../server';
import { getDb, DatabaseManager } from '../database/db';
import { BookingService } from '../modules/booking/booking.service';
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

async function runBookingTests() {
  console.log('🧪 Starting Step 3: Slot Booking & Concurrency Automated Tests...\n');
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

  // Helper to create verified user with profile
  function createUser(phoneSuffix: string, ign: string, withFfUid: boolean = true) {
    const uId = uuidv4();
    const phone = `97${rand}${phoneSuffix}`;
    db.prepare(`
      INSERT INTO users (id, phone, role, status, is_phone_verified, is_email_verified, created_at, updated_at)
      VALUES (?, ?, 'user', 'active', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(uId, phone);

    const ffUid = withFfUid ? `FF_${rand}_${phoneSuffix}` : null;
    db.prepare(`
      INSERT INTO profiles (id, user_id, display_name, ff_uid, ff_ign, ff_verification_status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'verified', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(uuidv4(), uId, ign, ffUid, withFfUid ? ign : null);

    const token = jwt.sign({ userId: uId, role: 'user', phone }, config.jwt.accessSecret, { expiresIn: '1h' });
    return { userId: uId, token, phone, ffUid };
  }

  const user1 = createUser('01', 'SniperGod');
  const user2 = createUser('02', 'ShadowKing');
  const user3 = createUser('03', 'ProPlayer');
  const userNoFF = createUser('04', 'NoobPlayer', false);

  const startPaid = new Date(Date.now() + 2 * 3600 * 1000).toISOString();
  const startFree = new Date(Date.now() + 3 * 3600 * 1000).toISOString();

  // Create Paid Tournament
  const paidTournamentId = uuidv4();
  db.prepare(`
    INSERT INTO tournaments (
      id, title, game, mode, map, entry_type, entry_fee, prize_pool, prize_distribution, 
      max_slots, filled_slots, start_time, room_reveal_time_minutes, status, created_at, updated_at
    ) VALUES (
      ?, 'Championship Paid Solo', 'Free Fire', 'solo', 'Bermuda', 'paid', 50.0, 2000.0, '[]', 
      48, 0, ?, 15, 'upcoming', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `).run(paidTournamentId, startPaid);

  // Create Free Tournament
  const freeTournamentId = uuidv4();
  db.prepare(`
    INSERT INTO tournaments (
      id, title, game, mode, map, entry_type, entry_fee, prize_pool, prize_distribution, 
      max_slots, filled_slots, start_time, room_reveal_time_minutes, status, created_at, updated_at
    ) VALUES (
      ?, 'Free Community Cup', 'Free Fire', 'solo', 'Purgatory', 'free', 0.0, 500.0, '[]', 
      48, 0, ?, 15, 'upcoming', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `).run(freeTournamentId, startFree);

  try {
    // 1. User without FF UID linked is rejected
    const noFfRes = await makeRequest(server, {
      method: 'POST',
      path: `/api/v1/tournaments/${paidTournamentId}/book`,
      token: userNoFF.token,
      body: { slotNumber: 1 },
    });
    assert(noFfRes.status === 400 && noFfRes.data.code === 'FF_UID_REQUIRED', 'User without Free Fire UID rejected from booking');

    // 2. Paid match with 0 balance is rejected
    const zeroBalanceRes = await makeRequest(server, {
      method: 'POST',
      path: `/api/v1/tournaments/${paidTournamentId}/book`,
      token: user1.token,
      body: { slotNumber: 5 },
    });
    assert(zeroBalanceRes.status === 400 && zeroBalanceRes.data.code === 'INSUFFICIENT_WALLET_BALANCE', 'Booking paid match with zero balance rejected');

    // 3. User 1 deposits ₹200 into wallet ledger
    BookingService.recordDeposit(user1.userId, 200.0, `TEST_DEP_${rand}`);
    const balUser1 = BookingService.getUserWalletBalance(user1.userId);
    assert(balUser1 === 200.0, 'User 1 wallet balance reflects ₹200.00 deposit');

    // 4. User 1 successfully books Slot #5 in Paid Tournament (₹50 fee debited)
    const bookRes1 = await makeRequest(server, {
      method: 'POST',
      path: `/api/v1/tournaments/${paidTournamentId}/book`,
      token: user1.token,
      body: { slotNumber: 5 },
    });
    assert(bookRes1.status === 201 && bookRes1.data.data.slot_number === 5, 'User 1 successfully books Slot #5');

    const balAfterBook1 = BookingService.getUserWalletBalance(user1.userId);
    assert(balAfterBook1 === 150.0, 'User 1 wallet atomically debited ₹50 (Balance: ₹150.00)');

    // 5. CONCURRENCY & DOUBLE BOOKING PREVENTION TEST: User 2 attempts to book the SAME Slot #5
    BookingService.recordDeposit(user2.userId, 100.0);
    const doubleBookRes = await makeRequest(server, {
      method: 'POST',
      path: `/api/v1/tournaments/${paidTournamentId}/book`,
      token: user2.token,
      body: { slotNumber: 5 },
    });
    assert(doubleBookRes.status === 409 && doubleBookRes.data.code === 'SLOT_ALREADY_TAKEN', 'CONCURRENCY: Double booking same Slot #5 rejected with 409 Conflict');

    // 6. User 2 books available Slot #6
    const bookRes2 = await makeRequest(server, {
      method: 'POST',
      path: `/api/v1/tournaments/${paidTournamentId}/book`,
      token: user2.token,
      body: { slotNumber: 6 },
    });
    assert(bookRes2.status === 201 && bookRes2.data.data.slot_number === 6, 'User 2 successfully books available Slot #6');

    // 7. DUPLICATE REGISTRATION TEST: User 1 attempts to book another slot in same tournament
    const duplicateRes = await makeRequest(server, {
      method: 'POST',
      path: `/api/v1/tournaments/${paidTournamentId}/book`,
      token: user1.token,
      body: { slotNumber: 7 },
    });
    assert(duplicateRes.status === 409 && duplicateRes.data.code === 'ALREADY_REGISTERED', 'Same user duplicate booking in same match rejected');

    // 8. User 3 joins Free Tournament (0 entry fee)
    const freeBookRes = await makeRequest(server, {
      method: 'POST',
      path: `/api/v1/tournaments/${freeTournamentId}/book`,
      token: user3.token,
      body: { slotNumber: 12 },
    });
    assert(freeBookRes.status === 201 && freeBookRes.data.data.entry_fee_paid === 0, 'User 3 joins Free Tournament with 0 wallet fee');

    // 9. Inspect interactive slot grid
    const gridRes = await makeRequest(server, {
      method: 'GET',
      path: `/api/v1/tournaments/${paidTournamentId}/slots`,
      token: user1.token,
    });
    assert(
      gridRes.status === 200 &&
      gridRes.data.data.filledSlots === 2 &&
      gridRes.data.data.currentUserBookedSlot === 5 &&
      gridRes.data.data.slots.find((s: any) => s.slotNumber === 5).status === 'booked' &&
      gridRes.data.data.slots.find((s: any) => s.slotNumber === 7).status === 'available',
      'Slot grid accurately reflects booked vs available slots'
    );

    // 10. User retrieves "My Matches"
    const myMatchesRes = await makeRequest(server, {
      method: 'GET',
      path: '/api/v1/tournaments/user/my-bookings',
      token: user1.token,
    });
    assert(myMatchesRes.status === 200 && myMatchesRes.data.count >= 1, 'User retrieves list of joined tournament matches');

    // 11. User 1 cancels booking for Paid Tournament -> Slot released & ₹50 refunded
    const cancelRes = await makeRequest(server, {
      method: 'POST',
      path: `/api/v1/tournaments/${paidTournamentId}/cancel-booking`,
      token: user1.token,
    });
    assert(cancelRes.status === 200 && cancelRes.data.data.refundedAmount === 50, 'Booking cancelled and ₹50 refunded');

    const balAfterRefund = BookingService.getUserWalletBalance(user1.userId);
    assert(balAfterRefund === 200.0, 'User 1 wallet balance restored to ₹200.00 after cancellation');

    // 12. Slot #5 is now available again for other players
    BookingService.recordDeposit(user3.userId, 100.0);
    const bookFreedSlotRes = await makeRequest(server, {
      method: 'POST',
      path: `/api/v1/tournaments/${paidTournamentId}/book`,
      token: user3.token,
      body: { slotNumber: 5 },
    });
    assert(bookFreedSlotRes.status === 201 && bookFreedSlotRes.data.data.slot_number === 5, 'Freed Slot #5 can now be booked by another player');

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

runBookingTests();
