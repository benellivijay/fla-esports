import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database/db';

export class Logger {
  public static info(message: string, meta?: any): void {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, meta ? JSON.stringify(meta) : '');
  }

  public static warn(message: string, meta?: any): void {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, meta ? JSON.stringify(meta) : '');
  }

  public static error(message: string, error?: any): void {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error);
  }

  /**
   * Section 3.5: Audit log: every wallet mutation and admin action, immutable, timestamped
   */
  public static audit(params: {
    actorId?: string | null;
    action: string;
    targetResource: string;
    targetId?: string | null;
    details?: any;
    ipAddress?: string | null;
  }): void {
    try {
      const db = getDb();
      const stmt = db.prepare(`
        INSERT INTO audit_logs (id, actor_id, action, target_resource, target_id, details, ip_address, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);
      stmt.run(
        uuidv4(),
        params.actorId || null,
        params.action,
        params.targetResource,
        params.targetId || null,
        params.details ? JSON.stringify(params.details) : null,
        params.ipAddress || null
      );
    } catch (err) {
      console.error('[AUDIT ERROR] Failed to record audit log:', err);
    }
  }
}
