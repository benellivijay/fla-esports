import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { config } from '../config/env';
import { CryptoUtil } from '../utils/crypto';
import { v4 as uuidv4 } from 'uuid';
import { SCHEMA_SQL } from './schema_sql';

export class DatabaseManager {
  private static instance: DatabaseSync | null = null;

  public static getDb(): DatabaseSync {
    if (!this.instance) {
      const dbDir = path.dirname(config.db.filename);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      this.instance = new DatabaseSync(config.db.filename);
      this.instance.exec('PRAGMA journal_mode = WAL;');
      this.instance.exec('PRAGMA foreign_keys = ON;');

      // Initialize schema (executes embedded SQL definition ensuring all tables exist in all environments)
      this.instance.exec(SCHEMA_SQL);

      // Safe column migrations for existing databases
      try { this.instance.exec('ALTER TABLE users ADD COLUMN username TEXT;'); } catch (_) {}
      try { this.instance.exec('ALTER TABLE users ADD COLUMN password_hash TEXT;'); } catch (_) {}
      try { this.instance.exec('ALTER TABLE users ADD COLUMN google_id TEXT;'); } catch (_) {}
      try { this.instance.exec('ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;'); } catch (_) {}
      try { this.instance.exec('ALTER TABLE users ADD COLUMN kyc_verified INTEGER NOT NULL DEFAULT 0;'); } catch (_) {}
      try { this.instance.exec('ALTER TABLE users ADD COLUMN totp_secret TEXT;'); } catch (_) {}
      try { this.instance.exec('ALTER TABLE users ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0;'); } catch (_) {}
      try {
        this.instance.exec(`
          CREATE TABLE IF NOT EXISTS pending_registrations (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            otp_hash TEXT NOT NULL,
            attempts INTEGER NOT NULL DEFAULT 0,
            send_count INTEGER NOT NULL DEFAULT 1,
            first_sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
        `);
      } catch (_) {}
      try { this.instance.exec('ALTER TABLE tournaments ADD COLUMN room_revealed_at DATETIME;'); } catch (_) {}
      try { this.instance.exec('ALTER TABLE tournaments ADD COLUMN room_updated_at DATETIME;'); } catch (_) {}
      try { this.instance.exec("ALTER TABLE tournaments ADD COLUMN game_mode TEXT NOT NULL DEFAULT 'survival';"); } catch (_) {}
      try { this.instance.exec("ALTER TABLE tournaments ADD COLUMN payout_status TEXT NOT NULL DEFAULT 'unpaid';"); } catch (_) {}
      try { this.instance.exec('ALTER TABLE tournaments ADD COLUMN payout_executed_at DATETIME;'); } catch (_) {}
      try { this.instance.exec('ALTER TABLE tournaments ADD COLUMN payout_executed_by TEXT;'); } catch (_) {}
      try { this.instance.exec('ALTER TABLE payment_orders ADD COLUMN screenshot_url TEXT;'); } catch (_) {}
      try { this.instance.exec('ALTER TABLE payment_orders ADD COLUMN processed_by TEXT;'); } catch (_) {}
      try { this.instance.exec('ALTER TABLE payment_orders ADD COLUMN processed_at DATETIME;'); } catch (_) {}
      try { this.instance.exec('ALTER TABLE audit_logs ADD COLUMN actor_id TEXT;'); } catch (_) {}
      try { this.instance.exec('ALTER TABLE audit_logs ADD COLUMN target_resource TEXT;'); } catch (_) {}
      try { this.instance.exec('ALTER TABLE audit_logs ADD COLUMN target_id TEXT;'); } catch (_) {}

      // Seed default superadmin if not exists
      try {
        const adminEmail = 'flaadmin40@gmail.com';
        const existingAdmin = this.instance.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail) as any;
        const passHash = CryptoUtil.hashPassword('Fla@714367');
        const totpSecret = 'JBSWY3DPEHPK3PXP'; // Standard Base32 secret for Google Authenticator

        if (!existingAdmin) {
          const adminId = uuidv4();
          this.instance.prepare(`
            INSERT INTO users (id, email, phone, password_hash, totp_secret, totp_enabled, role, status, is_phone_verified, is_email_verified, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 1, 'admin', 'active', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `).run(adminId, adminEmail, '+919342235510', passHash, totpSecret);

          this.instance.prepare(`
            INSERT INTO profiles (id, user_id, display_name, ff_verification_status, created_at, updated_at)
            VALUES (?, ?, 'Super Admin', 'verified', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `).run(uuidv4(), adminId);
        } else {
          this.instance.prepare(`
            UPDATE users 
            SET password_hash = ?, totp_secret = ?, totp_enabled = 1, role = 'admin', status = 'active', updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
          `).run(passHash, totpSecret, existingAdmin.id);
        }

        const modEmail = 'moderator@ffesports.com';
        const existingMod = this.instance.prepare('SELECT id FROM users WHERE email = ?').get(modEmail) as any;
        if (!existingMod) {
          const modId = uuidv4();
          const passHash = CryptoUtil.hashPassword('ModPassword123!');
          const totpSecret = 'JBSWY3DPEHPK3PXP';

          this.instance.prepare(`
            INSERT INTO users (id, email, phone, password_hash, totp_secret, totp_enabled, role, status, is_phone_verified, is_email_verified, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 1, 'moderator', 'active', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `).run(modId, modEmail, '+919999999992', passHash, totpSecret);

          this.instance.prepare(`
            INSERT INTO profiles (id, user_id, display_name, ff_verification_status, created_at, updated_at)
            VALUES (?, ?, 'Match Moderator', 'verified', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `).run(uuidv4(), modId);
        }
      } catch (_) {}
    }
    return this.instance;
  }

  public static close(): void {
    if (this.instance) {
      this.instance.close();
      this.instance = null;
    }
  }
}

export const getDb = () => DatabaseManager.getDb();
