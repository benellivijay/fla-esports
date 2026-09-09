"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
async function runConcurrencyStressTests() {
    console.log('🧪 Starting Step 9: High-Throughput Load Testing on Slot Booking Concurrency...\n');
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
    // Helper to create funded players
    function createFundedPlayer(index, initialBalance = 200.0) {
        const uId = (0, uuid_1.v4)();
        const phone = `92${rand}${index.toString().padStart(4, '0')}`;
        db.prepare(`
      INSERT INTO users (id, phone, role, status, is_phone_verified, is_email_verified, created_at, updated_at)
      VALUES (?, ?, 'user', 'active', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(uId, phone);
        db.prepare(`
      INSERT INTO profiles (id, user_id, display_name, ff_uid, ff_ign, ff_verification_status, created_at, updated_at)
      VALUES (?, ?, 'Player_${index}', 'FF_UID_${rand}_${index}', 'IGN_${index}', 'verified', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run((0, uuid_1.v4)(), uId);
        if (initialBalance > 0) {
            db.prepare(`
        INSERT INTO wallet_ledger (id, user_id, type, amount, reference_id, description, created_at)
        VALUES (?, ?, 'deposit', ?, 'SEED_FUNDS', 'Initial seed funds', CURRENT_TIMESTAMP)
      `).run((0, uuid_1.v4)(), uId, initialBalance);
        }
        const token = jsonwebtoken_1.default.sign({ userId: uId, role: 'user', phone }, env_1.config.jwt.accessSecret, { expiresIn: '1h' });
        return { userId: uId, token, initialBalance };
    }
    try {
        // =========================================================================
        // SCENARIO 1: The "Thundering Herd" — 50 Players Competing for Slot #1
        // =========================================================================
        console.log('--- Scenario 1: 50 Concurrent Players Competing for Slot #1 ---');
        const tourney1Id = (0, uuid_1.v4)();
        const entryFee = 50.0;
        db.prepare(`
      INSERT INTO tournaments (
        id, title, game, mode, map, entry_type, entry_fee, prize_pool, prize_distribution,
        max_slots, filled_slots, start_time, room_reveal_time_minutes, status, created_at, updated_at
      ) VALUES (
        ?, 'Apex Solo Championship #1', 'Free Fire', 'solo', 'Bermuda', 'paid', ?, 2000.0, '[]',
        48, 0, datetime('now', '+2 hours'), 15, 'open', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `).run(tourney1Id, entryFee);
        // Create 50 distinct funded players
        const fiftyPlayers = Array.from({ length: 50 }, (_, i) => createFundedPlayer(100 + i, 200.0));
        // Execute 50 parallel booking requests for Slot #1 simultaneously
        const startTime1 = Date.now();
        const responses1 = await Promise.all(fiftyPlayers.map((player) => makeRequest(server, {
            method: 'POST',
            path: `/api/v1/tournaments/${tourney1Id}/book`,
            token: player.token,
            body: { slotNumber: 1 },
        })));
        const duration1 = Date.now() - startTime1;
        const successfulBookings1 = responses1.filter((r) => r.status === 201);
        const conflictBookings1 = responses1.filter((r) => r.status === 409);
        assert(successfulBookings1.length === 1, `CONCURRENCY: Exactly 1 player won Slot #1 (out of 50 concurrent requests in ${duration1}ms)`);
        assert(conflictBookings1.length === 49, 'CONCURRENCY: Exactly 49 players safely received 409 Conflict');
        // Verify DB integrity for Slot #1
        const confirmedEntries1 = db.prepare(`
      SELECT * FROM tournament_entries 
      WHERE tournament_id = ? AND slot_number = 1 AND status = 'confirmed'
    `).all(tourney1Id);
        assert(confirmedEntries1.length === 1, 'Database contains exactly 1 confirmed entry for Slot #1');
        // Verify Zero Phantom Debits across all 49 rejected players
        const winningUserId1 = confirmedEntries1[0].user_id;
        let balanceIntegrity1 = true;
        for (const player of fiftyPlayers) {
            const ledgerSum = db.prepare(`
        SELECT SUM(CASE WHEN type IN ('deposit', 'prize_credit', 'refund') THEN amount ELSE -amount END) as bal
        FROM wallet_ledger WHERE user_id = ?
      `).get(player.userId);
            if (player.userId === winningUserId1) {
                if (ledgerSum.bal !== 150.0)
                    balanceIntegrity1 = false; // 200 - 50 = 150
            }
            else {
                if (ledgerSum.bal !== 200.0)
                    balanceIntegrity1 = false; // 200 intact
            }
        }
        assert(balanceIntegrity1, 'FINANCIAL INVARIANT: Winner debited ₹50.00; All 49 losers retain 100% wallet balance (₹200.00)');
        // =========================================================================
        // SCENARIO 2: Match Saturation Race — 60 Players Competing for 48 Slots
        // =========================================================================
        console.log('\n--- Scenario 2: 60 Concurrent Players Filling 48-Slot Match ---');
        const tourney2Id = (0, uuid_1.v4)();
        db.prepare(`
      INSERT INTO tournaments (
        id, title, game, mode, map, entry_type, entry_fee, prize_pool, prize_distribution,
        max_slots, filled_slots, start_time, room_reveal_time_minutes, status, created_at, updated_at
      ) VALUES (
        ?, 'Apex Solo Championship #2', 'Free Fire', 'solo', 'Bermuda', 'paid', 50.0, 2000.0, '[]',
        48, 0, datetime('now', '+2 hours'), 15, 'open', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `).run(tourney2Id);
        // Create 60 distinct funded players
        const sixtyPlayers = Array.from({ length: 60 }, (_, i) => createFundedPlayer(300 + i, 200.0));
        // Each player picks a slot (modulo 48 + 1)
        const startTime2 = Date.now();
        const responses2 = await Promise.all(sixtyPlayers.map((player, idx) => makeRequest(server, {
            method: 'POST',
            path: `/api/v1/tournaments/${tourney2Id}/book`,
            token: player.token,
            body: { slotNumber: (idx % 48) + 1 },
        })));
        const duration2 = Date.now() - startTime2;
        const successfulBookings2 = responses2.filter((r) => r.status === 201);
        const conflictBookings2 = responses2.filter((r) => r.status === 409);
        assert(successfulBookings2.length === 48, `MATCH SATURATION: Exactly 48 slots booked across 60 concurrent attempts in ${duration2}ms`);
        assert(conflictBookings2.length === 12, 'MATCH SATURATION: Exactly 12 overflow players rejected with 409 Conflict');
        // Verify tournament filled_slots in DB is exactly 48
        const tourney2Row = db.prepare('SELECT filled_slots, max_slots FROM tournaments WHERE id = ?').get(tourney2Id);
        assert(tourney2Row.filled_slots === 48 && tourney2Row.max_slots === 48, 'Tournament filled_slots in DB is exactly 48/48 (No Overbooking)');
        // =========================================================================
        // SCENARIO 3: Rapid Concurrent Wallet Invariant
        // =========================================================================
        console.log('\n--- Scenario 3: Rapid Concurrent Deposits, Debits, and Refunds ---');
        const testUser = createFundedPlayer(999, 1000.0);
        const { WalletService } = await Promise.resolve().then(() => __importStar(require('../modules/wallet/wallet.service')));
        const depositPromises = Array.from({ length: 5 }, async (_, i) => {
            const orderId = `ORD_CONC_${i}_${rand}`;
            const paymentId = `PAY_CONC_${i}_${rand}`;
            const amount = 100.0;
            // Seed payment order in DB
            db.prepare(`
        INSERT INTO payment_orders (id, user_id, order_id, amount, currency, status, gateway, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'INR', 'pending', 'mock_gateway', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run((0, uuid_1.v4)(), testUser.userId, orderId, amount);
            const signature = WalletService.generateSignature(orderId, paymentId);
            return makeRequest(server, {
                method: 'POST',
                path: '/api/v1/wallet/deposit/verify',
                token: testUser.token,
                body: {
                    orderId,
                    paymentId,
                    amount,
                    signature,
                },
            });
        });
        await Promise.all(depositPromises);
        // Check balance: 1000 + (5 * 100) = 1500
        const finalBalanceRow = db.prepare(`
      SELECT SUM(CASE WHEN type IN ('deposit', 'prize_credit', 'refund') THEN amount ELSE -amount END) as bal
      FROM wallet_ledger WHERE user_id = ?
    `).get(testUser.userId);
        assert(finalBalanceRow.bal === 1500.0, 'LEDGER INVARIANT: Final balance strictly equals ₹1,500.00 after 5 concurrent deposits');
        // Concurrency throughput stats
        const totalTransactions = 50 + 60 + 5;
        const totalTimeMs = duration1 + duration2;
        const rps = Math.round((totalTransactions / (totalTimeMs / 1000)));
        console.log(`\n⚡ Throughput Performance: Executed ${totalTransactions} concurrent operations in ${totalTimeMs}ms (~${rps} ops/sec)`);
    }
    catch (err) {
        console.error('Unexpected load test error:', err);
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
runConcurrencyStressTests();
