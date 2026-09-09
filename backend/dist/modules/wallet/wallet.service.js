"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const uuid_1 = require("uuid");
const db_1 = require("../../database/db");
const logger_1 = require("../../utils/logger");
const error_middleware_1 = require("../../middleware/error.middleware");
const gdrive_service_1 = require("../../services/gdrive.service");
class WalletService {
    static WEBHOOK_SECRET = process.env.GATEWAY_WEBHOOK_SECRET || 'ff_esports_webhook_secret_key_2026';
    /**
     * Helper: Generates valid HMAC-SHA256 signature for client/gateway verification
     */
    static generateSignature(orderId, paymentId) {
        return crypto_1.default
            .createHmac('sha256', this.WEBHOOK_SECRET)
            .update(`${orderId}|${paymentId}`)
            .digest('hex');
    }
    /**
     * Section 3.3: Balance = sum of ledger entries for a user (ledger is the source of truth)
     */
    static getWalletSummary(userId) {
        const db = (0, db_1.getDb)();
        const row = db.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE 0 END), 0.0) as total_deposited,
        COALESCE(SUM(CASE WHEN type = 'prize_credit' THEN amount ELSE 0 END), 0.0) as total_winnings,
        COALESCE(SUM(CASE WHEN type = 'entry_fee_debit' THEN amount ELSE 0 END), 0.0) as total_spent,
        COALESCE(SUM(CASE WHEN type = 'withdrawal' THEN amount ELSE 0 END), 0.0) as total_withdrawn,
        COALESCE(SUM(CASE WHEN type = 'refund' THEN amount ELSE 0 END), 0.0) as total_refunds,
        COALESCE(SUM(
          CASE 
            WHEN type IN ('deposit', 'prize_credit', 'refund') THEN amount
            WHEN type IN ('entry_fee_debit', 'withdrawal') THEN -amount
            ELSE 0 
          END
        ), 0.0) as current_balance
      FROM wallet_ledger 
      WHERE user_id = ?
    `).get(userId);
        const currentBalance = Number(row?.current_balance || 0.0);
        const totalWinnings = Number(row?.total_winnings || 0.0);
        const totalWithdrawn = Number(row?.total_withdrawn || 0.0);
        // Only won amounts (prize credits minus withdrawals) can be withdrawn
        const withdrawableBalance = Math.min(currentBalance, Math.max(0, totalWinnings - totalWithdrawn));
        const depositBalance = Math.max(0, currentBalance - withdrawableBalance);
        return {
            balance: currentBalance,
            withdrawableBalance,
            depositBalance,
            totalDeposited: Number(row?.total_deposited || 0.0),
            totalWinnings,
            totalWithdrawn,
            totalSpent: Number(row?.total_spent || 0.0),
            totalRefunds: Number(row?.total_refunds || 0.0),
            currency: 'INR',
        };
    }
    /**
     * Step 4.1: Initiates a deposit payment order
     */
    static async createDepositOrder(userId, data) {
        const { amount, gateway = 'mock_gateway' } = data;
        if (!amount || amount < 10) {
            throw new error_middleware_1.AppError('Minimum deposit amount is ₹10.00.', 400);
        }
        if (amount > 50000) {
            throw new error_middleware_1.AppError('Maximum deposit amount per transaction is ₹50,000.00.', 400);
        }
        const db = (0, db_1.getDb)();
        const orderId = `ORD_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
        const internalId = (0, uuid_1.v4)();
        const paymentSessionId = `sess_${(0, uuid_1.v4)()}`;
        db.prepare(`
      INSERT INTO payment_orders (id, user_id, order_id, amount, currency, status, gateway, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'INR', 'pending', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(internalId, userId, orderId, amount, gateway);
        logger_1.Logger.audit({
            actorId: userId,
            action: 'PAYMENT_ORDER_CREATED',
            targetResource: 'payment_orders',
            targetId: internalId,
            details: { orderId, amount, gateway },
        });
        return {
            orderId,
            amount,
            currency: 'INR',
            gateway,
            paymentSessionId,
            keyId: 'rzp_test_ff_arena_key',
        };
    }
    /**
     * Step 4.2: Verifies payment signature & idempotently credits the wallet ledger
     */
    static async verifyAndCreditDeposit(userId, data) {
        const { orderId, paymentId, signature } = data;
        const db = (0, db_1.getDb)();
        // 1. Fetch payment order
        const order = db.prepare('SELECT * FROM payment_orders WHERE order_id = ? AND user_id = ?').get(orderId, userId);
        if (!order) {
            throw new error_middleware_1.AppError('Payment order not found.', 404);
        }
        // 2. Verify HMAC-SHA256 signature
        const expectedSignature = this.generateSignature(orderId, paymentId);
        if (signature !== expectedSignature) {
            throw new error_middleware_1.AppError('Invalid payment signature verification failed.', 400, 'INVALID_SIGNATURE');
        }
        // 3. IDEMPOTENCY CHECK: If already completed or already in ledger, return immediately without double-crediting
        if (order.status === 'completed') {
            const currentBalance = this.getWalletSummary(userId).balance;
            return {
                success: true,
                orderId,
                paymentId,
                creditedAmount: Number(order.amount),
                newBalance: currentBalance,
            };
        }
        const existingLedgerEntry = db.prepare('SELECT id FROM wallet_ledger WHERE reference_id = ?').get(paymentId);
        if (existingLedgerEntry) {
            const currentBalance = this.getWalletSummary(userId).balance;
            return {
                success: true,
                orderId,
                paymentId,
                creditedAmount: Number(order.amount),
                newBalance: currentBalance,
            };
        }
        // 4. ACID Transaction: Mark order completed and insert immutable deposit record into wallet_ledger
        const amount = Number(order.amount);
        const ledgerId = (0, uuid_1.v4)();
        db.exec('BEGIN TRANSACTION;');
        try {
            db.prepare(`
        UPDATE payment_orders 
        SET status = 'completed', payment_id = ?, signature = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(paymentId, signature, order.id);
            db.prepare(`
        INSERT INTO wallet_ledger (id, user_id, type, amount, reference_id, description, created_at)
        VALUES (?, ?, 'deposit', ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(ledgerId, userId, amount, paymentId, `Online Deposit (${order.gateway})`);
            db.exec('COMMIT;');
        }
        catch (err) {
            try {
                db.exec('ROLLBACK;');
            }
            catch (_) { }
            throw err;
        }
        logger_1.Logger.audit({
            actorId: userId,
            action: 'WALLET_DEPOSIT_COMPLETED',
            targetResource: 'wallet_ledger',
            targetId: ledgerId,
            details: { orderId, paymentId, amount },
        });
        const newBalance = this.getWalletSummary(userId).balance;
        return {
            success: true,
            orderId,
            paymentId,
            creditedAmount: amount,
            newBalance,
        };
    }
    /**
     * Step 4.3: Retrieves paginated immutable transaction history
     */
    static async getLedgerHistory(userId, filterType, page = 1, limit = 20) {
        const db = (0, db_1.getDb)();
        const offset = (page - 1) * limit;
        let query = 'SELECT * FROM wallet_ledger WHERE user_id = ?';
        let countQuery = 'SELECT COUNT(*) as count FROM wallet_ledger WHERE user_id = ?';
        const params = [userId];
        const countParams = [userId];
        if (filterType && filterType !== 'all') {
            query += ' AND type = ?';
            countQuery += ' AND type = ?';
            params.push(filterType);
            countParams.push(filterType);
        }
        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);
        const transactions = db.prepare(query).all(...params);
        const totalCountRow = db.prepare(countQuery).get(...countParams);
        return {
            transactions,
            total: totalCountRow?.count || 0,
            page,
            limit,
        };
    }
    /**
     * QR Code UPI Deposit Submission (Option A: Queued for Admin Verification)
     */
    static async submitQrDeposit(userId, data) {
        const { amount, utrNumber, screenshotUrl, qrUsed } = data;
        const cleanUtr = utrNumber.trim().toUpperCase();
        if (!amount || amount < 10) {
            throw new error_middleware_1.AppError('Minimum deposit amount is ₹10.00.', 400);
        }
        if (amount > 50000) {
            throw new error_middleware_1.AppError('Maximum deposit amount per transaction is ₹50,000.00.', 400);
        }
        if (!cleanUtr || cleanUtr.length < 6) {
            throw new error_middleware_1.AppError('Please enter a valid UPI UTR / Transaction Reference Number (minimum 6 characters).', 400);
        }
        if (!screenshotUrl || screenshotUrl.trim() === '') {
            throw new error_middleware_1.AppError('Payment screenshot proof is mandatory. Please attach a screenshot of your UPI payment.', 400, 'PAYMENT_SCREENSHOT_REQUIRED');
        }
        const db = (0, db_1.getDb)();
        // 1. Anti-Fraud Check: Has this UTR already been submitted or credited?
        const existingOrder = db.prepare(`
      SELECT id, user_id, status FROM payment_orders 
      WHERE payment_id = ? AND status IN ('pending', 'completed')
    `).get(cleanUtr);
        if (existingOrder) {
            throw new error_middleware_1.AppError('This UTR / Transaction Reference Number has already been submitted for verification.', 409, 'UTR_ALREADY_USED');
        }
        const orderId = `ORD_UPI_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
        const internalId = (0, uuid_1.v4)();
        db.prepare(`
      INSERT INTO payment_orders (
        id, user_id, order_id, amount, currency, status, gateway, 
        payment_id, signature, screenshot_url, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'INR', 'pending', 'mock_gateway', ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(internalId, userId, orderId, amount, cleanUtr, qrUsed || 'phonepe_qr', screenshotUrl || null);
        logger_1.Logger.audit({
            actorId: userId,
            action: 'UPI_QR_DEPOSIT_SUBMITTED',
            targetResource: 'payment_orders',
            targetId: internalId,
            details: { orderId, utrNumber: cleanUtr, amount, screenshotUrl, qrUsed },
        });
        // Notify user that deposit request is received
        try {
            const { NotificationService } = require('../scheduler/notification.service');
            await NotificationService.sendNotificationToUser(userId, {
                title: '⏳ Deposit Request Submitted',
                body: `Deposit of ₹${amount.toFixed(2)} (UTR: ${cleanUtr}) has been submitted for admin verification.`,
                type: 'SYSTEM',
                data: { amount, utrNumber: cleanUtr, orderId },
            });
        }
        catch (_) { }
        return {
            success: true,
            orderId,
            utrNumber: cleanUtr,
            amount,
            status: 'pending',
            message: 'Deposit request submitted successfully. It will be verified and credited within minutes.',
        };
    }
    /**
     * Admin: List Deposit Queue (Pending, Completed, Rejected)
     */
    static async getDepositQueue(status) {
        const db = (0, db_1.getDb)();
        let query = `
      SELECT 
        po.id,
        po.user_id,
        po.order_id,
        po.payment_id as utr_number,
        po.amount,
        po.currency,
        po.status,
        po.signature as qr_used,
        po.screenshot_url,
        po.rejection_reason,
        po.processed_by,
        po.processed_at,
        po.created_at,
        u.phone as user_phone,
        u.email as user_email,
        p.display_name as user_name,
        p.ff_uid as player_ff_uid,
        p.ff_ign as player_ff_ign
      FROM payment_orders po
      JOIN users u ON po.user_id = u.id
      LEFT JOIN profiles p ON po.user_id = p.user_id
      WHERE po.payment_id IS NOT NULL
    `;
        const params = [];
        if (status && status !== 'all') {
            query += ` AND po.status = ?`;
            params.push(status);
        }
        query += ` ORDER BY po.created_at DESC LIMIT 100`;
        return db.prepare(query).all(...params);
    }
    /**
     * Admin: Approve Deposit Request & Credit Wallet
     */
    static async approveDeposit(adminUserId, orderId) {
        const db = (0, db_1.getDb)();
        const order = db.prepare('SELECT * FROM payment_orders WHERE (id = ? OR order_id = ?)').get(orderId, orderId);
        if (!order) {
            throw new error_middleware_1.AppError('Deposit request not found.', 404);
        }
        if (order.status === 'completed') {
            throw new error_middleware_1.AppError('This deposit has already been approved.', 400);
        }
        if (order.status === 'failed') {
            throw new error_middleware_1.AppError('This deposit has already been rejected.', 400);
        }
        const ledgerId = (0, uuid_1.v4)();
        const amount = Number(order.amount);
        const cleanUtr = order.payment_id || order.order_id;
        db.exec('BEGIN TRANSACTION;');
        try {
            db.prepare(`
        UPDATE payment_orders 
        SET status = 'completed', 
            processed_by = ?, 
            processed_at = CURRENT_TIMESTAMP, 
            updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(adminUserId, order.id);
            db.prepare(`
        INSERT INTO wallet_ledger (id, user_id, type, amount, reference_id, description, created_at)
        VALUES (?, ?, 'deposit', ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(ledgerId, order.user_id, amount, cleanUtr, `UPI QR Deposit (UTR: ${cleanUtr})`);
            db.exec('COMMIT;');
        }
        catch (err) {
            try {
                db.exec('ROLLBACK;');
            }
            catch (_) { }
            throw err;
        }
        logger_1.Logger.audit({
            actorId: adminUserId,
            action: 'ADMIN_DEPOSIT_APPROVED',
            targetResource: 'payment_orders',
            targetId: order.id,
            details: { orderId: order.order_id, utrNumber: cleanUtr, amount, userId: order.user_id },
        });
        // Archive screenshot to Google Drive and delete local copy
        if (order.screenshot_url) {
            gdrive_service_1.GDriveService.archiveScreenshot({
                localScreenshotUrl: order.screenshot_url,
                orderId: order.order_id,
                utrNumber: cleanUtr,
                amount,
                status: 'approved',
            }).catch((e) => logger_1.Logger.error(`[GDRIVE] Error archiving approved deposit: ${e.message}`));
        }
        // Notify user of successful credit
        try {
            const { NotificationService } = require('../scheduler/notification.service');
            await NotificationService.sendNotificationToUser(order.user_id, {
                title: '💳 Deposit Approved!',
                body: `₹${amount.toFixed(2)} has been credited to your wallet (UTR: ${cleanUtr}).`,
                type: 'PRIZE_CREDITED',
                data: { amount, utrNumber: cleanUtr, orderId: order.order_id },
            });
        }
        catch (_) { }
        return {
            success: true,
            message: `Deposit of ₹${amount.toFixed(2)} approved and credited successfully.`,
            orderId: order.order_id,
            creditedAmount: amount,
        };
    }
    /**
     * Admin: Reject Deposit Request
     */
    static async rejectDeposit(adminUserId, orderId, reason) {
        const db = (0, db_1.getDb)();
        const order = db.prepare('SELECT * FROM payment_orders WHERE (id = ? OR order_id = ?)').get(orderId, orderId);
        if (!order) {
            throw new error_middleware_1.AppError('Deposit request not found.', 404);
        }
        if (order.status === 'completed') {
            throw new error_middleware_1.AppError('This deposit has already been approved and credited.', 400);
        }
        const rejectionReason = reason?.trim() || 'Payment not received in PhonePe / Invalid UTR.';
        db.prepare(`
      UPDATE payment_orders 
      SET status = 'failed', 
          rejection_reason = ?, 
          processed_by = ?, 
          processed_at = CURRENT_TIMESTAMP, 
          updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(rejectionReason, adminUserId, order.id);
        logger_1.Logger.audit({
            actorId: adminUserId,
            action: 'ADMIN_DEPOSIT_REJECTED',
            targetResource: 'payment_orders',
            targetId: order.id,
            details: { orderId: order.order_id, reason: rejectionReason, userId: order.user_id },
        });
        // Archive screenshot to Google Drive and delete local copy
        if (order.screenshot_url) {
            gdrive_service_1.GDriveService.archiveScreenshot({
                localScreenshotUrl: order.screenshot_url,
                orderId: order.order_id,
                utrNumber: order.payment_id || order.order_id,
                amount: Number(order.amount),
                status: 'rejected',
            }).catch((e) => logger_1.Logger.error(`[GDRIVE] Error archiving rejected deposit: ${e.message}`));
        }
        // Notify user of rejection
        try {
            const { NotificationService } = require('../scheduler/notification.service');
            await NotificationService.sendNotificationToUser(order.user_id, {
                title: '❌ Deposit Request Rejected',
                body: `Your deposit request (UTR: ${order.payment_id}) was rejected: ${rejectionReason}`,
                type: 'SYSTEM',
                data: { orderId: order.order_id, reason: rejectionReason },
            });
        }
        catch (_) { }
        return {
            success: true,
            message: 'Deposit request rejected.',
            orderId: order.order_id,
            rejectionReason,
        };
    }
}
exports.WalletService = WalletService;
