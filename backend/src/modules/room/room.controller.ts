import { Response, NextFunction } from 'express';
import { RoomService } from './room.service';
import { RoomRevealWorker } from '../scheduler/room_reveal.worker';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

export class RoomController {
  public static async getRoomDetails(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tournamentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const userId = req.user!.userId;
      const isAdmin = req.user?.role === 'admin' || req.user?.role === 'moderator';

      const details = await RoomService.getRoomDetails(tournamentId, userId, isAdmin);
      res.status(200).json({ success: true, data: details });
    } catch (err) {
      next(err);
    }
  }

  public static async revealRoomNow(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tournamentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const adminUserId = req.user!.userId;

      await RoomService.revealRoomNow(tournamentId, adminUserId);
      res.status(200).json({
        success: true,
        message: 'Room credentials unlocked and notification broadcast dispatched.',
      });
    } catch (err) {
      next(err);
    }
  }

  public static async triggerWorkerCycle(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await RoomRevealWorker.checkAndRevealRooms();
      res.status(200).json({
        success: true,
        message: `Worker executed: ${result.revealedCount} rooms revealed, ${result.ongoingCount} matches transitioned to ongoing.`,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}
