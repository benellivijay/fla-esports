import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../../database/db';
import { Logger } from '../../utils/logger';
import { InAppNotification, NotificationType, PlatformType } from '../../types';

export interface PushNotificationPayload {
  title: string;
  body: string;
  type: NotificationType;
  data?: Record<string, any>;
}

export class NotificationService {
  /**
   * Register or update user device FCM push token
   */
  public static async registerDeviceToken(
    userId: string,
    token: string,
    platform: PlatformType = 'android',
    deviceInfo?: string
  ): Promise<void> {
    const db = getDb();
    const existing = db.prepare('SELECT id FROM device_tokens WHERE token = ?').get(token) as any;

    if (existing) {
      db.prepare(`
        UPDATE device_tokens 
        SET user_id = ?, platform = ?, device_info = ?, last_active_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE token = ?
      `).run(userId, platform, deviceInfo || null, token);
    } else {
      const id = uuidv4();
      db.prepare(`
        INSERT INTO device_tokens (id, user_id, token, platform, device_info, last_active_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(id, userId, token, platform, deviceInfo || null);
    }
  }

  /**
   * Unregister device FCM push token (e.g. on logout)
   */
  public static async unregisterDeviceToken(userId: string, token: string): Promise<void> {
    const db = getDb();
    db.prepare('DELETE FROM device_tokens WHERE user_id = ? AND token = ?').run(userId, token);
  }

  /**
   * Dispatches push notification to user and records persistent in-app notification
   */
  public static async sendNotificationToUser(
    userId: string,
    payload: PushNotificationPayload
  ): Promise<InAppNotification> {
    const db = getDb();
    const id = uuidv4();
    const dataJson = payload.data ? JSON.stringify(payload.data) : null;

    // 1. Record persistent in-app notification
    db.prepare(`
      INSERT INTO notifications (id, user_id, title, body, type, data, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
    `).run(id, userId, payload.title, payload.body, payload.type, dataJson);

    // 2. Fetch device tokens for FCM dispatch
    const tokens = db.prepare('SELECT token, platform FROM device_tokens WHERE user_id = ?').all(userId) as any[];

    // 3. Dispatch push notification
    Logger.info(
      `[PUSH DISPATCH] To User: ${userId} (${tokens.length} devices) | Type: [${payload.type}] | Title: "${payload.title}" | Body: "${payload.body}"`
    );

    const record = db.prepare('SELECT * FROM notifications WHERE id = ?').get(id) as any;
    return {
      ...record,
      data: record.data ? JSON.parse(record.data) : null,
      is_read: Boolean(record.is_read),
    };
  }

  /**
   * Dispatches batch push notification to multiple users (e.g. room reveal broadcast)
   */
  public static async sendNotificationToUsers(
    userIds: string[],
    payload: PushNotificationPayload
  ): Promise<void> {
    for (const userId of userIds) {
      await this.sendNotificationToUser(userId, payload);
    }
  }

  /**
   * Broadcasts new tournament announcement notification to all registered players
   */
  public static async broadcastNewTournamentNotification(tournament: any): Promise<void> {
    const db = getDb();
    const entryFeeText = tournament.entry_type === 'paid' && tournament.entry_fee > 0 ? `₹${tournament.entry_fee}` : 'FREE';
    const title = `🏆 New Tournament: ${tournament.title}`;
    const body = `New ${tournament.mode.toUpperCase()} match on ${tournament.map} (Prize: ₹${tournament.prize_pool}, Entry: ${entryFeeText}) is now open for registration! Book your slot now.`;
    const dataJson = JSON.stringify({
      tournamentId: tournament.id,
      title: tournament.title,
      mode: tournament.mode,
      map: tournament.map,
      prizePool: tournament.prize_pool,
      entryFee: tournament.entry_fee,
      entryType: tournament.entry_type,
    });

    // 1. Fetch all active player user IDs
    const users = db.prepare("SELECT id FROM users WHERE status = 'active'").all() as any[];

    if (users.length === 0) return;

    // 2. Batch insert in-app notifications
    const insertStmt = db.prepare(`
      INSERT INTO notifications (id, user_id, title, body, type, data, is_read, created_at)
      VALUES (?, ?, ?, ?, 'TOURNAMENT_CREATED', ?, 0, CURRENT_TIMESTAMP)
    `);

    db.exec('BEGIN TRANSACTION;');
    try {
      for (const user of users) {
        insertStmt.run(uuidv4(), user.id, title, body, dataJson);
      }
      db.exec('COMMIT;');
    } catch (err) {
      try { db.exec('ROLLBACK;'); } catch (_) {}
      Logger.error('Failed to batch insert tournament created notifications', err);
    }

    // 3. Log FCM push broadcast
    Logger.info(
      `[PUSH BROADCAST] Broadcasted "New Tournament: ${tournament.title}" notification to ${users.length} registered players.`
    );
  }

  /**
   * Fetch paginated notification inbox for user
   */
  public static async getUserNotifications(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ notifications: InAppNotification[]; total: number; unreadCount: number }> {
    const db = getDb();
    const offset = (page - 1) * limit;

    const rows = db.prepare(`
      SELECT * FROM notifications 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `).all(userId, limit, offset) as any[];

    const totalRow = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ?').get(userId) as any;
    const unreadRow = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0').get(userId) as any;

    const notifications: InAppNotification[] = rows.map((r) => ({
      ...r,
      data: r.data ? JSON.parse(r.data) : null,
      is_read: Boolean(r.is_read),
    }));

    return {
      notifications,
      total: totalRow?.count || 0,
      unreadCount: unreadRow?.count || 0,
    };
  }

  /**
   * Get unread notifications count for live UI badge
   */
  public static async getUnreadCount(userId: string): Promise<number> {
    const db = getDb();
    const row = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0').get(userId) as any;
    return row?.count || 0;
  }

  /**
   * Mark single notification as read
   */
  public static async markAsRead(userId: string, notificationId: string): Promise<void> {
    const db = getDb();
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(notificationId, userId);
  }

  /**
   * Mark all user notifications as read
   */
  public static async markAllAsRead(userId: string): Promise<void> {
    const db = getDb();
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(userId);
  }

  /**
   * Admin broadcast system notification to all players
   */
  public static async broadcastNotification(
    adminUserId: string,
    title: string,
    body: string,
    data?: any
  ): Promise<{ sentCount: number }> {
    const db = getDb();
    const users = db.prepare("SELECT id FROM users WHERE status = 'active'").all() as any[];

    for (const u of users) {
      await this.sendNotificationToUser(u.id, {
        title,
        body,
        type: 'SYSTEM',
        data,
      });
    }

    Logger.audit({
      actorId: adminUserId,
      action: 'NOTIFICATION_BROADCAST',
      targetResource: 'notifications',
      details: { title, body, userCount: users.length },
    });

    return { sentCount: users.length };
  }

  /**
   * Admin dispatches notification to all participants of a specific tournament
   */
  public static async notifyTournamentParticipants(
    adminUserId: string,
    tournamentId: string,
    title: string,
    body: string,
    data?: any
  ): Promise<{ sentCount: number }> {
    const db = getDb();
    const participants = db.prepare(`
      SELECT DISTINCT user_id 
      FROM tournament_entries 
      WHERE tournament_id = ? AND status = 'confirmed'
    `).all(tournamentId) as any[];

    for (const p of participants) {
      await this.sendNotificationToUser(p.user_id, {
        title,
        body,
        type: 'SYSTEM',
        data: { ...data, tournamentId },
      });
    }

    Logger.audit({
      actorId: adminUserId,
      action: 'TOURNAMENT_NOTIFICATION_BROADCAST',
      targetResource: `tournaments/${tournamentId}`,
      details: { title, body, userCount: participants.length },
    });

    return { sentCount: participants.length };
  }

  /**
   * Fetch recent public system announcements for Home Screen banner
   */
  public static async getPublicAnnouncements(limit: number = 5): Promise<any[]> {
    const db = getDb();
    const rows = db.prepare(`
      SELECT MIN(id) as id, title, body, type, data, MAX(created_at) as created_at
      FROM notifications
      WHERE type = 'SYSTEM'
      GROUP BY title, body, type
      ORDER BY created_at DESC
      LIMIT ?
    `).all(limit) as any[];

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      type: r.type,
      data: r.data ? JSON.parse(r.data) : null,
      createdAt: r.created_at,
    }));
  }

  /**
   * Helper: Dispatches room revealed notification to all confirmed participants
   */
  public static async notifyRoomRevealed(
    tournament: { id: string; title: string; roomId?: string | null; roomPassword?: string | null },
    participants: { userId: string; playerIgn?: string; slotNumber: number }[]
  ): Promise<void> {
    for (const p of participants) {
      await this.sendNotificationToUser(p.userId, {
        title: '🔥 Room Credentials Live!',
        body: `Room ID: ${tournament.roomId || 'SET_SOON'} | Pass: ${tournament.roomPassword || 'None'} | Slot: #${p.slotNumber}`,
        type: 'ROOM_REVEALED',
        data: {
          tournamentId: tournament.id,
          roomId: tournament.roomId,
          password: tournament.roomPassword,
          slotNumber: p.slotNumber,
        },
      });
    }
  }
}
