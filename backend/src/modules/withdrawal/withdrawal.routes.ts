import { Router } from 'express';
import { WithdrawalController } from './withdrawal.controller';
import { authenticateToken, requireAdminOrModerator } from '../../middleware/auth.middleware';

const userWithdrawalRouter = Router();
const adminWithdrawalRouter = Router();

// User routes
userWithdrawalRouter.post('/request', authenticateToken, WithdrawalController.requestWithdrawal);
userWithdrawalRouter.get('/my-requests', authenticateToken, WithdrawalController.getMyWithdrawals);

// Admin routes
adminWithdrawalRouter.get('/queue', authenticateToken, requireAdminOrModerator, WithdrawalController.getAdminQueue);
adminWithdrawalRouter.post('/:id/process', authenticateToken, requireAdminOrModerator, WithdrawalController.processWithdrawal);

export const userWithdrawalRoutes = userWithdrawalRouter;
export const adminWithdrawalRoutes = adminWithdrawalRouter;
