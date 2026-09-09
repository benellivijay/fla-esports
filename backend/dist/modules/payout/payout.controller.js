"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayoutController = void 0;
const payout_service_1 = require("./payout.service");
class PayoutController {
    static async distributePayouts(req, res, next) {
        try {
            const adminUserId = req.user.userId;
            const tournamentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const summary = await payout_service_1.PayoutService.distributeTournamentPayouts(adminUserId, tournamentId);
            res.status(200).json({
                success: true,
                message: `Payouts distributed successfully to ${summary.totalWinners} winners (Total: ₹${summary.totalAmountPaid.toFixed(2)}). Match marked completed.`,
                data: summary,
            });
        }
        catch (err) {
            next(err);
        }
    }
}
exports.PayoutController = PayoutController;
