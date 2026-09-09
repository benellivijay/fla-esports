"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminNotificationRoutes = exports.notificationRoutes = void 0;
const express_1 = require("express");
const notification_controller_1 = require("./notification.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const router = (0, express_1.Router)();
const adminRouter = (0, express_1.Router)();
// Public announcement route for Home Screen (with optional user context)
router.get('/announcements', auth_middleware_1.optionalAuthToken, notification_controller_1.NotificationController.getPublicAnnouncements);
// User notification routes
router.post('/device-token', auth_middleware_1.authenticateToken, notification_controller_1.NotificationController.registerDeviceToken);
router.delete('/device-token', auth_middleware_1.authenticateToken, notification_controller_1.NotificationController.unregisterDeviceToken);
router.get('/inbox', auth_middleware_1.authenticateToken, notification_controller_1.NotificationController.getInbox);
router.get('/unread-count', auth_middleware_1.authenticateToken, notification_controller_1.NotificationController.getUnreadCount);
// IMPORTANT: mark-all-read MUST come before /:id/read — otherwise Express matches "mark-all-read" as id param
router.patch('/mark-all-read', auth_middleware_1.authenticateToken, notification_controller_1.NotificationController.markAllAsRead);
router.patch('/:id/read', auth_middleware_1.authenticateToken, notification_controller_1.NotificationController.markAsRead);
// Admin broadcast & messaging routes
adminRouter.post('/broadcast', auth_middleware_1.authenticateToken, auth_middleware_1.requireAdminOrModerator, notification_controller_1.NotificationController.broadcastNotification);
adminRouter.post('/send-user', auth_middleware_1.authenticateToken, auth_middleware_1.requireAdminOrModerator, notification_controller_1.NotificationController.sendToUser);
adminRouter.post('/send-tournament', auth_middleware_1.authenticateToken, auth_middleware_1.requireAdminOrModerator, notification_controller_1.NotificationController.sendToTournament);
exports.notificationRoutes = router;
exports.adminNotificationRoutes = adminRouter;
