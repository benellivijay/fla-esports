import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AdminService } from './admin.service';
import { WalletService } from '../wallet/wallet.service';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const verifyTotpSchema = z.object({
  tempToken: z.string().min(10),
  totpCode: z.string().length(6),
});

const verifyResultSchema = z.object({
  confirmedRank: z.number().int().positive().optional(),
  confirmedKills: z.number().int().min(0).optional(),
});

const disputeResultSchema = z.object({
  reasonNote: z.string().min(1, 'Dispute reason note is required.'),
});

const adjustWalletSchema = z.object({
  targetUserId: z.string().uuid(),
  amount: z.number().positive(),
  type: z.enum(['deposit', 'refund', 'entry_fee_debit']),
  reason: z.string().min(1, 'Reason note is required.'),
});

const updateUserStatusSchema = z.object({
  status: z.enum(['active', 'suspended', 'banned']),
  reason: z.string().optional(),
});

const updateUserRoleSchema = z.object({
  role: z.enum(['user', 'moderator', 'admin']),
});

export class AdminController {
  /**
   * Public admin login (Step 1)
   */
  public static async adminLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = adminLoginSchema.parse(req.body);
      const result = await AdminService.adminLogin(email, password);
      res.status(200).json({ success: true, message: 'Password verified. TOTP 2FA required.', data: result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Public TOTP 2FA verification (Step 2)
   */
  public static async verifyTotp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { tempToken, totpCode } = verifyTotpSchema.parse(req.body);
      const result = await AdminService.verifyTotp2FA(tempToken, totpCode);
      res.status(200).json({ success: true, message: 'Authentication successful.', data: result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Dashboard home summary statistics
   */
  public static async getDashboardStats(_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await AdminService.getDashboardStats();
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Result review queue
   */
  public static async getResultsQueue(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tournamentId = req.query.tournamentId as string | undefined;
      const status = req.query.status as string | undefined;
      const data = await AdminService.getResultsQueue(tournamentId, status);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Approve match result
   */
  public static async verifyResult(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user!.userId;
      const resultId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const { confirmedRank, confirmedKills } = verifyResultSchema.parse(req.body);
      const data = await AdminService.verifyResult(adminId, resultId, confirmedRank, confirmedKills);
      res.status(200).json({ success: true, message: 'Result marked as verified.', data });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Dispute match result
   */
  public static async disputeResult(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user!.userId;
      const resultId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const { reasonNote } = disputeResultSchema.parse(req.body);
      const data = await AdminService.disputeResult(adminId, resultId, reasonNote);
      res.status(200).json({ success: true, message: 'Result marked as disputed.', data });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Payout preview
   */
  public static async getPayoutPreview(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tournamentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const data = await AdminService.getPayoutPreview(tournamentId);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Idempotent payout run execution
   */
  public static async executePayoutRun(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user!.userId;
      const tournamentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const data = await AdminService.executePayoutRun(adminId, tournamentId);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  /**
   * User management: list users
   */
  public static async listUsers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const search = req.query.search as string | undefined;
      const role = req.query.role as string | undefined;
      const status = req.query.status as string | undefined;
      const page = parseInt(req.query.page as string || '1', 10);
      const limit = parseInt(req.query.limit as string || '20', 10);

      const data = await AdminService.listUsers(search, role, status, page, limit);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  /**
   * User status toggle
   */
  public static async updateUserStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user!.userId;
      const targetUserId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const { status, reason } = updateUserStatusSchema.parse(req.body);
      const data = await AdminService.updateUserStatus(adminId, targetUserId, status, reason);
      res.status(200).json({ success: true, message: `User status updated to ${status}.`, data });
    } catch (err) {
      next(err);
    }
  }

  /**
   * User role assignment (Super admin only)
   */
  public static async updateUserRole(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user!.userId;
      const targetUserId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const { role } = updateUserRoleSchema.parse(req.body);
      const data = await AdminService.updateUserRole(adminId, targetUserId, role);
      res.status(200).json({ success: true, message: `User role updated to ${role}.`, data });
    } catch (err) {
      next(err);
    }
  }

  /**
   * User ledger statement
   */
  public static async getUserLedger(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const data = await AdminService.getUserLedger(userId);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Manual wallet adjustment
   */
  public static async adjustWallet(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user!.userId;
      const { targetUserId, amount, type, reason } = adjustWalletSchema.parse(req.body);
      const data = await AdminService.adjustUserWallet(adminId, targetUserId, amount, type, reason);
      res.status(200).json({ success: true, message: 'Wallet adjustment successfully processed.', data });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Audit logs
   */
  public static async getAuditLogs(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string || '50', 10);
      const page = parseInt(req.query.page as string || '1', 10);
      const action = req.query.action as string | undefined;
      const actorId = req.query.actorId as string | undefined;

      const result = await AdminService.getAuditLogs(limit, page, action, actorId);
      res.status(200).json({
        success: true,
        count: result.total,
        total: result.total,
        page: result.page,
        limit: result.limit,
        data: result.logs,
        logs: result.logs,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getPendingFFVerifications(_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await AdminService.getPendingFFVerifications();
      res.status(200).json({ success: true, count: data.length, data });
    } catch (err) {
      next(err);
    }
  }

  public static async reviewFFVerification(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user!.userId;
      const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
      const { approved, rejectionReason } = req.body;
      const result = await AdminService.reviewFFVerification(adminId, userId, !!approved, rejectionReason);
      res.status(200).json({ success: true, message: `FF UID verification ${approved ? 'approved' : 'rejected'}.`, data: result });
    } catch (err) {
      next(err);
    }
  }

  public static async getPendingKYCSubmissions(_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await AdminService.getPendingKYCSubmissions();
      res.status(200).json({ success: true, count: data.length, data });
    } catch (err) {
      next(err);
    }
  }

  public static async reviewKYC(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user!.userId;
      const kycId = Array.isArray(req.params.kycId) ? req.params.kycId[0] : req.params.kycId;
      const { approved, rejectionReason } = req.body;
      const result = await AdminService.reviewKYC(adminId, kycId, !!approved, rejectionReason);
      res.status(200).json({ success: true, message: `KYC submission ${approved ? 'approved' : 'rejected'}.`, data: result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * UPI QR Deposit Queue
   */
  public static async getDepositQueue(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = req.query.status as string | undefined;
      const data = await WalletService.getDepositQueue(status);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Approve Deposit
   */
  public static async approveDeposit(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user!.userId;
      const orderId = Array.isArray(req.params.orderId) ? req.params.orderId[0] : req.params.orderId;
      const result = await WalletService.approveDeposit(adminId, orderId);
      res.status(200).json({ success: true, message: result.message, data: result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Reject Deposit
   */
  public static async rejectDeposit(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user!.userId;
      const orderId = Array.isArray(req.params.orderId) ? req.params.orderId[0] : req.params.orderId;
      const reason = req.body.reason as string | undefined;
      const result = await WalletService.rejectDeposit(adminId, orderId, reason);
      res.status(200).json({ success: true, message: result.message, data: result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * List Support Tickets & Complaints
   */
  public static async listSupportTickets(_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { SupportService } = await import('../support/support.service');
      const tickets = await SupportService.getAllTickets();
      res.status(200).json({ success: true, data: { tickets } });
    } catch (err) {
      next(err);
    }
  }

  /**
   * ==========================================
   * Staff & Dedicated Authenticator Endpoints
   * ==========================================
   */

  /**
   * GET /admin/staff
   */
  public static async listStaff(_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const staff = await AdminService.listStaffUsers();
      res.status(200).json({ success: true, data: staff });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /admin/staff
   */
  public static async createStaff(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user!.userId;
      const schema = z.object({
        email: z.string().email('Invalid staff email address'),
        username: z.string().min(3).max(30).optional(),
        password: z.string().min(6, 'Password must be at least 6 characters'),
        role: z.enum(['admin', 'moderator']).default('admin'),
        displayName: z.string().max(60).optional(),
        totpSecret: z.string().min(8).max(64).optional(),
      });

      const body = schema.parse(req.body);
      const created = await AdminService.createStaffUser(adminId, body);
      res.status(201).json({
        success: true,
        message: `Staff account ${created.email} created with dedicated 2FA authenticator!`,
        data: created,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /admin/staff/:id
   */
  public static async updateStaff(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user!.userId;
      const targetId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const schema = z.object({
        role: z.enum(['admin', 'moderator']).optional(),
        status: z.enum(['active', 'suspended']).optional(),
        password: z.string().min(6).optional(),
        displayName: z.string().max(60).optional(),
      });

      const body = schema.parse(req.body);
      const updated = await AdminService.updateStaffUser(adminId, targetId, body);
      res.status(200).json({
        success: true,
        message: 'Staff account updated successfully.',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /admin/staff/:id/regenerate-2fa
   */
  public static async regenerateStaffTotp(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user!.userId;
      const targetId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await AdminService.regenerateStaffTotp(adminId, targetId);
      res.status(200).json({
        success: true,
        message: 'New dedicated 2FA Authenticator secret generated successfully.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /admin/staff/:id
   */
  public static async deleteStaff(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user!.userId;
      const targetId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      await AdminService.deleteStaffUser(adminId, targetId);
      res.status(200).json({
        success: true,
        message: 'Staff account removed successfully.',
      });
    } catch (err) {
      next(err);
    }
  }
}
