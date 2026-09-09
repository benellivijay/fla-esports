"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
process.env.NODE_ENV = 'test';
const http_1 = __importDefault(require("http"));
const server_1 = require("../server");
const db_1 = require("../database/db");
const wallet_service_1 = require("../modules/wallet/wallet.service");
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
async function runWalletTests() {
    console.log('🧪 Starting Step 4: Wallet Ledger & Deposits Automated Tests...\n');
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
    // Create unique user
    const uId = (0, uuid_1.v4)();
    const phone = `91${rand}88`;
    db.prepare(`
    INSERT INTO users (id, phone, role, status, is_phone_verified, is_email_verified, created_at, updated_at)
    VALUES (?, ?, 'user', 'active', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(uId, phone);
    db.prepare(`
    INSERT INTO profiles (id, user_id, display_name, ff_uid, ff_ign, ff_verification_status, created_at, updated_at)
    VALUES (?, ?, 'WalletKing', ?, 'WalletKing', 'verified', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run((0, uuid_1.v4)(), uId, `FF_WAL_${rand}`);
    const token = jsonwebtoken_1.default.sign({ userId: uId, role: 'user', phone }, env_1.config.jwt.accessSecret, { expiresIn: '1h' });
    try {
        // 1. Initial wallet summary returns 0 balance
        const summaryRes1 = await makeRequest(server, {
            method: 'GET',
            path: '/api/v1/wallet/summary',
            token,
        });
        assert(summaryRes1.status === 200 && summaryRes1.data.data.balance === 0, 'Initial wallet balance is ₹0.00');
        // 2. Deposit order creation rejects invalid amounts (< ₹10)
        const invalidOrderRes = await makeRequest(server, {
            method: 'POST',
            path: '/api/v1/wallet/deposit/create-order',
            token,
            body: { amount: 5 },
        });
        assert(invalidOrderRes.status === 400, 'Deposit order under ₹10 rejected');
        // 3. Create valid deposit order for ₹500
        const orderRes = await makeRequest(server, {
            method: 'POST',
            path: '/api/v1/wallet/deposit/create-order',
            token,
            body: { amount: 500 },
        });
        assert(orderRes.status === 201 && orderRes.data.data.amount === 500 && !!orderRes.data.data.orderId, 'Deposit order for ₹500 created successfully');
        const orderId = orderRes.data.data.orderId;
        const paymentId = `pay_mock_${rand}_${Date.now()}`;
        // 4. Verify deposit with tampered signature is rejected
        const tamperedVerifyRes = await makeRequest(server, {
            method: 'POST',
            path: '/api/v1/wallet/deposit/verify',
            token,
            body: {
                orderId,
                paymentId,
                signature: 'invalid_tampered_signature_hex_code_12345',
            },
        });
        assert(tamperedVerifyRes.status === 400 && tamperedVerifyRes.data.code === 'INVALID_SIGNATURE', 'Tampered signature rejected with 400 INVALID_SIGNATURE');
        // 5. Verify deposit with valid HMAC-SHA256 signature
        const validSignature = wallet_service_1.WalletService.generateSignature(orderId, paymentId);
        const validVerifyRes = await makeRequest(server, {
            method: 'POST',
            path: '/api/v1/wallet/deposit/verify',
            token,
            body: {
                orderId,
                paymentId,
                signature: validSignature,
            },
        });
        assert(validVerifyRes.status === 200 && validVerifyRes.data.data.newBalance === 500, 'Valid payment signature verified and ₹500 credited to wallet ledger');
        // 6. IDEMPOTENCY TEST: Verify same payment again
        const idempotentVerifyRes = await makeRequest(server, {
            method: 'POST',
            path: '/api/v1/wallet/deposit/verify',
            token,
            body: {
                orderId,
                paymentId,
                signature: validSignature,
            },
        });
        assert(idempotentVerifyRes.status === 200 && idempotentVerifyRes.data.data.newBalance === 500, 'IDEMPOTENCY: Replay of same payment_id does NOT double-credit balance (stays ₹500.00)');
        // 7. Add another deposit of ₹250
        const orderRes2 = await makeRequest(server, {
            method: 'POST',
            path: '/api/v1/wallet/deposit/create-order',
            token,
            body: { amount: 250 },
        });
        const orderId2 = orderRes2.data.data.orderId;
        const paymentId2 = `pay_mock_${rand}_2`;
        const signature2 = wallet_service_1.WalletService.generateSignature(orderId2, paymentId2);
        const verifyRes2 = await makeRequest(server, {
            method: 'POST',
            path: '/api/v1/wallet/deposit/verify',
            token,
            body: {
                orderId: orderId2,
                paymentId: paymentId2,
                signature: signature2,
            },
        });
        assert(verifyRes2.status === 200 && verifyRes2.data.data.newBalance === 750, 'Second deposit of ₹250 successfully credited (Total Balance: ₹750.00)');
        // 8. Wallet summary matches exact sum of ledger records
        const summaryRes2 = await makeRequest(server, {
            method: 'GET',
            path: '/api/v1/wallet/summary',
            token,
        });
        assert(summaryRes2.status === 200 &&
            summaryRes2.data.data.balance === 750 &&
            summaryRes2.data.data.totalDeposited === 750, 'Wallet summary accurately reflects sum of ledger transactions');
        // 9. Paginated transaction statement
        const statementRes = await makeRequest(server, {
            method: 'GET',
            path: '/api/v1/wallet/transactions?limit=10',
            token,
        });
        assert(statementRes.status === 200 && statementRes.data.data.total === 2 && statementRes.data.data.transactions.length === 2, 'Transaction statement retrieves 2 ledger records');
        // 10. Filter by type=deposit
        const filterRes = await makeRequest(server, {
            method: 'GET',
            path: '/api/v1/wallet/transactions?type=deposit',
            token,
        });
        assert(filterRes.status === 200 && filterRes.data.data.transactions.every((t) => t.type === 'deposit'), 'Transaction statement filtered by type=deposit');
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
runWalletTests();
