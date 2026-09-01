import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { NotificationService } from '../scheduler/notification.service';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

const registerDeviceTokenSchema = z.object({
  token: z.string().min(10),
  platform: z.enum(['android', 'ios', 'web']).default('android'),
  deviceInfo: z.string().optional(),
});

const broadcastNotificationSchema = z.object({
  title: z.string().min(2).max(100),
  body: z.string().min(2).max(300),
  data: z.record(z.any()).optional(),
});

export class NotificationController {
  public static async registerDeviceToken(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const parsed = registerDeviceTokenSchema.parse(req.body);

      await NotificationService.registerDeviceToken(userId, parsed.token, parsed.platform, parsed.deviceInfo);
      res.status(200).json({ success: true, message: 'Device push token registered successfully.' });
    } catch (err) {
      next(err);
    }
  }

  public static async unregisterDeviceToken(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const token = req.body.token;

      if (token) {
        await NotificationService.unregisterDeviceToken(userId, token);
      }
      res.status(200).json({ success: true, message: 'Device token removed successfully.' });
    } catch (err) {
      next(err);
    }
  }

  public static async getInbox(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const page = parseInt(req.query.page as string || '1', 10);
      const limit = parseInt(req.query.limit as string || '20', 10);

      const data = await NotificationService.getUserNotifications(userId, page, limit);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  public static async getUnreadCount(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const unreadCount = await NotificationService.getUnreadCount(userId);
      res.status(200).json({ success: true, data: { unreadCount } });
    } catch (err) {
      next(err);
    }
  }

  public static async markAsRead(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const notificationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

      await NotificationService.markAsRead(userId, notificationId);
      res.status(200).json({ success: true, message: 'Notification marked as read.' });
    } catch (err) {
      next(err);
    }
  }

  public static async markAllAsRead(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      await NotificationService.markAllAsRead(userId);
      res.status(200).json({ success: true, message: 'All notifications marked as read.' });
    } catch (err) {
      next(err);
    }
  }

  public static async broadcastNotification(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminUserId = req.user!.userId;
      const parsed = broadcastNotificationSchema.parse(req.body);

      const result = await NotificationService.broadcastNotification(adminUserId, parsed.title, parsed.body, parsed.data);
      res.status(200).json({
        success: true,
        message: `Broadcast notification sent to ${result.sentCount} active users.`,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}
