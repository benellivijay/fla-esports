import { Router } from 'express';
import { ResultsController } from './results.controller';
import { AdminController } from '../admin/admin.controller';
import { authenticateToken, requireAdminOrModerator } from '../../middleware/auth.middleware';
import { uploadMiddleware } from '../../middleware/upload.middleware';

const tournamentResultRouter = Router();
const adminResultRouter = Router();

// Tournament Participant Results Routes
tournamentResultRouter.post('/:id/results/submit', authenticateToken, uploadMiddleware.single('screenshot'), ResultsController.submitResult);
tournamentResultRouter.get('/:id/results/my-submission', authenticateToken, ResultsController.getUserSubmission);

// Admin Results Review Routes
adminResultRouter.get('/queue', authenticateToken, requireAdminOrModerator, AdminController.getResultsQueue);
adminResultRouter.patch('/:id/verify', authenticateToken, requireAdminOrModerator, AdminController.verifyResult);
adminResultRouter.patch('/:id/dispute', authenticateToken, requireAdminOrModerator, AdminController.disputeResult);
adminResultRouter.post('/:id/review', authenticateToken, requireAdminOrModerator, ResultsController.reviewResult);

export const tournamentResultRoutes = tournamentResultRouter;
export const adminResultRoutes = adminResultRouter;
