import { Router } from 'express';
import { RoomController } from './room.controller';
import { authenticateToken, requireAdminOrModerator } from '../../middleware/auth.middleware';

const router = Router();

router.get('/:id/room', authenticateToken, RoomController.getRoomDetails);
router.post('/:id/reveal-now', authenticateToken, requireAdminOrModerator, RoomController.revealRoomNow);
router.post('/worker/trigger-reveal-check', authenticateToken, requireAdminOrModerator, RoomController.triggerWorkerCycle);

export const roomRoutes = router;
