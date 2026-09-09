"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WithdrawalService = void 0;
const uuid_1 = require("uuid");
const db_1 = require("../../database/db");
const logger_1 = require("../../utils/logger");
const error_middleware_1 = require("../../middleware/error.middleware");
const wallet_service_1 = require("../wallet/wallet.service");
const notification_service_1 = require("../scheduler/notification.service");
class WithdrawalService {
    /**
     * Section 3.3: Player requests withdrawal to UPI or Bank with 30% TDS deduction
     */
    static async requestWithdrawal(userId, input) {
        const { amount, payoutMethod, upiId, bankAccountNumber, bankIfsc, bankAccountHolderName } = input;
        const db = (0, db_1.getDb)();
        // 1. Verify user KYC (Phone and Email verified per user directive)
        const user = db.prepare('SELECT is_phone_verified, is_email_verified FROM users WHERE id = ?').get(userId);
        if (!user || user.is_phone_verified !== 1 || user.is_email_verified !== 1) {
            throw new error_middleware_1.AppError('KYC verification required. You must verify both phone and email in your Profile before requesting a withdrawal.', 403, 'KYC_NOT_VERIFIED');
        }
        // 2. Validate amount limits (Min ₹100, Max ₹50,000)
        if (!amount || amount < 100) {
            throw new error_middleware_1.AppError('Minimum withdrawal amount is ₹100.00.', 400);
        }
        if (amount > 50000) {
            throw new error_middleware_1.AppError('Maximum withdrawal amount per request is ₹50,000.00.', 400);
        }
        // 3. Check wallet withdrawable balance (Only tournament winnings can be withdrawn)
        const walletSummary = wallet_service_1.WalletService.getWalletSummary(userId);
        if (walletSummary.withdrawableBalance < amount) {
            throw new error_middleware_1.AppError(`Insufficient withdrawable balance. You have ₹${walletSummary.withdrawableBalance.toFixed(2)} in tournament winnings. Deposited funds cannot be withdrawn and can only be used for joining tournaments.`, 400, 'INSUFFICIENT_WINNINGS');
        }
        // 4. Validate payout credentials
        if (payoutMethod === 'upi') {
            if (!upiId || !upiId.includes('@')) {
                throw new error_middleware_1.AppError('Please provide a valid UPI ID (e.g. mobile@upi).', 400);
            }
        }
        else if (payoutMethod === 'bank_transfer') {
            if (!bankAccountNumber || !bankIfsc || !bankAccountHolderName) {
                throw new error_middleware_1.AppError('Account number, IFSC code, and account holder name are required for bank transfer.', 400);
            }
        }
        // 5. Calculate 30% TDS on net winnings
        const tdsDeducted = Math.round(amount * 0.30 * 100) / 100;
        const netPayableAmount = Math.round((amount - tdsDeducted) * 100) / 100;
        const requestId = (0, uuid_1.v4)();
        const ledgerDebitId = (0, uuid_1.v4)();
        // 6. ACID Transaction: Create request and debit ledger immediately
        db.exec('BEGIN TRANSACTION;');
        try {
            db.prepare(`
        INSERT INTO withdrawal_requests (
          id, user_id, amount, payout_method, upi_id, 
          bank_account_number, bank_ifsc, bank_account_holder_name, 
          tds_deducted, net_payable_amount, status, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, 
          ?, ?, ?, 
          ?, ?, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `).run(requestId, userId, amount, payoutMethod, upiId || null, bankAccountNumber || null, bankIfsc ? bankIfsc.toUpperCase() : null, bankAccountHolderName || null, tdsDeducted, netPayableAmount);
            // Debit ledger for gross amount
            db.prepare(`
        INSERT INTO wallet_ledger (id, user_id, type, amount, reference_id, description, created_at)
        VALUES (?, ?, 'withdrawal', ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(ledgerDebitId, userId, amount, requestId, `Withdrawal to ${payoutMethod === 'upi' ? `UPI (${upiId})` : `Bank (${bankAccountNumber})`}`);
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
            action: 'WITHDRAWAL_REQUESTED',
            targetResource: 'withdrawal_requests',
            targetId: requestId,
            details: {
                amount,
                tdsDeducted,
                netPayableAmount,
                payoutMethod,
            },
        });
        return db.prepare('SELECT * FROM withdrawal_requests WHERE id = ?').get(requestId);
    }
    /**
     * Section 3.3: Admin reviews and processes/rejects withdrawal request (with refund on rejection)
     */
    static async processWithdrawal(adminUserId, requestId, input) {
        const { decision, payoutReferenceId, rejectionReason } = input;
        const db = (0, db_1.getDb)();
        const request = db.prepare('SELECT * FROM withdrawal_requests WHERE id = ?').get(requestId);
        if (!request) {
            throw new error_middleware_1.AppError('Withdrawal request not found.', 404);
        }
        if (request.status === 'completed') {
            throw new error_middleware_1.AppError('This withdrawal request has already been completed.', 400);
        }
        if (request.status === 'rejected') {
            throw new error_middleware_1.AppError('This withdrawal request has already been rejected and refunded.', 400);
        }
        db.exec('BEGIN TRANSACTION;');
        try {
            if (decision === 'completed') {
                const utr = payoutReferenceId || `UTR_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
                db.prepare(`
          UPDATE withdrawal_requests 
          SET status = 'completed',
              payout_reference_id = ?,
              processed_by = ?,
              processed_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(utr, adminUserId, requestId);
            }
            else {
                // Reject and atomically refund gross amount to player ledger
                db.prepare(`
          UPDATE withdrawal_requests 
          SET status = 'rejected',
              rejection_reason = ?,
              processed_by = ?,
              processed_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(rejectionReason || 'Withdrawal rejected by administrator.', adminUserId, requestId);
                const refundId = (0, uuid_1.v4)();
                db.prepare(`
          INSERT INTO wallet_ledger (id, user_id, type, amount, reference_id, description, created_at)
          VALUES (?, ?, 'refund', ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(refundId, request.user_id, request.amount, requestId, `Refund for rejected withdrawal request #${requestId.slice(-6)}`);
            }
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
            action: 'WITHDRAWAL_PROCESSED',
            targetResource: 'withdrawal_requests',
            targetId: requestId,
            details: { decision, payoutReferenceId, rejectionReason },
        });
        if (decision === 'completed') {
            const utr = payoutReferenceId || 'UTR_GATEWAY';
            notification_service_1.NotificationService.sendNotificationToUser(request.user_id, {
                title: 'Withdrawal Paid Successfully! 🏦',
                body: `₹${request.net_payable_amount.toFixed(2)} has been transferred to your ${request.payout_method === 'upi' ? 'UPI' : 'Bank account'} (UTR: ${utr}).`,
                type: 'WITHDRAWAL_COMPLETED',
                data: { requestId, utr, amount: request.net_payable_amount },
            }).catch((e) => logger_1.Logger.error(`Failed to send withdrawal completed notification: ${e.message}`));
        }
        else {
            notification_service_1.NotificationService.sendNotificationToUser(request.user_id, {
                title: 'Withdrawal Rejected & Refunded 🔄',
                body: `Your withdrawal of ₹${request.amount.toFixed(2)} was rejected (${rejectionReason || 'Invalid details'}) and refunded to your wallet.`,
                type: 'WITHDRAWAL_REJECTED',
                data: { requestId, refundAmount: request.amount },
            }).catch((e) => logger_1.Logger.error(`Failed to send withdrawal rejection notification: ${e.message}`));
        }
        return db.prepare('SELECT * FROM withdrawal_requests WHERE id = ?').get(requestId);
    }
    /**
     * Retrieves player's withdrawal requests
     */
    static async getUserWithdrawals(userId) {
        const db = (0, db_1.getDb)();
        return db.prepare(`
      SELECT * FROM withdrawal_requests 
      WHERE user_id = ? 
      ORDER BY created_at DESC
    `).all(userId);
    }
    /**
     * Admin withdrawal queue
     */
    static async getAdminWithdrawalQueue(filters) {
        const db = (0, db_1.getDb)();
        const page = filters.page || 1;
        const limit = filters.limit || 20;
        const offset = (page - 1) * limit;
        let query = `
      SELECT 
        w.*,
        u.phone,
        u.email,
        p.display_name,
        p.ff_uid,
        p.ff_ign
      FROM withdrawal_requests w
      JOIN users u ON u.id = w.user_id
      JOIN profiles p ON p.user_id = w.user_id
      WHERE 1=1
    `;
        let countQuery = 'SELECT COUNT(*) as count FROM withdrawal_requests WHERE 1=1';
        const params = [];
        const countParams = [];
        if (filters.status) {
            query += ' AND w.status = ?';
            countQuery += ' AND status = ?';
            params.push(filters.status);
            countParams.push(filters.status);
        }
        query += ' ORDER BY w.created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);
        const queue = db.prepare(query).all(...params);
        const totalCountRow = db.prepare(countQuery).get(...countParams);
        return {
            queue,
            total: totalCountRow?.count || 0,
            page,
            limit,
        };
    }
}
exports.WithdrawalService = WithdrawalService;
