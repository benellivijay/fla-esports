process.env.NODE_ENV = 'test';
import http from 'http';
import { createApp } from '../server';
import { getDb, DatabaseManager } from '../database/db';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { NotificationService } from '../modules/scheduler/notification.service';

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

async function runNotificationTests() {
  console.log('🧪 Starting Step 8: Push Notifications & Device Token Registry Automated Tests...\n');
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
      VALUES (?, ?, 'User_${phoneSuffix}', 'FF_NT_${rand}_${phoneSuffix}', 'IGN_${phoneSuffix}', 'verified', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(uuidv4(), uId);

    const token = jwt.sign({ userId: uId, role, phone }, config.jwt.accessSecret, { expiresIn: '1h' });
    return { userId: uId, token, phone };
  }

  const player1 = createUser('01');
  const player2 = createUser('02');
  const admin = createUser('99', 'admin');

  try {
    const mockFcmToken1 = `fcm_token_device_alpha_${rand}`;
    const mockFcmToken2 = `fcm_token_device_beta_${rand}`;

    // 1. Register FCM device token
    const regRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/v1/notifications/device-token',
      token: player1.token,
      body: {
        token: mockFcmToken1,
        platform: 'android',
        deviceInfo: 'OnePlus 11 (Android 14)',
      },
    });
    assert(regRes.status === 200 && regRes.data.success === true, 'FCM Device Token registered successfully');

    const tokenRow = db.prepare('SELECT * FROM device_tokens WHERE token = ?').get(mockFcmToken1) as any;
    assert(tokenRow && tokenRow.user_id === player1.userId, 'Device token verified in database');

    // 2. Register second device for same player (multi-device support)
    await makeRequest(server, {
      method: 'POST',
      path: '/api/v1/notifications/device-token',
      token: player1.token,
      body: {
        token: mockFcmToken2,
        platform: 'ios',
        deviceInfo: 'iPad Pro (iOS 17)',
      },
    });
    const playerTokens = db.prepare('SELECT COUNT(*) as count FROM device_tokens WHERE user_id = ?').get(player1.userId) as any;
    assert(playerTokens.count === 2, 'Multi-device support: Player has 2 active device tokens');

    // 3. Unregister device token (logout simulation)
    const unregRes = await makeRequest(server, {
      method: 'DELETE',
      path: '/api/v1/notifications/device-token',
      token: player1.token,
      body: { token: mockFcmToken2 },
    });
    assert(unregRes.status === 200, 'Device token unregistered on logout');
    const remainingTokens = db.prepare('SELECT COUNT(*) as count FROM device_tokens WHERE user_id = ?').get(player1.userId) as any;
    assert(remainingTokens.count === 1, 'Only active device token remains registered');

    // 4. Dispatch event notifications to Player 1
    await NotificationService.sendNotificationToUser(player1.userId, {
      title: 'Slot Confirmed! 🎮',
      body: 'You are booked in Slot #7 for Apex Clash.',
      type: 'BOOKING_CONFIRMED',
      data: { tournamentId: 'T_100', slotNumber: 7 },
    });

    const notif2 = await NotificationService.sendNotificationToUser(player1.userId, {
      title: '🔥 Room Credentials Live!',
      body: 'Room ID: 12345 | Pass: 8888 | Slot: #7',
      type: 'ROOM_REVEALED',
      data: { tournamentId: 'T_100', roomId: '12345', password: '8888' },
    });

    // 5. Query unread count
    const unreadRes1 = await makeRequest(server, {
      method: 'GET',
      path: '/api/v1/notifications/unread-count',
      token: player1.token,
    });
    assert(unreadRes1.status === 200 && unreadRes1.data.data.unreadCount === 2, 'Unread notification count is 2');

    // 6. Query notification inbox
    const inboxRes = await makeRequest(server, {
      method: 'GET',
      path: '/api/v1/notifications/inbox',
      token: player1.token,
    });
    assert(
      inboxRes.status === 200 &&
      inboxRes.data.data.total === 2 &&
      inboxRes.data.data.notifications.length === 2 &&
      inboxRes.data.data.notifications.some((n: any) => n.type === 'ROOM_REVEALED' && n.data?.roomId === '12345'),
      'Notification inbox lists persistent in-app notifications with parsed payloads',
      inboxRes.data
    );

    // 7. Mark single notification as read
    const markOneRes = await makeRequest(server, {
      method: 'PATCH',
      path: `/api/v1/notifications/${notif2.id}/read`,
      token: player1.token,
    });
    assert(markOneRes.status === 200, 'Notification marked as read');

    const unreadRes2 = await makeRequest(server, {
      method: 'GET',
      path: '/api/v1/notifications/unread-count',
      token: player1.token,
    });
    assert(unreadRes2.data.data.unreadCount === 1, 'Unread notification count decremented to 1');

    // 8. Mark all notifications as read
    const markAllRes = await makeRequest(server, {
      method: 'PATCH',
      path: '/api/v1/notifications/mark-all-read',
      token: player1.token,
    });
    assert(markAllRes.status === 200, 'All notifications marked as read');

    const unreadRes3 = await makeRequest(server, {
      method: 'GET',
      path: '/api/v1/notifications/unread-count',
      token: player1.token,
    });
    assert(unreadRes3.data.data.unreadCount === 0, 'Unread notification count reset to 0');

    // 9. Regular user forbidden from admin broadcast
    const forbiddenBroadcastRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/v1/admin/notifications/broadcast',
      token: player1.token,
      body: { title: 'Unauthorized', body: 'This should fail.' },
    });
    assert(forbiddenBroadcastRes.status === 403, 'Regular player blocked from broadcast endpoint (403)');

    // 10. Admin sends system broadcast to all active players
    const broadcastRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/v1/admin/notifications/broadcast',
      token: admin.token,
      body: {
        title: '⚡ Weekend Mega Championship Announced!',
        body: 'Join the ₹50,000 Free Fire Grand Tournament this Sunday. Slots opening soon!',
        data: { deepLink: '/tournaments' },
      },
    });
    assert(
      broadcastRes.status === 200 && broadcastRes.data.data.sentCount >= 3,
      'Admin successfully broadcasts system notification to all active players'
    );

    // Verify Player 2 received broadcast in inbox
    const p2InboxRes = await makeRequest(server, {
      method: 'GET',
      path: '/api/v1/notifications/inbox',
      token: player2.token,
    });
    assert(
      p2InboxRes.data.data.notifications[0].title === '⚡ Weekend Mega Championship Announced!',
      'Player 2 successfully received broadcast announcement'
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

runNotificationTests();
