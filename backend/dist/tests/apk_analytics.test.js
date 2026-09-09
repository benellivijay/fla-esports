"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runApkAnalyticsTests = runApkAnalyticsTests;
process.env.NODE_ENV = 'test';
const http_1 = __importDefault(require("http"));
const server_1 = require("../server");
const db_1 = require("../database/db");
const uuid_1 = require("uuid");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const crypto_1 = require("../utils/crypto");
function makeRequest(server, options) {
    return new Promise((resolve, reject) => {
        const port = server.address().port;
        const postData = options.body ? JSON.stringify(options.body) : '';
        const headers = {
            'Content-Type': 'application/json',
        };
        if (postData) {
            headers['Content-Length'] = Buffer.byteLength(postData);
        }
        if (options.token) {
            headers['Authorization'] = `Bearer ${options.token}`;
        }
        const req = http_1.default.request({
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
                }
                catch {
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
function assert(condition, message) {
    if (!condition) {
        console.error(`  ❌ FAIL: ${message}`);
        throw new Error(message);
    }
    else {
        console.log(`  ✅ PASS: ${message}`);
    }
}
async function runApkAnalyticsTests() {
    console.log('\n========================================');
    console.log('▶ Running Suite: apk_analytics.test.ts');
    console.log('========================================');
    console.log('🧪 Starting APK & Device Analytics Tests...\n');
    const app = (0, server_1.createApp)();
    const server = http_1.default.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    try {
        const db = (0, db_1.getDb)();
        // 1. Setup Admin Account
        const adminId = (0, uuid_1.v4)();
        const adminEmail = `apkadmin_${Date.now()}@ffesports.com`;
        const adminPass = 'AdminPass123!';
        const adminTotpSecret = 'JBSWY3DPEHPK3PXP';
        db.prepare(`
      INSERT INTO users (id, email, phone, password_hash, totp_secret, totp_enabled, role, status, is_phone_verified, is_email_verified)
      VALUES (?, ?, ?, ?, ?, 1, 'admin', 'active', 1, 1)
    `).run(adminId, adminEmail, `+9199${Date.now().toString().slice(-8)}`, crypto_1.CryptoUtil.hashPassword(adminPass), adminTotpSecret);
        const adminToken = jsonwebtoken_1.default.sign({ userId: adminId, role: 'admin' }, env_1.config.jwt.accessSecret, { expiresIn: '1h' });
        // Setup Test Player
        const playerId = (0, uuid_1.v4)();
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
    `).run((0, uuid_1.v4)(), playerId, uniqueFfUid, uniqueFfIgn);
        const playerToken = jsonwebtoken_1.default.sign({ userId: playerId, role: 'user' }, env_1.config.jwt.accessSecret, { expiresIn: '1h' });
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
        const installRow = db.prepare('SELECT * FROM app_installs WHERE device_id = ?').get(guestDeviceId);
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
        const playerInstallRow = db.prepare('SELECT * FROM app_installs WHERE device_id = ?').get(playerDeviceId);
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
        const linkedDevice = devicesRes.data.data.recentDevices.find((d) => d.device_id === playerDeviceId);
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
    }
    finally {
        server.close();
    }
}
if (require.main === module) {
    runApkAnalyticsTests().catch((err) => {
        console.error('Test Suite Failed:', err);
        process.exit(1);
    });
}
