"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDb = exports.DatabaseManager = void 0;
const node_sqlite_1 = require("node:sqlite");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const env_1 = require("../config/env");
const crypto_1 = require("../utils/crypto");
const uuid_1 = require("uuid");
const schema_sql_1 = require("./schema_sql");
class DatabaseManager {
    static instance = null;
    static getDb() {
        if (!this.instance) {
            const dbDir = path_1.default.dirname(env_1.config.db.filename);
            if (!fs_1.default.existsSync(dbDir)) {
                fs_1.default.mkdirSync(dbDir, { recursive: true });
            }
            if (!fs_1.default.existsSync(env_1.config.db.filename)) {
                const seedCandidates = [
                    path_1.default.resolve(__dirname, '../../data/seed_ff_esports.db'),
                    path_1.default.resolve(__dirname, '../../../data/seed_ff_esports.db'),
                    path_1.default.resolve(process.cwd(), 'backend', 'data', 'seed_ff_esports.db'),
                    path_1.default.resolve(process.cwd(), 'data', 'seed_ff_esports.db'),
                ];
                for (const s of seedCandidates) {
                    if (fs_1.default.existsSync(s)) {
                        try {
                            fs_1.default.copyFileSync(s, env_1.config.db.filename);
                            break;
                        }
                        catch (_) { }
                    }
                }
            }
            this.instance = new node_sqlite_1.DatabaseSync(env_1.config.db.filename);
            this.instance.exec('PRAGMA journal_mode = WAL;');
            this.instance.exec('PRAGMA foreign_keys = ON;');
            // Initialize schema (executes embedded SQL definition ensuring all tables exist in all environments)
            this.instance.exec(schema_sql_1.SCHEMA_SQL);
            // Safe column migrations for existing databases
            try {
                this.instance.exec('ALTER TABLE users ADD COLUMN username TEXT;');
            }
            catch (_) { }
            try {
                this.instance.exec('ALTER TABLE users ADD COLUMN password_hash TEXT;');
            }
            catch (_) { }
            try {
                this.instance.exec('ALTER TABLE users ADD COLUMN google_id TEXT;');
            }
            catch (_) { }
            try {
                this.instance.exec('ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;');
            }
            catch (_) { }
            try {
                this.instance.exec('ALTER TABLE users ADD COLUMN kyc_verified INTEGER NOT NULL DEFAULT 0;');
            }
            catch (_) { }
            try {
                this.instance.exec('ALTER TABLE users ADD COLUMN totp_secret TEXT;');
            }
            catch (_) { }
            try {
                this.instance.exec('ALTER TABLE users ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0;');
            }
            catch (_) { }
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
            }
            catch (_) { }
            try {
                this.instance.exec('ALTER TABLE tournaments ADD COLUMN room_revealed_at DATETIME;');
            }
            catch (_) { }
            try {
                this.instance.exec('ALTER TABLE tournaments ADD COLUMN room_updated_at DATETIME;');
            }
            catch (_) { }
            try {
                this.instance.exec("ALTER TABLE tournaments ADD COLUMN game_mode TEXT NOT NULL DEFAULT 'survival';");
            }
            catch (_) { }
            try {
                this.instance.exec("ALTER TABLE tournaments ADD COLUMN payout_status TEXT NOT NULL DEFAULT 'unpaid';");
            }
            catch (_) { }
            try {
                this.instance.exec('ALTER TABLE tournaments ADD COLUMN payout_executed_at DATETIME;');
            }
            catch (_) { }
            try {
                this.instance.exec('ALTER TABLE tournaments ADD COLUMN payout_executed_by TEXT;');
            }
            catch (_) { }
            try {
                this.instance.exec('ALTER TABLE payment_orders ADD COLUMN screenshot_url TEXT;');
            }
            catch (_) { }
            try {
                this.instance.exec('ALTER TABLE payment_orders ADD COLUMN processed_by TEXT;');
            }
            catch (_) { }
            try {
                this.instance.exec('ALTER TABLE payment_orders ADD COLUMN processed_at DATETIME;');
            }
            catch (_) { }
            try {
                this.instance.exec('ALTER TABLE audit_logs ADD COLUMN actor_id TEXT;');
            }
            catch (_) { }
            try {
                this.instance.exec('ALTER TABLE audit_logs ADD COLUMN target_resource TEXT;');
            }
            catch (_) { }
            try {
                this.instance.exec('ALTER TABLE audit_logs ADD COLUMN target_id TEXT;');
            }
            catch (_) { }
            try {
                this.instance.exec(`
          CREATE TABLE IF NOT EXISTS deleted_tournaments (
            id TEXT PRIMARY KEY,
            deleted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            deleted_by TEXT
          );
        `);
            }
            catch (_) { }
            try {
                this.instance.exec(`
          CREATE TABLE IF NOT EXISTS device_tokens (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            token TEXT NOT NULL UNIQUE,
            platform TEXT NOT NULL CHECK(platform IN ('android', 'ios', 'web')),
            device_info TEXT,
            last_active_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
          );
        `);
            }
            catch (_) { }
            try {
                const notifTable = this.instance.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='notifications'").get();
                if (notifTable && notifTable.sql && notifTable.sql.includes('CHECK(type IN')) {
                    this.instance.exec(`
            CREATE TABLE IF NOT EXISTS notifications_v2 (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              title TEXT NOT NULL,
              body TEXT NOT NULL,
              type TEXT NOT NULL,
              data TEXT,
              is_read INTEGER NOT NULL DEFAULT 0,
              created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            INSERT OR IGNORE INTO notifications_v2 (id, user_id, title, body, type, data, is_read, created_at)
            SELECT id, user_id, title, body, type, data, is_read, created_at FROM notifications;
            DROP TABLE notifications;
            ALTER TABLE notifications_v2 RENAME TO notifications;
          `);
                }
            }
            catch (_) { }
            try {
                this.instance.exec(`
          CREATE TABLE IF NOT EXISTS app_installs (
            id TEXT PRIMARY KEY,
            device_id TEXT NOT NULL UNIQUE,
            user_id TEXT,
            platform TEXT NOT NULL DEFAULT 'android',
            app_version TEXT NOT NULL DEFAULT '1.0.0',
            device_model TEXT,
            os_version TEXT,
            ip_address TEXT,
            first_installed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            last_active_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
        `);
            }
            catch (_) { }
            try {
                this.instance.exec(`
          UPDATE tournaments SET max_slots = max_slots * 4 WHERE mode = 'squad' AND max_slots <= 12;
          UPDATE tournaments SET max_slots = max_slots * 2 WHERE mode = 'duo' AND max_slots <= 24;
          DROP INDEX IF EXISTS idx_unique_confirmed_user;
        `);
            }
            catch (_) { }
            // Seed default superadmins if not exists
            try {
                const admins = [
                    {
                        email: 'flaadmin01@gmail.com',
                        username: 'flaadmin01',
                        phone: '+919342235511',
                        password: 'Fla@714367',
                        totpSecret: 'FLAADMINAUTHK234', // Dedicated Base32 Authenticator secret for flaadmin01
                        displayName: 'FLA Super Admin 01',
                    },
                    {
                        email: 'flaadmin40@gmail.com',
                        username: 'flaadmin40',
                        phone: '+919342235510',
                        password: 'Fla@714367',
                        totpSecret: 'JBSWY3DPEHPK3PXP', // Base32 Authenticator secret for flaadmin40
                        displayName: 'Super Admin',
                    },
                ];
                for (const adminData of admins) {
                    const existingAdmin = this.instance.prepare('SELECT id FROM users WHERE email = ?').get(adminData.email);
                    const passHash = crypto_1.CryptoUtil.hashPassword(adminData.password);
                    if (!existingAdmin) {
                        const adminId = (0, uuid_1.v4)();
                        this.instance.prepare(`
              INSERT INTO users (id, username, email, phone, password_hash, totp_secret, totp_enabled, role, status, is_phone_verified, is_email_verified, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, 1, 'admin', 'active', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `).run(adminId, adminData.username, adminData.email, adminData.phone, passHash, adminData.totpSecret);
                        this.instance.prepare(`
              INSERT INTO profiles (id, user_id, display_name, ff_verification_status, created_at, updated_at)
              VALUES (?, ?, ?, 'verified', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `).run((0, uuid_1.v4)(), adminId, adminData.displayName);
                    }
                    else {
                        this.instance.prepare(`
              UPDATE users 
              SET username = ?, password_hash = ?, totp_secret = ?, totp_enabled = 1, role = 'admin', status = 'active', updated_at = CURRENT_TIMESTAMP 
              WHERE id = ?
            `).run(adminData.username, passHash, adminData.totpSecret, existingAdmin.id);
                    }
                }
                const modEmail = 'moderator@ffesports.com';
                const existingMod = this.instance.prepare('SELECT id FROM users WHERE email = ?').get(modEmail);
                if (!existingMod) {
                    const modId = (0, uuid_1.v4)();
                    const passHash = crypto_1.CryptoUtil.hashPassword('ModPassword123!');
                    const totpSecret = 'JBSWY3DPEHPK3PXP';
                    this.instance.prepare(`
            INSERT INTO users (id, email, phone, password_hash, totp_secret, totp_enabled, role, status, is_phone_verified, is_email_verified, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 1, 'moderator', 'active', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `).run(modId, modEmail, '+919999999992', passHash, totpSecret);
                    this.instance.prepare(`
            INSERT INTO profiles (id, user_id, display_name, ff_verification_status, created_at, updated_at)
            VALUES (?, ?, 'Match Moderator', 'verified', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `).run((0, uuid_1.v4)(), modId);
                }
            }
            catch (_) { }
        }
        return this.instance;
    }
    static close() {
        if (this.instance) {
            this.instance.close();
            this.instance = null;
        }
    }
}
exports.DatabaseManager = DatabaseManager;
const getDb = () => DatabaseManager.getDb();
exports.getDb = getDb;
