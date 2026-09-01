import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { WalletService } from './wallet.service';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

const createOrderSchema = z.object({
  amount: z.number().positive().min(10).max(50000),
  gateway: z.enum(['cashfree_sandbox', 'razorpay_sandbox', 'mock_gateway']).optional(),
});

const verifyDepositSchema = z.object({
  orderId: z.string().min(5),
  paymentId: z.string().min(5),
  signature: z.string().min(10),
});

export class WalletController {
  public static async getSummary(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const summary = WalletService.getWalletSummary(userId);
      res.status(200).json({ success: true, data: summary });
    } catch (err) {
      next(err);
    }
  }

  public static async createOrder(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const parsed = createOrderSchema.parse(req.body);
      const order = await WalletService.createDepositOrder(userId, parsed);
      res.status(201).json({ success: true, data: order });
    } catch (err) {
      next(err);
    }
  }

  public static async verifyDeposit(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const parsed = verifyDepositSchema.parse(req.body);
      const result = await WalletService.verifyAndCreditDeposit(userId, parsed);
      res.status(200).json({
        success: true,
        message: `₹${result.creditedAmount.toFixed(2)} credited to your wallet successfully!`,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getTransactions(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const filterType = req.query.type as string | undefined;
      const page = parseInt(req.query.page as string || '1', 10);
      const limit = parseInt(req.query.limit as string || '20', 10);

      const history = await WalletService.getLedgerHistory(userId, filterType, page, limit);
      res.status(200).json({ success: true, data: history });
    } catch (err) {
      next(err);
    }
  }

  public static async submitQrDeposit(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const amount = parseFloat(req.body.amount);
      const utrNumber = req.body.utrNumber as string;
      const qrUsed = req.body.qrUsed as string | undefined;
      const screenshotUrl = req.file ? `/uploads/${req.file.filename}` : undefined;

      const result = await WalletService.submitQrDeposit(userId, {
        amount,
        utrNumber,
        screenshotUrl,
        qrUsed,
      });

      res.status(201).json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}
