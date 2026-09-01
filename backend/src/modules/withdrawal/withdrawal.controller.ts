import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { WithdrawalService } from './withdrawal.service';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

const requestWithdrawalSchema = z.object({
  amount: z.number().min(100).max(50000),
  payoutMethod: z.enum(['upi', 'bank_transfer']),
  upiId: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankIfsc: z.string().optional(),
  bankAccountHolderName: z.string().optional(),
});

const processWithdrawalSchema = z.object({
  decision: z.enum(['completed', 'rejected']),
  payoutReferenceId: z.string().max(100).optional(),
  rejectionReason: z.string().max(250).optional(),
});

export class WithdrawalController {
  public static async requestWithdrawal(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const parsed = requestWithdrawalSchema.parse(req.body);

      const request = await WithdrawalService.requestWithdrawal(userId, parsed);
      res.status(201).json({
        success: true,
        message: 'Withdrawal request submitted successfully. 30% TDS deducted per tax regulations.',
        data: request,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getMyWithdrawals(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const list = await WithdrawalService.getUserWithdrawals(userId);
      res.status(200).json({ success: true, data: list });
    } catch (err) {
      next(err);
    }
  }

  public static async getAdminQueue(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = req.query.status as any | undefined;
      const page = parseInt(req.query.page as string || '1', 10);
      const limit = parseInt(req.query.limit as string || '20', 10);

      const data = await WithdrawalService.getAdminWithdrawalQueue({ status, page, limit });
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  public static async processWithdrawal(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminUserId = req.user!.userId;
      const requestId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const parsed = processWithdrawalSchema.parse(req.body);

      const updated = await WithdrawalService.processWithdrawal(adminUserId, requestId, parsed);
      res.status(200).json({
        success: true,
        message: `Withdrawal request ${parsed.decision} successfully.`,
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }
}
