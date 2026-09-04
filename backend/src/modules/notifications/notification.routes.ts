import { Router } from 'express';
import { NotificationController } from './notification.controller';
import { authenticateToken, requireAdminOrModerator } from '../../middleware/auth.middleware';

const router = Router();
const adminRouter = Router();

// Public announcement route for Home Screen
router.get('/announcements', NotificationController.getPublicAnnouncements);

// User notification routes
router.post('/device-token', authenticateToken, NotificationController.registerDeviceToken);
router.delete('/device-token', authenticateToken, NotificationController.unregisterDeviceToken);
router.get('/inbox', authenticateToken, NotificationController.getInbox);
router.get('/unread-count', authenticateToken, NotificationController.getUnreadCount);
router.patch('/:id/read', authenticateToken, NotificationController.markAsRead);
router.patch('/mark-all-read', authenticateToken, NotificationController.markAllAsRead);

// Admin broadcast & messaging routes
adminRouter.post('/broadcast', authenticateToken, requireAdminOrModerator, NotificationController.broadcastNotification);
adminRouter.post('/send-user', authenticateToken, requireAdminOrModerator, NotificationController.sendToUser);
adminRouter.post('/send-tournament', authenticateToken, requireAdminOrModerator, NotificationController.sendToTournament);

export const notificationRoutes = router;
export const adminNotificationRoutes = adminRouter;
