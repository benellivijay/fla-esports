import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../../database/db';
import { Logger } from '../../utils/logger';
import { AppError } from '../../middleware/error.middleware';
import { WithdrawalRequest, PayoutMethod, WithdrawalStatus } from '../../types';
import { WalletService } from '../wallet/wallet.service';
import { NotificationService } from '../scheduler/notification.service';

export interface RequestWithdrawalInput {
  amount: number;
  payoutMethod: PayoutMethod;
  upiId?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  bankAccountHolderName?: string;
}

export interface ProcessWithdrawalInput {
  decision: 'completed' | 'rejected';
  payoutReferenceId?: string;
  rejectionReason?: string;
}

export class WithdrawalService {
  /**
   * Section 3.3: Player requests withdrawal to UPI or Bank with 30% TDS deduction
   */
  public static async requestWithdrawal(userId: string, input: RequestWithdrawalInput): Promise<WithdrawalRequest> {
    const { amount, payoutMethod, upiId, bankAccountNumber, bankIfsc, bankAccountHolderName } = input;
    const db = getDb();

    // 1. Verify user KYC (Phone and Email verified per user directive)
    const user = db.prepare('SELECT is_phone_verified, is_email_verified FROM users WHERE id = ?').get(userId) as any;
    if (!user || user.is_phone_verified !== 1 || user.is_email_verified !== 1) {
      throw new AppError(
        'KYC verification required. You must verify both phone and email in your Profile before requesting a withdrawal.',
        403,
        'KYC_NOT_VERIFIED'
      );
    }

    // 2. Validate amount limits (Min ₹100, Max ₹50,000)
    if (!amount || amount < 100) {
      throw new AppError('Minimum withdrawal amount is ₹100.00.', 400);
    }
    if (amount > 50000) {
      throw new AppError('Maximum withdrawal amount per request is ₹50,000.00.', 400);
    }

    // 3. Check wallet balance
    const currentBalance = WalletService.getWalletSummary(userId).balance;
    if (currentBalance < amount) {
      throw new AppError(
        `Insufficient wallet balance (Current: ₹${currentBalance.toFixed(2)}, Requested: ₹${amount.toFixed(2)}).`,
        400,
        'INSUFFICIENT_FUNDS'
      );
    }

    // 4. Validate payout credentials
    if (payoutMethod === 'upi') {
      if (!upiId || !upiId.includes('@')) {
        throw new AppError('Please provide a valid UPI ID (e.g. mobile@upi).', 400);
      }
    } else if (payoutMethod === 'bank_transfer') {
      if (!bankAccountNumber || !bankIfsc || !bankAccountHolderName) {
        throw new AppError('Account number, IFSC code, and account holder name are required for bank transfer.', 400);
      }
    }

    // 5. Calculate 30% TDS on net winnings
    const tdsDeducted = Math.round(amount * 0.30 * 100) / 100;
    const netPayableAmount = Math.round((amount - tdsDeducted) * 100) / 100;

    const requestId = uuidv4();
    const ledgerDebitId = uuidv4();

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
      `).run(
        requestId,
        userId,
        amount,
        payoutMethod,
        upiId || null,
        bankAccountNumber || null,
        bankIfsc ? bankIfsc.toUpperCase() : null,
        bankAccountHolderName || null,
        tdsDeducted,
        netPayableAmount
      );

      // Debit ledger for gross amount
      db.prepare(`
        INSERT INTO wallet_ledger (id, user_id, type, amount, reference_id, description, created_at)
        VALUES (?, ?, 'withdrawal', ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(
        ledgerDebitId,
        userId,
        amount,
        requestId,
        `Withdrawal to ${payoutMethod === 'upi' ? `UPI (${upiId})` : `Bank (${bankAccountNumber})`}`
      );

      db.exec('COMMIT;');
    } catch (err) {
      try { db.exec('ROLLBACK;'); } catch (_) {}
      throw err;
    }

    Logger.audit({
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

    return db.prepare('SELECT * FROM withdrawal_requests WHERE id = ?').get(requestId) as unknown as WithdrawalRequest;
  }

  /**
   * Section 3.3: Admin reviews and processes/rejects withdrawal request (with refund on rejection)
   */
  public static async processWithdrawal(
    adminUserId: string,
    requestId: string,
    input: ProcessWithdrawalInput
  ): Promise<WithdrawalRequest> {
    const { decision, payoutReferenceId, rejectionReason } = input;
    const db = getDb();

    const request = db.prepare('SELECT * FROM withdrawal_requests WHERE id = ?').get(requestId) as any;
    if (!request) {
      throw new AppError('Withdrawal request not found.', 404);
    }

    if (request.status === 'completed') {
      throw new AppError('This withdrawal request has already been completed.', 400);
    }

    if (request.status === 'rejected') {
      throw new AppError('This withdrawal request has already been rejected and refunded.', 400);
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
      } else {
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

        const refundId = uuidv4();
        db.prepare(`
          INSERT INTO wallet_ledger (id, user_id, type, amount, reference_id, description, created_at)
          VALUES (?, ?, 'refund', ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(
          refundId,
          request.user_id,
          request.amount,
          requestId,
          `Refund for rejected withdrawal request #${requestId.slice(-6)}`
        );
      }

      db.exec('COMMIT;');
    } catch (err) {
      try { db.exec('ROLLBACK;'); } catch (_) {}
      throw err;
    }

    Logger.audit({
      actorId: adminUserId,
      action: 'WITHDRAWAL_PROCESSED',
      targetResource: 'withdrawal_requests',
      targetId: requestId,
      details: { decision, payoutReferenceId, rejectionReason },
    });

    if (decision === 'completed') {
      const utr = payoutReferenceId || 'UTR_GATEWAY';
      NotificationService.sendNotificationToUser(request.user_id, {
        title: 'Withdrawal Paid Successfully! 🏦',
        body: `₹${request.net_payable_amount.toFixed(2)} has been transferred to your ${request.payout_method === 'upi' ? 'UPI' : 'Bank account'} (UTR: ${utr}).`,
        type: 'WITHDRAWAL_COMPLETED',
        data: { requestId, utr, amount: request.net_payable_amount },
      }).catch((e) => Logger.error(`Failed to send withdrawal completed notification: ${e.message}`));
    } else {
      NotificationService.sendNotificationToUser(request.user_id, {
        title: 'Withdrawal Rejected & Refunded 🔄',
        body: `Your withdrawal of ₹${request.amount.toFixed(2)} was rejected (${rejectionReason || 'Invalid details'}) and refunded to your wallet.`,
        type: 'WITHDRAWAL_REJECTED',
        data: { requestId, refundAmount: request.amount },
      }).catch((e) => Logger.error(`Failed to send withdrawal rejection notification: ${e.message}`));
    }

    return db.prepare('SELECT * FROM withdrawal_requests WHERE id = ?').get(requestId) as unknown as WithdrawalRequest;
  }

  /**
   * Retrieves player's withdrawal requests
   */
  public static async getUserWithdrawals(userId: string): Promise<WithdrawalRequest[]> {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM withdrawal_requests 
      WHERE user_id = ? 
      ORDER BY created_at DESC
    `).all(userId) as unknown as WithdrawalRequest[];
  }

  /**
   * Admin withdrawal queue
   */
  public static async getAdminWithdrawalQueue(filters: {
    status?: WithdrawalStatus;
    page?: number;
    limit?: number;
  }): Promise<{ queue: any[]; total: number; page: number; limit: number }> {
    const db = getDb();
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
    const params: any[] = [];
    const countParams: any[] = [];

    if (filters.status) {
      query += ' AND w.status = ?';
      countQuery += ' AND status = ?';
      params.push(filters.status);
      countParams.push(filters.status);
    }

    query += ' ORDER BY w.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const queue = db.prepare(query).all(...params) as any[];
    const totalCountRow = db.prepare(countQuery).get(...countParams) as any;

    return {
      queue,
      total: totalCountRow?.count || 0,
      page,
      limit,
    };
  }
}
