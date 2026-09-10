"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationController = void 0;
const zod_1 = require("zod");
const notification_service_1 = require("../scheduler/notification.service");
const registerDeviceTokenSchema = zod_1.z.object({
    token: zod_1.z.string().min(10),
    platform: zod_1.z.enum(['android', 'ios', 'web']).default('android'),
    deviceInfo: zod_1.z.string().optional(),
});
const broadcastNotificationSchema = zod_1.z.object({
    title: zod_1.z.string().min(2).max(100),
    body: zod_1.z.string().min(2).max(300),
    data: zod_1.z.record(zod_1.z.any()).optional(),
});
const sendToUserSchema = zod_1.z.object({
    userId: zod_1.z.string().min(1),
    title: zod_1.z.string().min(2).max(100),
    body: zod_1.z.string().min(2).max(300),
    data: zod_1.z.record(zod_1.z.any()).optional(),
});
const sendToTournamentSchema = zod_1.z.object({
    tournamentId: zod_1.z.string().min(1),
    title: zod_1.z.string().min(2).max(100),
    body: zod_1.z.string().min(2).max(300),
    data: zod_1.z.record(zod_1.z.any()).optional(),
});
class NotificationController {
    static async registerDeviceToken(req, res, next) {
        try {
            const userId = req.user.userId;
            const parsed = registerDeviceTokenSchema.parse(req.body);
            await notification_service_1.NotificationService.registerDeviceToken(userId, parsed.token, parsed.platform, parsed.deviceInfo);
            res.status(200).json({ success: true, message: 'Device push token registered successfully.' });
        }
        catch (err) {
            next(err);
        }
    }
    static async unregisterDeviceToken(req, res, next) {
        try {
            const userId = req.user.userId;
            const token = req.body.token;
            if (token) {
                await notification_service_1.NotificationService.unregisterDeviceToken(userId, token);
            }
            res.status(200).json({ success: true, message: 'Device token removed successfully.' });
        }
        catch (err) {
            next(err);
        }
    }
    static async getInbox(req, res, next) {
        try {
            const userId = req.user.userId;
            const page = parseInt(req.query.page || '1', 10);
            const limit = parseInt(req.query.limit || '20', 10);
            const data = await notification_service_1.NotificationService.getUserNotifications(userId, page, limit);
            res.status(200).json({ success: true, data });
        }
        catch (err) {
            next(err);
        }
    }
    static async getUnreadCount(req, res, next) {
        try {
            const userId = req.user.userId;
            const unreadCount = await notification_service_1.NotificationService.getUnreadCount(userId);
            res.status(200).json({ success: true, data: { unreadCount } });
        }
        catch (err) {
            next(err);
        }
    }
    static async markAsRead(req, res, next) {
        try {
            const userId = req.user.userId;
            const notificationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            await notification_service_1.NotificationService.markAsRead(userId, notificationId);
            res.status(200).json({ success: true, message: 'Notification marked as read.' });
        }
        catch (err) {
            next(err);
        }
    }
    static async markAllAsRead(req, res, next) {
        try {
            const userId = req.user.userId;
            await notification_service_1.NotificationService.markAllAsRead(userId);
            res.status(200).json({ success: true, message: 'All notifications marked as read.' });
        }
        catch (err) {
            next(err);
        }
    }
    static async broadcastNotification(req, res, next) {
        try {
            const adminUserId = req.user.userId;
            const parsed = broadcastNotificationSchema.parse(req.body);
            const result = await notification_service_1.NotificationService.broadcastNotification(adminUserId, parsed.title, parsed.body, parsed.data);
            res.status(200).json({
                success: true,
                message: `Broadcast notification sent to ${result.sentCount} active users.`,
                data: result,
            });
        }
        catch (err) {
            next(err);
        }
    }
    static async sendToUser(req, res, next) {
        try {
            const parsed = sendToUserSchema.parse(req.body);
            const notification = await notification_service_1.NotificationService.sendNotificationToUser(parsed.userId, {
                title: parsed.title,
                body: parsed.body,
                type: 'ADMIN_MESSAGE',
                data: parsed.data,
            });
            res.status(200).json({
                success: true,
                message: 'Notification sent to user successfully.',
                data: notification,
            });
        }
        catch (err) {
            next(err);
        }
    }
    static async sendToTournament(req, res, next) {
        try {
            const adminUserId = req.user.userId;
            const parsed = sendToTournamentSchema.parse(req.body);
            const result = await notification_service_1.NotificationService.notifyTournamentParticipants(adminUserId, parsed.tournamentId, parsed.title, parsed.body, parsed.data);
            res.status(200).json({
                success: true,
                message: `Notification sent to ${result.sentCount} tournament participants.`,
                data: result,
            });
        }
        catch (err) {
            next(err);
        }
    }
    static async getPublicAnnouncements(req, res, next) {
        try {
            const limit = parseInt(req.query.limit || '5', 10);
            const userId = req.user?.userId || req.query.userId;
            const announcements = await notification_service_1.NotificationService.getPublicAnnouncements(limit, userId);
            res.status(200).json({
                success: true,
                data: { announcements },
            });
        }
        catch (err) {
            next(err);
        }
    }
}
exports.NotificationController = NotificationController;
