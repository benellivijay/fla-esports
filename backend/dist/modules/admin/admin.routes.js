"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRoutes = void 0;
const express_1 = require("express");
const admin_controller_1 = require("./admin.controller");
const tournament_controller_1 = require("../tournament/tournament.controller");
const room_controller_1 = require("../room/room.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const router = (0, express_1.Router)();
// ============================================
// Public Admin Auth Routes (No Token Required)
// ============================================
router.post('/auth/login', admin_controller_1.AdminController.adminLogin);
router.post('/auth/2fa/verify', admin_controller_1.AdminController.verifyTotp);
// ============================================
// Protected Admin & Moderator Routes (JWT Required)
// ============================================
router.use(auth_middleware_1.authenticateToken);
router.use(auth_middleware_1.requireAdminOrModerator);
// Dashboard Home Stats & Device Analytics
router.get('/dashboard/stats', admin_controller_1.AdminController.getDashboardStats);
router.get('/analytics/devices', admin_controller_1.AdminController.getApkUsageStats);
// Tournament Management
router.get('/tournaments', tournament_controller_1.TournamentController.listTournaments);
router.get('/tournaments/:id', tournament_controller_1.TournamentController.getTournamentById);
router.post('/tournaments', tournament_controller_1.TournamentController.createTournament);
router.patch('/tournaments/:id', tournament_controller_1.TournamentController.updateTournament);
router.patch('/tournaments/:id/room', tournament_controller_1.TournamentController.updateRoomCredentials);
router.post('/tournaments/:id/reveal-room', room_controller_1.RoomController.revealRoomNow);
router.post('/tournaments/:id/cancel', tournament_controller_1.TournamentController.cancelTournament);
router.delete('/tournaments/:id', tournament_controller_1.TournamentController.deleteTournament);
// Result Review Queue
router.get('/results/queue', admin_controller_1.AdminController.getResultsQueue);
router.patch('/results/:id/verify', admin_controller_1.AdminController.verifyResult);
router.patch('/results/:id/dispute', admin_controller_1.AdminController.disputeResult);
// Payout Runs (Idempotent)
router.get('/tournaments/:id/payout-preview', admin_controller_1.AdminController.getPayoutPreview);
router.post('/tournaments/:id/payout-run', admin_controller_1.AdminController.executePayoutRun);
// User Management & Wallet Adjustment
router.get('/users', admin_controller_1.AdminController.listUsers);
router.patch('/users/:id/status', admin_controller_1.AdminController.updateUserStatus);
router.get('/users/:id/ledger', admin_controller_1.AdminController.getUserLedger);
router.post('/wallet/adjust', admin_controller_1.AdminController.adjustWallet);
// UPI QR Deposits Queue & Approvals (Option A)
router.get('/deposits/queue', admin_controller_1.AdminController.getDepositQueue);
router.post('/deposits/:orderId/approve', admin_controller_1.AdminController.approveDeposit);
router.post('/deposits/:orderId/reject', admin_controller_1.AdminController.rejectDeposit);
// Verifications
router.get('/verifications/ff-uid', admin_controller_1.AdminController.getPendingFFVerifications);
router.post('/verifications/ff-uid/:userId', admin_controller_1.AdminController.reviewFFVerification);
router.get('/verifications/kyc', admin_controller_1.AdminController.getPendingKYCSubmissions);
router.post('/verifications/kyc/:kycId', admin_controller_1.AdminController.reviewKYC);
// Support & Complaints Queue
router.get('/support/tickets', admin_controller_1.AdminController.listSupportTickets);
// ============================================
// Super Admin Only Routes
// ============================================
router.patch('/users/:id/role', auth_middleware_1.requireAdmin, admin_controller_1.AdminController.updateUserRole);
router.get('/audit-logs', auth_middleware_1.requireAdmin, admin_controller_1.AdminController.getAuditLogs);
// Staff & Dedicated Authenticator Management
router.get('/staff', auth_middleware_1.requireAdmin, admin_controller_1.AdminController.listStaff);
router.post('/staff', auth_middleware_1.requireAdmin, admin_controller_1.AdminController.createStaff);
router.patch('/staff/:id', auth_middleware_1.requireAdmin, admin_controller_1.AdminController.updateStaff);
router.post('/staff/:id/regenerate-2fa', auth_middleware_1.requireAdmin, admin_controller_1.AdminController.regenerateStaffTotp);
router.delete('/staff/:id', auth_middleware_1.requireAdmin, admin_controller_1.AdminController.deleteStaff);
exports.adminRoutes = router;
