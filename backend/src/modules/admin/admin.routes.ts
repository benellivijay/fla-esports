import { Router } from 'express';
import { AdminController } from './admin.controller';
import { TournamentController } from '../tournament/tournament.controller';
import { RoomController } from '../room/room.controller';
import { authenticateToken, requireAdminOrModerator, requireAdmin } from '../../middleware/auth.middleware';

const router = Router();

// ============================================
// Public Admin Auth Routes (No Token Required)
// ============================================
router.post('/auth/login', AdminController.adminLogin);
router.post('/auth/2fa/verify', AdminController.verifyTotp);

// ============================================
// Protected Admin & Moderator Routes (JWT Required)
// ============================================
router.use(authenticateToken);
router.use(requireAdminOrModerator);

// Dashboard Home Stats
router.get('/dashboard/stats', AdminController.getDashboardStats);

// Tournament Management
router.get('/tournaments', TournamentController.listTournaments);
router.get('/tournaments/:id', TournamentController.getTournamentById);
router.post('/tournaments', TournamentController.createTournament);
router.patch('/tournaments/:id', TournamentController.updateTournament);
router.patch('/tournaments/:id/room', TournamentController.updateRoomCredentials);
router.post('/tournaments/:id/reveal-room', RoomController.revealRoomNow);
router.post('/tournaments/:id/cancel', TournamentController.cancelTournament);

// Result Review Queue
router.get('/results/queue', AdminController.getResultsQueue);
router.patch('/results/:id/verify', AdminController.verifyResult);
router.patch('/results/:id/dispute', AdminController.disputeResult);

// Payout Runs (Idempotent)
router.get('/tournaments/:id/payout-preview', AdminController.getPayoutPreview);
router.post('/tournaments/:id/payout-run', AdminController.executePayoutRun);

// User Management & Wallet Adjustment
router.get('/users', AdminController.listUsers);
router.patch('/users/:id/status', AdminController.updateUserStatus);
router.get('/users/:id/ledger', AdminController.getUserLedger);
router.post('/wallet/adjust', AdminController.adjustWallet);

// UPI QR Deposits Queue & Approvals (Option A)
router.get('/deposits/queue', AdminController.getDepositQueue);
router.post('/deposits/:orderId/approve', AdminController.approveDeposit);
router.post('/deposits/:orderId/reject', AdminController.rejectDeposit);

// Verifications
router.get('/verifications/ff-uid', AdminController.getPendingFFVerifications);
router.post('/verifications/ff-uid/:userId', AdminController.reviewFFVerification);
router.get('/verifications/kyc', AdminController.getPendingKYCSubmissions);
router.post('/verifications/kyc/:kycId', AdminController.reviewKYC);

// ============================================
// Super Admin Only Routes
// ============================================
router.patch('/users/:id/role', requireAdmin, AdminController.updateUserRole);
router.get('/audit-logs', requireAdmin, AdminController.getAuditLogs);

export const adminRoutes = router;
