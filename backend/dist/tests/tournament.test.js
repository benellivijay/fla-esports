"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
process.env.NODE_ENV = 'test';
const http_1 = __importDefault(require("http"));
const server_1 = require("../server");
const db_1 = require("../database/db");
const uuid_1 = require("uuid");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
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
async function runTournamentTests() {
    console.log('🧪 Starting Step 2: Tournament Engine (CRUD & Listing) Automated Tests...\n');
    let passedCount = 0;
    let failedCount = 0;
    function assert(condition, testName, detail) {
        if (condition) {
            console.log(`  ✅ PASS: ${testName}`);
            passedCount++;
        }
        else {
            console.error(`  ❌ FAIL: ${testName}`);
            if (detail)
                console.error('     Detail:', detail);
            failedCount++;
        }
    }
    const app = (0, server_1.createApp)();
    const server = http_1.default.createServer(app);
    await new Promise((resolve) => {
        server.listen(0, '127.0.0.1', () => resolve());
    });
    const rand = Math.floor(100000 + Math.random() * 900000);
    const db = (0, db_1.getDb)();
    // Create standard user token
    const userId = (0, uuid_1.v4)();
    db.prepare(`
    INSERT INTO users (id, phone, role, status, is_phone_verified, is_email_verified, created_at, updated_at)
    VALUES (?, ?, 'user', 'active', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(userId, `98${rand}01`);
    const userToken = jsonwebtoken_1.default.sign({ userId, role: 'user', phone: `98${rand}01` }, env_1.config.jwt.accessSecret, { expiresIn: '1h' });
    // Create admin user token
    const adminId = (0, uuid_1.v4)();
    const adminEmail = `admin_tourney_${rand}@ffesports.com`;
    db.prepare(`
    INSERT INTO users (id, email, role, status, is_email_verified, created_at, updated_at)
    VALUES (?, ?, 'admin', 'active', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(adminId, adminEmail);
    const adminToken = jsonwebtoken_1.default.sign({ userId: adminId, role: 'admin', email: adminEmail }, env_1.config.jwt.accessSecret, { expiresIn: '1h' });
    let paidTournamentId = '';
    let freeTournamentId = '';
    try {
        // 1. Regular user blocked from creating tournament (403 Forbidden)
        const unauthorizedCreateRes = await makeRequest(server, {
            method: 'POST',
            path: '/api/v1/tournaments',
            token: userToken,
            body: {
                title: 'Unauthorized Cup',
                mode: 'solo',
                map: 'Bermuda',
                entryType: 'free',
                prizePool: 500,
                maxSlots: 48,
                startTime: new Date(Date.now() + 3600000).toISOString(),
            },
        });
        assert(unauthorizedCreateRes.status === 403, 'Regular user forbidden from creating tournament (403 Forbidden)');
        // 2. Admin creates Paid Tournament (Solo, Bermuda)
        const startTimePaid = new Date(Date.now() + 2 * 3600 * 1000).toISOString();
        const createPaidRes = await makeRequest(server, {
            method: 'POST',
            path: '/api/v1/tournaments',
            token: adminToken,
            body: {
                title: `Bermuda Battle Solo #${rand}`,
                description: 'High stakes solo tournament on Bermuda. Placement + Kill bounty.',
                game: 'Free Fire',
                mode: 'solo',
                map: 'Bermuda',
                entryType: 'paid',
                entryFee: 50,
                prizePool: 2000,
                prizeDistribution: [
                    { rank: 1, amount: 1000, percentage: 50 },
                    { rank: 2, amount: 600, percentage: 30 },
                    { rank: 3, amount: 400, percentage: 20 },
                ],
                perKillPrize: 10,
                maxSlots: 48,
                startTime: startTimePaid,
                roomRevealTimeMinutes: 15,
                roomId: 'FF_ROOM_98214',
                roomPassword: 'pass_secret_123',
                rules: 'Emulators strictly prohibited. Default character skills only.',
            },
        });
        assert(createPaidRes.status === 201 && createPaidRes.data.success === true, 'Admin successfully creates Paid Tournament');
        paidTournamentId = createPaidRes.data.data.id;
        // 3. Admin creates Free Tournament (Squad, Purgatory)
        const startTimeFree = new Date(Date.now() + 4 * 3600 * 1000).toISOString();
        const createFreeRes = await makeRequest(server, {
            method: 'POST',
            path: '/api/v1/tournaments',
            token: adminToken,
            body: {
                title: `Purgatory Squad Rush #${rand}`,
                description: 'Free entry community squad championship.',
                game: 'Free Fire',
                mode: 'squad',
                map: 'Purgatory',
                entryType: 'free',
                entryFee: 0,
                prizePool: 500,
                prizeDistribution: [
                    { rank: 1, amount: 300, percentage: 60 },
                    { rank: 2, amount: 200, percentage: 40 },
                ],
                perKillPrize: 0,
                maxSlots: 48,
                startTime: startTimeFree,
                rules: 'Full squad must be present at room start time.',
            },
        });
        assert(createFreeRes.status === 201 && createFreeRes.data.success === true, 'Admin successfully creates Free Tournament');
        freeTournamentId = createFreeRes.data.data.id;
        // 4. Client lists all tournaments (Public endpoint)
        const listRes = await makeRequest(server, {
            method: 'GET',
            path: '/api/v1/tournaments',
        });
        assert(listRes.status === 200 && listRes.data.count >= 2, 'Client lists upcoming tournaments');
        // 5. CRITICAL SECURITY CHECK: Unrevealed room credentials MUST be redacted for clients
        const clientFoundPaid = listRes.data.tournaments.find((t) => t.id === paidTournamentId);
        assert(clientFoundPaid && clientFoundPaid.room_id === null && clientFoundPaid.room_password === null, 'SECURITY: Client queries have room_id and room_password completely redacted prior to reveal');
        // 6. Admin query includes room credentials
        const adminListRes = await makeRequest(server, {
            method: 'GET',
            path: '/api/v1/tournaments',
            token: adminToken,
        });
        const adminFoundPaid = adminListRes.data.tournaments.find((t) => t.id === paidTournamentId);
        assert(adminFoundPaid && adminFoundPaid.room_id === 'FF_ROOM_98214', 'Admin query includes room credentials');
        // 7. Filter by entryType=paid
        const paidFilterRes = await makeRequest(server, {
            method: 'GET',
            path: '/api/v1/tournaments?entryType=paid',
        });
        const allPaid = paidFilterRes.data.tournaments.every((t) => t.entry_type === 'paid');
        assert(paidFilterRes.status === 200 && allPaid, 'Filter by entryType=paid returns only paid tournaments');
        // 8. Filter by mode=squad
        const squadFilterRes = await makeRequest(server, {
            method: 'GET',
            path: '/api/v1/tournaments?mode=squad',
        });
        const allSquad = squadFilterRes.data.tournaments.every((t) => t.mode === 'squad');
        assert(squadFilterRes.status === 200 && allSquad, 'Filter by mode=squad returns only squad tournaments');
        // 9. Filter by map=Bermuda
        const mapFilterRes = await makeRequest(server, {
            method: 'GET',
            path: '/api/v1/tournaments?map=Bermuda',
        });
        const allBermuda = mapFilterRes.data.tournaments.every((t) => t.map === 'Bermuda');
        assert(mapFilterRes.status === 200 && allBermuda, 'Filter by map=Bermuda returns only Bermuda tournaments');
        // 10. Get Tournament Details by ID
        const detailRes = await makeRequest(server, {
            method: 'GET',
            path: `/api/v1/tournaments/${paidTournamentId}`,
        });
        assert(detailRes.status === 200 &&
            detailRes.data.data.id === paidTournamentId &&
            Array.isArray(detailRes.data.data.prize_distribution), 'GET /tournaments/:id returns complete details with parsed prize breakdown');
        // 11. Admin updates tournament
        const updateRes = await makeRequest(server, {
            method: 'PUT',
            path: `/api/v1/tournaments/${paidTournamentId}`,
            token: adminToken,
            body: {
                title: `Bermuda Grand Solo #${rand} (Updated)`,
                perKillPrize: 15,
            },
        });
        assert(updateRes.status === 200 &&
            updateRes.data.data.title.includes('(Updated)') &&
            updateRes.data.data.per_kill_prize === 15, 'Admin updates tournament parameters successfully');
        // 12. Admin updates custom room credentials
        const updateRoomRes = await makeRequest(server, {
            method: 'PUT',
            path: `/api/v1/tournaments/${paidTournamentId}/room-credentials`,
            token: adminToken,
            body: {
                roomId: 'FF_ROOM_NEW_777',
                roomPassword: 'new_pass_456',
            },
        });
        assert(updateRoomRes.status === 200, 'Admin updates custom room credentials');
        // 13. Admin cancels tournament
        const cancelRes = await makeRequest(server, {
            method: 'POST',
            path: `/api/v1/tournaments/${freeTournamentId}/cancel`,
            token: adminToken,
            body: { reason: 'Schedule adjustment' },
        });
        assert(cancelRes.status === 200, 'Admin cancels tournament');
        // 14. Audit log verification
        const auditRes = await makeRequest(server, {
            method: 'GET',
            path: '/api/v1/admin/audit-logs',
            token: adminToken,
        });
        const hasTourneyAudit = auditRes.data.data.some((l) => l.target_resource === 'tournaments');
        assert(hasTourneyAudit, 'Audit log contains immutable records for tournament actions');
    }
    catch (err) {
        console.error('Unexpected test error:', err);
        failedCount++;
    }
    finally {
        server.close();
        db_1.DatabaseManager.close();
    }
    console.log(`\n================================`);
    console.log(`Total Passed: ${passedCount}`);
    console.log(`Total Failed: ${failedCount}`);
    console.log(`================================\n`);
    if (failedCount > 0) {
        process.exit(1);
    }
}
runTournamentTests();
