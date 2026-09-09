"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminController = void 0;
const zod_1 = require("zod");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../../config/env");
const admin_service_1 = require("./admin.service");
const wallet_service_1 = require("../wallet/wallet.service");
const adminLoginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
});
const verifyTotpSchema = zod_1.z.object({
    tempToken: zod_1.z.string().min(10),
    totpCode: zod_1.z.string().length(6),
});
const verifyResultSchema = zod_1.z.object({
    confirmedRank: zod_1.z.number().int().positive().optional(),
    confirmedKills: zod_1.z.number().int().min(0).optional(),
});
const disputeResultSchema = zod_1.z.object({
    reasonNote: zod_1.z.string().min(1, 'Dispute reason note is required.'),
});
const adjustWalletSchema = zod_1.z.object({
    targetUserId: zod_1.z.string().uuid(),
    amount: zod_1.z.number().positive(),
    type: zod_1.z.enum(['deposit', 'refund', 'entry_fee_debit']),
    reason: zod_1.z.string().min(1, 'Reason note is required.'),
});
const updateUserStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(['active', 'suspended', 'banned']),
    reason: zod_1.z.string().optional(),
});
const updateUserRoleSchema = zod_1.z.object({
    role: zod_1.z.enum(['user', 'moderator', 'admin']),
});
class AdminController {
    /**
     * Public admin login (Step 1)
     */
    static async adminLogin(req, res, next) {
        try {
            const { email, password } = adminLoginSchema.parse(req.body);
            const result = await admin_service_1.AdminService.adminLogin(email, password);
            res.status(200).json({ success: true, message: 'Password verified. TOTP 2FA required.', data: result });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Public TOTP 2FA verification (Step 2)
     */
    static async verifyTotp(req, res, next) {
        try {
            const { tempToken, totpCode } = verifyTotpSchema.parse(req.body);
            const result = await admin_service_1.AdminService.verifyTotp2FA(tempToken, totpCode);
            res.status(200).json({ success: true, message: 'Authentication successful.', data: result });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Dashboard home summary statistics
     */
    static async getDashboardStats(_req, res, next) {
        try {
            const data = await admin_service_1.AdminService.getDashboardStats();
            res.status(200).json({ success: true, data });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Result review queue
     */
    static async getResultsQueue(req, res, next) {
        try {
            const tournamentId = req.query.tournamentId;
            const status = req.query.status;
            const data = await admin_service_1.AdminService.getResultsQueue(tournamentId, status);
            res.status(200).json({ success: true, data });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Approve match result
     */
    static async verifyResult(req, res, next) {
        try {
            const adminId = req.user.userId;
            const resultId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const { confirmedRank, confirmedKills } = verifyResultSchema.parse(req.body);
            const data = await admin_service_1.AdminService.verifyResult(adminId, resultId, confirmedRank, confirmedKills);
            res.status(200).json({ success: true, message: 'Result marked as verified.', data });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Dispute match result
     */
    static async disputeResult(req, res, next) {
        try {
            const adminId = req.user.userId;
            const resultId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const { reasonNote } = disputeResultSchema.parse(req.body);
            const data = await admin_service_1.AdminService.disputeResult(adminId, resultId, reasonNote);
            res.status(200).json({ success: true, message: 'Result marked as disputed.', data });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Payout preview
     */
    static async getPayoutPreview(req, res, next) {
        try {
            const tournamentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const data = await admin_service_1.AdminService.getPayoutPreview(tournamentId);
            res.status(200).json({ success: true, data });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Idempotent payout run execution
     */
    static async executePayoutRun(req, res, next) {
        try {
            const adminId = req.user.userId;
            const tournamentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const data = await admin_service_1.AdminService.executePayoutRun(adminId, tournamentId);
            res.status(200).json({ success: true, data });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * User management: list users
     */
    static async listUsers(req, res, next) {
        try {
            const search = req.query.search;
            const role = req.query.role;
            const status = req.query.status;
            const page = parseInt(req.query.page || '1', 10);
            const limit = parseInt(req.query.limit || '20', 10);
            const data = await admin_service_1.AdminService.listUsers(search, role, status, page, limit);
            res.status(200).json({ success: true, data });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * User status toggle
     */
    static async updateUserStatus(req, res, next) {
        try {
            const adminId = req.user.userId;
            const targetUserId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const { status, reason } = updateUserStatusSchema.parse(req.body);
            const data = await admin_service_1.AdminService.updateUserStatus(adminId, targetUserId, status, reason);
            res.status(200).json({ success: true, message: `User status updated to ${status}.`, data });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * User role assignment (Super admin only)
     */
    static async updateUserRole(req, res, next) {
        try {
            const adminId = req.user.userId;
            const targetUserId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const { role } = updateUserRoleSchema.parse(req.body);
            const data = await admin_service_1.AdminService.updateUserRole(adminId, targetUserId, role);
            res.status(200).json({ success: true, message: `User role updated to ${role}.`, data });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * User ledger statement
     */
    static async getUserLedger(req, res, next) {
        try {
            const userId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const data = await admin_service_1.AdminService.getUserLedger(userId);
            res.status(200).json({ success: true, data });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Manual wallet adjustment
     */
    static async adjustWallet(req, res, next) {
        try {
            const adminId = req.user.userId;
            const { targetUserId, amount, type, reason } = adjustWalletSchema.parse(req.body);
            const data = await admin_service_1.AdminService.adjustUserWallet(adminId, targetUserId, amount, type, reason);
            res.status(200).json({ success: true, message: 'Wallet adjustment successfully processed.', data });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Audit logs
     */
    static async getAuditLogs(req, res, next) {
        try {
            const limit = parseInt(req.query.limit || '50', 10);
            const page = parseInt(req.query.page || '1', 10);
            const action = req.query.action;
            const actorId = req.query.actorId;
            const result = await admin_service_1.AdminService.getAuditLogs(limit, page, action, actorId);
            res.status(200).json({
                success: true,
                count: result.total,
                total: result.total,
                page: result.page,
                limit: result.limit,
                data: result.logs,
                logs: result.logs,
            });
        }
        catch (err) {
            next(err);
        }
    }
    static async getPendingFFVerifications(_req, res, next) {
        try {
            const data = await admin_service_1.AdminService.getPendingFFVerifications();
            res.status(200).json({ success: true, count: data.length, data });
        }
        catch (err) {
            next(err);
        }
    }
    static async reviewFFVerification(req, res, next) {
        try {
            const adminId = req.user.userId;
            const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
            const { approved, rejectionReason } = req.body;
            const result = await admin_service_1.AdminService.reviewFFVerification(adminId, userId, !!approved, rejectionReason);
            res.status(200).json({ success: true, message: `FF UID verification ${approved ? 'approved' : 'rejected'}.`, data: result });
        }
        catch (err) {
            next(err);
        }
    }
    static async getPendingKYCSubmissions(_req, res, next) {
        try {
            const data = await admin_service_1.AdminService.getPendingKYCSubmissions();
            res.status(200).json({ success: true, count: data.length, data });
        }
        catch (err) {
            next(err);
        }
    }
    static async reviewKYC(req, res, next) {
        try {
            const adminId = req.user.userId;
            const kycId = Array.isArray(req.params.kycId) ? req.params.kycId[0] : req.params.kycId;
            const { approved, rejectionReason } = req.body;
            const result = await admin_service_1.AdminService.reviewKYC(adminId, kycId, !!approved, rejectionReason);
            res.status(200).json({ success: true, message: `KYC submission ${approved ? 'approved' : 'rejected'}.`, data: result });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * UPI QR Deposit Queue
     */
    static async getDepositQueue(req, res, next) {
        try {
            const status = req.query.status;
            const data = await wallet_service_1.WalletService.getDepositQueue(status);
            res.status(200).json({ success: true, data });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Approve Deposit
     */
    static async approveDeposit(req, res, next) {
        try {
            const adminId = req.user.userId;
            const orderId = Array.isArray(req.params.orderId) ? req.params.orderId[0] : req.params.orderId;
            const result = await wallet_service_1.WalletService.approveDeposit(adminId, orderId);
            res.status(200).json({ success: true, message: result.message, data: result });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Reject Deposit
     */
    static async rejectDeposit(req, res, next) {
        try {
            const adminId = req.user.userId;
            const orderId = Array.isArray(req.params.orderId) ? req.params.orderId[0] : req.params.orderId;
            const reason = req.body.reason;
            const result = await wallet_service_1.WalletService.rejectDeposit(adminId, orderId, reason);
            res.status(200).json({ success: true, message: result.message, data: result });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * List Support Tickets & Complaints
     */
    static async listSupportTickets(_req, res, next) {
        try {
            const { SupportService } = await Promise.resolve().then(() => __importStar(require('../support/support.service')));
            const tickets = await SupportService.getAllTickets();
            res.status(200).json({ success: true, data: { tickets } });
        }
        catch (err) {
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
    static async listStaff(_req, res, next) {
        try {
            const staff = await admin_service_1.AdminService.listStaffUsers();
            res.status(200).json({ success: true, data: staff });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /admin/staff
     */
    static async createStaff(req, res, next) {
        try {
            const adminId = req.user.userId;
            const schema = zod_1.z.object({
                email: zod_1.z.string().email('Invalid staff email address'),
                username: zod_1.z.string().min(3).max(30).optional(),
                password: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
                role: zod_1.z.enum(['admin', 'moderator']).default('admin'),
                displayName: zod_1.z.string().max(60).optional(),
                totpSecret: zod_1.z.string().min(8).max(64).optional(),
            });
            const body = schema.parse(req.body);
            const created = await admin_service_1.AdminService.createStaffUser(adminId, body);
            res.status(201).json({
                success: true,
                message: `Staff account ${created.email} created with dedicated 2FA authenticator!`,
                data: created,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * PATCH /admin/staff/:id
     */
    static async updateStaff(req, res, next) {
        try {
            const adminId = req.user.userId;
            const targetId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const schema = zod_1.z.object({
                role: zod_1.z.enum(['admin', 'moderator']).optional(),
                status: zod_1.z.enum(['active', 'suspended']).optional(),
                password: zod_1.z.string().min(6).optional(),
                displayName: zod_1.z.string().max(60).optional(),
            });
            const body = schema.parse(req.body);
            const updated = await admin_service_1.AdminService.updateStaffUser(adminId, targetId, body);
            res.status(200).json({
                success: true,
                message: 'Staff account updated successfully.',
                data: updated,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /admin/staff/:id/regenerate-2fa
     */
    static async regenerateStaffTotp(req, res, next) {
        try {
            const adminId = req.user.userId;
            const targetId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const result = await admin_service_1.AdminService.regenerateStaffTotp(adminId, targetId);
            res.status(200).json({
                success: true,
                message: 'New dedicated 2FA Authenticator secret generated successfully.',
                data: result,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * DELETE /admin/staff/:id
     */
    static async deleteStaff(req, res, next) {
        try {
            const adminId = req.user.userId;
            const targetId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            await admin_service_1.AdminService.deleteStaffUser(adminId, targetId);
            res.status(200).json({
                success: true,
                message: 'Staff account removed successfully.',
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Public device install/heartbeat analytics (POST /api/v1/analytics/device-heartbeat)
     */
    static async recordDeviceHeartbeat(req, res, next) {
        try {
            const { deviceId, platform, appVersion, deviceModel, osVersion } = req.body;
            if (!deviceId || typeof deviceId !== 'string' || deviceId.trim().length === 0) {
                res.status(400).json({ success: false, message: 'deviceId is required.' });
                return;
            }
            const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || undefined;
            const authHeader = req.headers.authorization;
            let userId = undefined;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                try {
                    const token = authHeader.split(' ')[1];
                    const decoded = jsonwebtoken_1.default.verify(token, env_1.config.jwt.accessSecret);
                    if (decoded && decoded.userId) {
                        userId = decoded.userId;
                    }
                }
                catch (_) { }
            }
            await admin_service_1.AdminService.recordDeviceHeartbeat({
                deviceId: deviceId.trim(),
                userId,
                platform: platform || 'android',
                appVersion: appVersion || '1.0.0',
                deviceModel: deviceModel || 'Android Device',
                osVersion: osVersion || 'Android',
                ipAddress,
            });
            res.status(200).json({ success: true, message: 'Device heartbeat recorded.' });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Admin APK usage and devices breakdown (GET /api/v1/admin/analytics/devices)
     */
    static async getApkUsageStats(_req, res, next) {
        try {
            const data = await admin_service_1.AdminService.getApkUsageStats();
            res.status(200).json({ success: true, data });
        }
        catch (err) {
            next(err);
        }
    }
}
exports.AdminController = AdminController;
