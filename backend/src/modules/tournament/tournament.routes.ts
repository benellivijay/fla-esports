import { Router } from 'express';
import { TournamentController } from './tournament.controller';
import { authenticateToken, requireAdminOrModerator, optionalAuthToken } from '../../middleware/auth.middleware';

const router = Router();

// Public / Player routes (with optional auth to identify admin roles and reveal room credentials if permitted)
router.get('/', optionalAuthToken, TournamentController.listTournaments);
router.get('/:id', optionalAuthToken, TournamentController.getTournamentById);

// Admin & Moderator routes
router.post('/', authenticateToken, requireAdminOrModerator, TournamentController.createTournament);
router.put('/:id', authenticateToken, requireAdminOrModerator, TournamentController.updateTournament);
router.patch('/:id/room', authenticateToken, requireAdminOrModerator, TournamentController.updateRoomCredentials);
router.put('/:id/room-credentials', authenticateToken, requireAdminOrModerator, TournamentController.updateRoomCredentials);
router.post('/:id/cancel', authenticateToken, requireAdminOrModerator, TournamentController.cancelTournament);

export const tournamentRoutes = router;
