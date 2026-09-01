import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../../database/db';
import { Logger } from '../../utils/logger';
import { AppError } from '../../middleware/error.middleware';
import { WalletSummary, PaymentOrder, PaymentGateway, WalletLedgerEntry, LedgerEntryType } from '../../types';
import { config } from '../../config/env';
import { GDriveService } from '../../services/gdrive.service';

export interface CreateOrderDTO {
  amount: number;
  gateway?: PaymentGateway;
}

export interface VerifyDepositDTO {
  orderId: string;
  paymentId: string;
  signature: string;
}

export class WalletService {
  private static readonly WEBHOOK_SECRET = process.env.GATEWAY_WEBHOOK_SECRET || 'ff_esports_webhook_secret_key_2026';

  /**
   * Helper: Generates valid HMAC-SHA256 signature for client/gateway verification
   */
  public static generateSignature(orderId: string, paymentId: string): string {
    return crypto
      .createHmac('sha256', this.WEBHOOK_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
  }

  /**
   * Section 3.3: Balance = sum of ledger entries for a user (ledger is the source of truth)
   */
  public static getWalletSummary(userId: string): WalletSummary {
    const db = getDb();
    const row = db.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE 0 END), 0.0) as total_deposited,
        COALESCE(SUM(CASE WHEN type = 'prize_credit' THEN amount ELSE 0 END), 0.0) as total_winnings,
        COALESCE(SUM(CASE WHEN type = 'entry_fee_debit' THEN amount ELSE 0 END), 0.0) as total_spent,
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
    `).get(userId) as any;

    return {
      balance: Number(row?.current_balance || 0.0),
      totalDeposited: Number(row?.total_deposited || 0.0),
      totalWinnings: Number(row?.total_winnings || 0.0),
      totalSpent: Number(row?.total_spent || 0.0),
      totalRefunds: Number(row?.total_refunds || 0.0),
      currency: 'INR',
    };
  }

  /**
   * Step 4.1: Initiates a deposit payment order
   */
  public static async createDepositOrder(userId: string, data: CreateOrderDTO): Promise<{
    orderId: string;
    amount: number;
    currency: string;
    gateway: PaymentGateway;
    paymentSessionId: string;
    keyId: string;
  }> {
    const { amount, gateway = 'mock_gateway' } = data;

    if (!amount || amount < 10) {
      throw new AppError('Minimum deposit amount is ₹10.00.', 400);
    }
    if (amount > 50000) {
      throw new AppError('Maximum deposit amount per transaction is ₹50,000.00.', 400);
    }

    const db = getDb();
    const orderId = `ORD_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    const internalId = uuidv4();
    const paymentSessionId = `sess_${uuidv4()}`;

    db.prepare(`
      INSERT INTO payment_orders (id, user_id, order_id, amount, currency, status, gateway, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'INR', 'pending', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(internalId, userId, orderId, amount, gateway);

    Logger.audit({
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
  public static async verifyAndCreditDeposit(userId: string, data: VerifyDepositDTO): Promise<{
    success: boolean;
    orderId: string;
    paymentId: string;
    creditedAmount: number;
    newBalance: number;
  }> {
    const { orderId, paymentId, signature } = data;
    const db = getDb();

    // 1. Fetch payment order
    const order = db.prepare('SELECT * FROM payment_orders WHERE order_id = ? AND user_id = ?').get(orderId, userId) as any;
    if (!order) {
      throw new AppError('Payment order not found.', 404);
    }

    // 2. Verify HMAC-SHA256 signature
    const expectedSignature = this.generateSignature(orderId, paymentId);
    if (signature !== expectedSignature) {
      throw new AppError('Invalid payment signature verification failed.', 400, 'INVALID_SIGNATURE');
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

    const existingLedgerEntry = db.prepare('SELECT id FROM wallet_ledger WHERE reference_id = ?').get(paymentId) as any;
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
    const ledgerId = uuidv4();

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
    } catch (err) {
      try { db.exec('ROLLBACK;'); } catch (_) {}
      throw err;
    }

    Logger.audit({
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
  public static async getLedgerHistory(
    userId: string,
    filterType?: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ transactions: WalletLedgerEntry[]; total: number; page: number; limit: number }> {
    const db = getDb();
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM wallet_ledger WHERE user_id = ?';
    let countQuery = 'SELECT COUNT(*) as count FROM wallet_ledger WHERE user_id = ?';
    const params: any[] = [userId];
    const countParams: any[] = [userId];

    if (filterType && filterType !== 'all') {
      query += ' AND type = ?';
      countQuery += ' AND type = ?';
      params.push(filterType);
      countParams.push(filterType);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const transactions = db.prepare(query).all(...params) as unknown as WalletLedgerEntry[];
    const totalCountRow = db.prepare(countQuery).get(...countParams) as any;

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
  public static async submitQrDeposit(
    userId: string,
    data: {
      amount: number;
      utrNumber: string;
      screenshotUrl?: string;
      qrUsed?: string;
    }
  ): Promise<{
    success: boolean;
    orderId: string;
    utrNumber: string;
    amount: number;
    status: string;
    message: string;
  }> {
    const { amount, utrNumber, screenshotUrl, qrUsed } = data;
    const cleanUtr = utrNumber.trim().toUpperCase();

    if (!amount || amount < 10) {
      throw new AppError('Minimum deposit amount is ₹10.00.', 400);
    }
    if (amount > 50000) {
      throw new AppError('Maximum deposit amount per transaction is ₹50,000.00.', 400);
    }
    if (!cleanUtr || cleanUtr.length < 6) {
      throw new AppError('Please enter a valid UPI UTR / Transaction Reference Number (minimum 6 characters).', 400);
    }

    const db = getDb();

    // 1. Anti-Fraud Check: Has this UTR already been submitted or credited?
    const existingOrder = db.prepare(`
      SELECT id, user_id, status FROM payment_orders 
      WHERE payment_id = ? AND status IN ('pending', 'completed')
    `).get(cleanUtr) as any;

    if (existingOrder) {
      throw new AppError('This UTR / Transaction Reference Number has already been submitted for verification.', 409, 'UTR_ALREADY_USED');
    }

    const orderId = `ORD_UPI_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    const internalId = uuidv4();

    db.prepare(`
      INSERT INTO payment_orders (
        id, user_id, order_id, amount, currency, status, gateway, 
        payment_id, signature, screenshot_url, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'INR', 'pending', 'mock_gateway', ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(internalId, userId, orderId, amount, cleanUtr, qrUsed || 'phonepe_qr', screenshotUrl || null);

    Logger.audit({
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
    } catch (_) {}

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
  public static async getDepositQueue(status?: string): Promise<any[]> {
    const db = getDb();
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
    const params: any[] = [];

    if (status && status !== 'all') {
      query += ` AND po.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY po.created_at DESC LIMIT 100`;

    return db.prepare(query).all(...params) as any[];
  }

  /**
   * Admin: Approve Deposit Request & Credit Wallet
   */
  public static async approveDeposit(adminUserId: string, orderId: string): Promise<any> {
    const db = getDb();
    const order = db.prepare('SELECT * FROM payment_orders WHERE (id = ? OR order_id = ?)').get(orderId, orderId) as any;

    if (!order) {
      throw new AppError('Deposit request not found.', 404);
    }
    if (order.status === 'completed') {
      throw new AppError('This deposit has already been approved.', 400);
    }
    if (order.status === 'failed') {
      throw new AppError('This deposit has already been rejected.', 400);
    }

    const ledgerId = uuidv4();
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
    } catch (err) {
      try { db.exec('ROLLBACK;'); } catch (_) {}
      throw err;
    }

    Logger.audit({
      actorId: adminUserId,
      action: 'ADMIN_DEPOSIT_APPROVED',
      targetResource: 'payment_orders',
      targetId: order.id,
      details: { orderId: order.order_id, utrNumber: cleanUtr, amount, userId: order.user_id },
    });

    // Archive screenshot to Google Drive and delete local copy
    if (order.screenshot_url) {
      GDriveService.archiveScreenshot({
        localScreenshotUrl: order.screenshot_url,
        orderId: order.order_id,
        utrNumber: cleanUtr,
        amount,
        status: 'approved',
      }).catch((e) => Logger.error(`[GDRIVE] Error archiving approved deposit: ${e.message}`));
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
    } catch (_) {}

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
  public static async rejectDeposit(adminUserId: string, orderId: string, reason?: string): Promise<any> {
    const db = getDb();
    const order = db.prepare('SELECT * FROM payment_orders WHERE (id = ? OR order_id = ?)').get(orderId, orderId) as any;

    if (!order) {
      throw new AppError('Deposit request not found.', 404);
    }
    if (order.status === 'completed') {
      throw new AppError('This deposit has already been approved and credited.', 400);
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

    Logger.audit({
      actorId: adminUserId,
      action: 'ADMIN_DEPOSIT_REJECTED',
      targetResource: 'payment_orders',
      targetId: order.id,
      details: { orderId: order.order_id, reason: rejectionReason, userId: order.user_id },
    });

    // Archive screenshot to Google Drive and delete local copy
    if (order.screenshot_url) {
      GDriveService.archiveScreenshot({
        localScreenshotUrl: order.screenshot_url,
        orderId: order.order_id,
        utrNumber: order.payment_id || order.order_id,
        amount: Number(order.amount),
        status: 'rejected',
      }).catch((e) => Logger.error(`[GDRIVE] Error archiving rejected deposit: ${e.message}`));
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
    } catch (_) {}

    return {
      success: true,
      message: 'Deposit request rejected.',
      orderId: order.order_id,
      rejectionReason,
    };
  }
}
