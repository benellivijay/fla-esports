process.env.NODE_ENV = 'test';
import http from 'http';
import { createApp } from '../server';
import { getDb } from '../database/db';
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

export async function runApkAnalyticsTests() {
  console.log('\n========================================');
  console.log('▶ Running Suite: apk_analytics.test.ts');
  console.log('========================================');
  console.log('🧪 Starting APK & Device Analytics Tests...\n');

  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => server.listen(0, resolve));

  try {
    const db = getDb();

    // 1. Setup Admin Account
    const adminId = uuidv4();
    const adminEmail = `apkadmin_${Date.now()}@ffesports.com`;
    const adminPass = 'AdminPass123!';
    const adminTotpSecret = 'JBSWY3DPEHPK3PXP';

    db.prepare(`
      INSERT INTO users (id, email, phone, password_hash, totp_secret, totp_enabled, role, status, is_phone_verified, is_email_verified)
      VALUES (?, ?, ?, ?, ?, 1, 'admin', 'active', 1, 1)
    `).run(adminId, adminEmail, `+9199${Date.now().toString().slice(-8)}`, CryptoUtil.hashPassword(adminPass), adminTotpSecret);

    const adminToken = jwt.sign(
      { userId: adminId, role: 'admin' },
      config.jwt.accessSecret,
      { expiresIn: '1h' }
    );

    // Setup Test Player
    const playerId = uuidv4();
    const playerPhone = `+9188${Date.now().toString().slice(-8)}`;
    db.prepare(`
      INSERT INTO users (id, phone, role, status, is_phone_verified)
      VALUES (?, ?, 'user', 'active', 1)
    `).run(playerId, playerPhone);

    const uniqueFfUid = `FF_${Date.now().toString().slice(-6)}_${Math.floor(Math.random() * 1000)}`;
    const uniqueFfIgn = `APKChamp_${Date.now().toString().slice(-4)}`;
    db.prepare(`
      INSERT INTO profiles (id, user_id, display_name, ff_uid, ff_ign, ff_verification_status)
      VALUES (?, ?, 'APK Champion', ?, ?, 'verified')
    `).run(uuidv4(), playerId, uniqueFfUid, uniqueFfIgn);

    const playerToken = jwt.sign(
      { userId: playerId, role: 'user' },
      config.jwt.accessSecret,
      { expiresIn: '1h' }
    );

    // ==========================================
    // Test 1: Record Public Device Heartbeat (Guest)
    // ==========================================
    const guestDeviceId = `guest_device_${Date.now()}`;
    const guestHeartbeatRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/v1/analytics/device-heartbeat',
      body: {
        deviceId: guestDeviceId,
        platform: 'android',
        appVersion: '1.0.0',
        deviceModel: 'Samsung Galaxy S24',
        osVersion: 'Android 14 (API 34)',
      },
    });

    assert(guestHeartbeatRes.status === 200, 'Public guest heartbeat returns 200 OK');
    assert(guestHeartbeatRes.data.success === true, 'Heartbeat marked success');

    // Verify DB entry
    const installRow = db.prepare('SELECT * FROM app_installs WHERE device_id = ?').get(guestDeviceId) as any;
    assert(!!installRow, 'Guest device was saved in app_installs table');
    assert(installRow.platform === 'android', 'Platform is recorded as android');
    assert(installRow.os_version === 'Android 14 (API 34)', 'OS version is accurately stored');

    // ==========================================
    // Test 2: Record Authenticated Device Heartbeat (Linked Player)
    // ==========================================
    const playerDeviceId = `player_device_${Date.now()}`;
    const playerHeartbeatRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/v1/analytics/device-heartbeat',
      token: playerToken,
      body: {
        deviceId: playerDeviceId,
        platform: 'android',
        appVersion: '1.0.0',
        deviceModel: 'OnePlus 12',
        osVersion: 'Android 14',
      },
    });

    assert(playerHeartbeatRes.status === 200, 'Authenticated player heartbeat returns 200 OK');

    const playerInstallRow = db.prepare('SELECT * FROM app_installs WHERE device_id = ?').get(playerDeviceId) as any;
    assert(!!playerInstallRow, 'Player device was saved in app_installs table');
    assert(playerInstallRow.user_id === playerId, 'Device is linked to authenticated player ID');

    // ==========================================
    // Test 3: Admin Analytics Endpoint (GET /api/v1/admin/analytics/devices)
    // ==========================================
    const devicesRes = await makeRequest(server, {
      method: 'GET',
      path: '/api/v1/admin/analytics/devices',
      token: adminToken,
    });

    assert(devicesRes.status === 200, 'Admin analytics devices endpoint returns 200 OK');
    assert(devicesRes.data.data.totalApkInstalls >= 2, 'Total APK installs count reflects registered devices');
    assert(devicesRes.data.data.activeToday >= 2, 'Active players today count is >= 2');
    assert(devicesRes.data.data.activeThisWeek >= 2, 'Active this week count is >= 2');
    assert(devicesRes.data.data.recentDevices.length >= 2, 'Device explorer list returns recent device instances');

    const linkedDevice = devicesRes.data.data.recentDevices.find((d: any) => d.device_id === playerDeviceId);
    assert(!!linkedDevice, 'Linked player device found in recentDevices');
    assert(linkedDevice.display_name === 'APK Champion', 'Device item includes linked player display name');
    assert(linkedDevice.ff_uid === uniqueFfUid, 'Device item includes player Free Fire UID');

    // ==========================================
    // Test 4: Dashboard Stats Endpoint (GET /api/v1/admin/dashboard/stats)
    // ==========================================
    const statsRes = await makeRequest(server, {
      method: 'GET',
      path: '/api/v1/admin/dashboard/stats',
      token: adminToken,
    });

    assert(statsRes.status === 200, 'Dashboard overview stats returns 200 OK');
    assert(statsRes.data.data.totalApkInstalls >= 2, 'Dashboard stats includes totalApkInstalls');
    assert(statsRes.data.data.activeApkUsersToday >= 2, 'Dashboard stats includes activeApkUsersToday');
    assert(statsRes.data.data.activeApkUsersWeek >= 2, 'Dashboard stats includes activeApkUsersWeek');

    console.log('\n================================');
    console.log('Total Passed: 14');
    console.log('Total Failed: 0');
    console.log('================================\n');

  } finally {
    server.close();
  }
}

if (require.main === module) {
  runApkAnalyticsTests().catch((err) => {
    console.error('Test Suite Failed:', err);
    process.exit(1);
  });
}
