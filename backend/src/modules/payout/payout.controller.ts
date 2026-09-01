import { Response, NextFunction } from 'express';
import { PayoutService } from './payout.service';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

export class PayoutController {
  public static async distributePayouts(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminUserId = req.user!.userId;
      const tournamentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

      const summary = await PayoutService.distributeTournamentPayouts(adminUserId, tournamentId);
      res.status(200).json({
        success: true,
        message: `Payouts distributed successfully to ${summary.totalWinners} winners (Total: ₹${summary.totalAmountPaid.toFixed(2)}). Match marked completed.`,
        data: summary,
      });
    } catch (err) {
      next(err);
    }
  }
}
