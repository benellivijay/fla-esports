"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletController = void 0;
const zod_1 = require("zod");
const wallet_service_1 = require("./wallet.service");
const createOrderSchema = zod_1.z.object({
    amount: zod_1.z.number().positive().min(10).max(50000),
    gateway: zod_1.z.enum(['cashfree_sandbox', 'razorpay_sandbox', 'mock_gateway']).optional(),
});
const verifyDepositSchema = zod_1.z.object({
    orderId: zod_1.z.string().min(5),
    paymentId: zod_1.z.string().min(5),
    signature: zod_1.z.string().min(10),
});
class WalletController {
    static async getSummary(req, res, next) {
        try {
            const userId = req.user.userId;
            const summary = wallet_service_1.WalletService.getWalletSummary(userId);
            res.status(200).json({ success: true, data: summary });
        }
        catch (err) {
            next(err);
        }
    }
    static async createOrder(req, res, next) {
        try {
            const userId = req.user.userId;
            const parsed = createOrderSchema.parse(req.body);
            const order = await wallet_service_1.WalletService.createDepositOrder(userId, parsed);
            res.status(201).json({ success: true, data: order });
        }
        catch (err) {
            next(err);
        }
    }
    static async verifyDeposit(req, res, next) {
        try {
            const userId = req.user.userId;
            const parsed = verifyDepositSchema.parse(req.body);
            const result = await wallet_service_1.WalletService.verifyAndCreditDeposit(userId, parsed);
            res.status(200).json({
                success: true,
                message: `₹${result.creditedAmount.toFixed(2)} credited to your wallet successfully!`,
                data: result,
            });
        }
        catch (err) {
            next(err);
        }
    }
    static async getTransactions(req, res, next) {
        try {
            const userId = req.user.userId;
            const filterType = req.query.type;
            const page = parseInt(req.query.page || '1', 10);
            const limit = parseInt(req.query.limit || '20', 10);
            const history = await wallet_service_1.WalletService.getLedgerHistory(userId, filterType, page, limit);
            res.status(200).json({ success: true, data: history });
        }
        catch (err) {
            next(err);
        }
    }
    static async submitQrDeposit(req, res, next) {
        try {
            const userId = req.user.userId;
            const amount = parseFloat(req.body.amount);
            const utrNumber = req.body.utrNumber;
            const qrUsed = req.body.qrUsed;
            const screenshotUrl = req.file ? `/uploads/${req.file.filename}` : undefined;
            const result = await wallet_service_1.WalletService.submitQrDeposit(userId, {
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
        }
        catch (err) {
            next(err);
        }
    }
}
exports.WalletController = WalletController;
