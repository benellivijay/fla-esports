import { Router } from 'express';
import { PayoutController } from './payout.controller';
import { authenticateToken, requireAdminOrModerator } from '../../middleware/auth.middleware';

const router = Router();

router.post('/:id/payouts/distribute', authenticateToken, requireAdminOrModerator, PayoutController.distributePayouts);

export const payoutRoutes = router;
