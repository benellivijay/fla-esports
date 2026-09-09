"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WithdrawalController = void 0;
const zod_1 = require("zod");
const withdrawal_service_1 = require("./withdrawal.service");
const requestWithdrawalSchema = zod_1.z.object({
    amount: zod_1.z.number().min(100).max(50000),
    payoutMethod: zod_1.z.enum(['upi', 'bank_transfer']),
    upiId: zod_1.z.string().optional(),
    bankAccountNumber: zod_1.z.string().optional(),
    bankIfsc: zod_1.z.string().optional(),
    bankAccountHolderName: zod_1.z.string().optional(),
});
const processWithdrawalSchema = zod_1.z.object({
    decision: zod_1.z.enum(['completed', 'rejected']),
    payoutReferenceId: zod_1.z.string().max(100).optional(),
    rejectionReason: zod_1.z.string().max(250).optional(),
});
class WithdrawalController {
    static async requestWithdrawal(req, res, next) {
        try {
            const userId = req.user.userId;
            const parsed = requestWithdrawalSchema.parse(req.body);
            const request = await withdrawal_service_1.WithdrawalService.requestWithdrawal(userId, parsed);
            res.status(201).json({
                success: true,
                message: 'Withdrawal request submitted successfully. 30% TDS deducted per tax regulations.',
                data: request,
            });
        }
        catch (err) {
            next(err);
        }
    }
    static async getMyWithdrawals(req, res, next) {
        try {
            const userId = req.user.userId;
            const list = await withdrawal_service_1.WithdrawalService.getUserWithdrawals(userId);
            res.status(200).json({ success: true, data: list });
        }
        catch (err) {
            next(err);
        }
    }
    static async getAdminQueue(req, res, next) {
        try {
            const status = req.query.status;
            const page = parseInt(req.query.page || '1', 10);
            const limit = parseInt(req.query.limit || '20', 10);
            const data = await withdrawal_service_1.WithdrawalService.getAdminWithdrawalQueue({ status, page, limit });
            res.status(200).json({ success: true, data });
        }
        catch (err) {
            next(err);
        }
    }
    static async processWithdrawal(req, res, next) {
        try {
            const adminUserId = req.user.userId;
            const requestId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const parsed = processWithdrawalSchema.parse(req.body);
            const updated = await withdrawal_service_1.WithdrawalService.processWithdrawal(adminUserId, requestId, parsed);
            res.status(200).json({
                success: true,
                message: `Withdrawal request ${parsed.decision} successfully.`,
                data: updated,
            });
        }
        catch (err) {
            next(err);
        }
    }
}
exports.WithdrawalController = WithdrawalController;
