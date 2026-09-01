import { Router } from 'express';
import { NotificationController } from './notification.controller';
import { authenticateToken, requireAdminOrModerator } from '../../middleware/auth.middleware';

const router = Router();
const adminRouter = Router();

// User notification routes
router.post('/device-token', authenticateToken, NotificationController.registerDeviceToken);
router.delete('/device-token', authenticateToken, NotificationController.unregisterDeviceToken);
router.get('/inbox', authenticateToken, NotificationController.getInbox);
router.get('/unread-count', authenticateToken, NotificationController.getUnreadCount);
router.patch('/:id/read', authenticateToken, NotificationController.markAsRead);
router.patch('/mark-all-read', authenticateToken, NotificationController.markAllAsRead);

// Admin broadcast routes
adminRouter.post('/broadcast', authenticateToken, requireAdminOrModerator, NotificationController.broadcastNotification);

export const notificationRoutes = router;
export const adminNotificationRoutes = adminRouter;
