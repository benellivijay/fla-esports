"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
const uuid_1 = require("uuid");
const db_1 = require("../database/db");
class Logger {
    static info(message, meta) {
        console.log(`[INFO] ${new Date().toISOString()} - ${message}`, meta ? JSON.stringify(meta) : '');
    }
    static warn(message, meta) {
        console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, meta ? JSON.stringify(meta) : '');
    }
    static error(message, error) {
        console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error);
    }
    /**
     * Section 3.5: Audit log: every wallet mutation and admin action, immutable, timestamped
     */
    static audit(params) {
        try {
            const db = (0, db_1.getDb)();
            const stmt = db.prepare(`
        INSERT INTO audit_logs (id, actor_id, action, target_resource, target_id, details, ip_address, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);
            stmt.run((0, uuid_1.v4)(), params.actorId || null, params.action, params.targetResource, params.targetId || null, params.details ? JSON.stringify(params.details) : null, params.ipAddress || null);
        }
        catch (err) {
            console.error('[AUDIT ERROR] Failed to record audit log:', err);
        }
    }
}
exports.Logger = Logger;
