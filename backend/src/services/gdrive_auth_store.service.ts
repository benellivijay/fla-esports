import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { Logger } from '../utils/logger';
import { getDb } from '../database/db';
import { User, Profile } from '../types';

export interface StoredPlayerRecord {
  id: string;
  username: string;
  email: string;
  phone?: string | null;
  password_hash?: string | null;
  google_id?: string | null;
  email_verified: boolean;
  phone_verified?: boolean;
  ff_uid?: string | null;
  ff_ign?: string | null;
  kyc_verified: boolean;
  role: 'player' | 'admin' | 'moderator';
  status: 'active' | 'suspended' | 'banned';
  created_at: string;
  updated_at: string;
  profile?: {
    display_name?: string;
    matches_played?: number;
    wins?: number;
    total_kills?: number;
    total_earnings?: number;
  };
}

export interface StoredPendingRegistration {
  email: string;
  username: string;
  name?: string;
  password_hash: string;
  otp_hash: string;
  expires_at: string;
  send_count: number;
  last_sent_at: string;
  created_at: string;
}

export class GDriveAuthStore {
  public static readonly FOLDER_ID = '1aR8N0GpxbdNFbY-u24iFvW145vjR0MhO';
  public static readonly PLAYERS_REGISTRY_FILENAME = 'players_registry.json';
  public static readonly PENDING_REGISTRATIONS_FILENAME = 'pending_registrations.json';

  private static playersCache: Map<string, StoredPlayerRecord> = new Map(); // Keyed by lowercase email and username
  private static pendingCache: Map<string, StoredPendingRegistration> = new Map(); // Keyed by lowercase email
  private static isInitialized = false;

  /**
   * Initializes the Google Drive Auth Store on backend startup.
   */
  public static async initStore(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;

    Logger.info('[GDRIVE AUTH] Initializing Google Drive player auth store...');

    // 1. First populate cache from local mirror / DB
    try {
      const db = getDb();
      const dbUsers = db.prepare('SELECT * FROM users').all() as any[];
      for (const u of dbUsers) {
        const profile = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(u.id) as any;
        const record: StoredPlayerRecord = {
          id: u.id,
          username: u.username,
          email: u.email,
          phone: u.phone,
          password_hash: u.password_hash,
          google_id: u.google_id,
          email_verified: Boolean(u.is_email_verified ?? u.email_verified),
          phone_verified: Boolean(u.is_phone_verified ?? u.phone_verified),
          ff_uid: u.ff_uid,
          ff_ign: u.ff_ign,
          kyc_verified: Boolean(u.is_kyc_verified ?? u.kyc_verified),
          role: u.role || 'player',
          status: u.status || 'active',
          created_at: u.created_at || new Date().toISOString(),
          updated_at: u.updated_at || new Date().toISOString(),
          profile: profile ? {
            display_name: profile.display_name,
            matches_played: profile.matches_played,
            wins: profile.wins,
            total_kills: profile.total_kills,
            total_earnings: profile.total_earnings,
          } : undefined,
        };
        this.cachePlayerRecord(record);
      }
      Logger.info(`[GDRIVE AUTH] Loaded ${dbUsers.length} players from local database mirror.`);
    } catch (err: any) {
      Logger.warn(`[GDRIVE AUTH] Local DB pre-load skipped: ${err.message}`);
    }

    // 2. Pull & Sync latest records from Google Drive in background
    this.restoreFromDrive().catch((err: any) => {
      Logger.warn(`[GDRIVE AUTH] Initial drive restore warning: ${err.message}`);
    });
  }

  /**
   * Cache helper for multi-key lookup (ID, lowercase email, and lowercase username)
   */
  private static cachePlayerRecord(record: StoredPlayerRecord): void {
    if (record.id) this.playersCache.set(record.id, record);
    if (record.email) this.playersCache.set(record.email.toLowerCase().trim(), record);
    if (record.username) this.playersCache.set(record.username.toLowerCase().trim(), record);
    if (record.google_id) this.playersCache.set(`google_${record.google_id}`, record);
  }

  /**
   * Look up a player by email, username, google_id, or user id
   */
  public static async getPlayer(identifier: string): Promise<StoredPlayerRecord | null> {
    if (!this.isInitialized) await this.initStore();
    const clean = identifier.toLowerCase().trim();
    return this.playersCache.get(clean) || this.playersCache.get(identifier) || null;
  }

  /**
   * Look up player by Google OAuth ID
   */
  public static async getPlayerByGoogleId(googleId: string): Promise<StoredPlayerRecord | null> {
    if (!this.isInitialized) await this.initStore();
    return this.playersCache.get(`google_${googleId}`) || null;
  }

  /**
   * Saves or updates a player in Google Drive and local cache
   */
  public static async savePlayer(record: StoredPlayerRecord): Promise<StoredPlayerRecord> {
    if (!this.isInitialized) await this.initStore();

    record.updated_at = new Date().toISOString();
    this.cachePlayerRecord(record);

    // Sync to local DB mirror
    try {
      const db = getDb();
      const dbRole = record.role === 'admin' ? 'admin' : (record.role === 'moderator' ? 'moderator' : 'user');
      const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(record.id);

      if (existing) {
        db.prepare(`
          UPDATE users SET 
            username = ?, email = ?, phone = ?, password_hash = ?, google_id = ?,
            is_email_verified = ?, email_verified = ?, is_phone_verified = ?, kyc_verified = ?,
            role = ?, status = ?, updated_at = ?
          WHERE id = ?
        `).run(
          record.username,
          record.email,
          record.phone || null,
          record.password_hash || null,
          record.google_id || null,
          record.email_verified ? 1 : 0,
          record.email_verified ? 1 : 0,
          record.phone_verified ? 1 : 0,
          record.kyc_verified ? 1 : 0,
          dbRole,
          record.status || 'active',
          record.updated_at,
          record.id
        );
      } else {
        db.prepare(`
          INSERT INTO users (
            id, username, email, phone, password_hash, google_id,
            is_email_verified, email_verified, is_phone_verified, kyc_verified,
            role, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          record.id,
          record.username,
          record.email,
          record.phone || null,
          record.password_hash || null,
          record.google_id || null,
          record.email_verified ? 1 : 0,
          record.email_verified ? 1 : 0,
          record.phone_verified ? 1 : 0,
          record.kyc_verified ? 1 : 0,
          dbRole,
          record.status || 'active',
          record.created_at || new Date().toISOString(),
          record.updated_at
        );
      }

      // Upsert profile in DB
      const existingProf = db.prepare('SELECT id FROM profiles WHERE user_id = ?').get(record.id);
      if (existingProf) {
        db.prepare(`
          UPDATE profiles SET 
            display_name = ?, ff_uid = ?, ff_ign = ?,
            matches_played = ?, wins = ?, total_kills = ?, total_earnings = ?, updated_at = ?
          WHERE user_id = ?
        `).run(
          record.profile?.display_name || record.username,
          record.ff_uid || null,
          record.ff_ign || null,
          record.profile?.matches_played || 0,
          record.profile?.wins || 0,
          record.profile?.total_kills || 0,
          record.profile?.total_earnings || 0,
          record.updated_at,
          record.id
        );
      } else {
        db.prepare(`
          INSERT INTO profiles (
            id, user_id, display_name, ff_uid, ff_ign, ff_verification_status, matches_played, wins, total_kills, total_earnings, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          record.id,
          record.id,
          record.profile?.display_name || record.username,
          record.ff_uid || null,
          record.ff_ign || null,
          record.ff_uid ? 'verified' : 'unverified',
          record.profile?.matches_played || 0,
          record.profile?.wins || 0,
          record.profile?.total_kills || 0,
          record.profile?.total_earnings || 0,
          record.created_at,
          record.updated_at
        );
      }
    } catch (err: any) {
      Logger.warn(`[GDRIVE AUTH] DB sync warning: ${err.message}`);
    }

    // Push updated registry to Google Drive asynchronously
    this.flushPlayersToDrive().catch((err) => {
      Logger.error(`[GDRIVE AUTH] Background sync to Google Drive failed: ${err.message}`);
    });

    return record;
  }

  /**
   * Pending Registration Handlers
   */
  public static async savePendingRegistration(pending: StoredPendingRegistration): Promise<void> {
    if (!this.isInitialized) await this.initStore();
    const key = pending.email.toLowerCase().trim();
    this.pendingCache.set(key, pending);

    // Save to local DB pending table mirror
    try {
      const db = getDb();
      db.prepare(`
        INSERT INTO pending_registrations (email, username, password_hash, otp_hash, expires_at, send_count, last_sent_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(email) DO UPDATE SET
          username = excluded.username,
          password_hash = excluded.password_hash,
          otp_hash = excluded.otp_hash,
          expires_at = excluded.expires_at,
          send_count = excluded.send_count,
          last_sent_at = excluded.last_sent_at
      `).run(
        pending.email.toLowerCase().trim(),
        pending.username.trim(),
        pending.password_hash,
        pending.otp_hash,
        pending.expires_at,
        pending.send_count,
        pending.last_sent_at
      );
    } catch (_) {}

    this.flushPendingToDrive().catch((err) => {
      Logger.error(`[GDRIVE AUTH] Pending sync to Google Drive failed: ${err.message}`);
    });
  }

  public static async getPendingRegistration(email: string): Promise<StoredPendingRegistration | null> {
    if (!this.isInitialized) await this.initStore();
    const key = email.toLowerCase().trim();
    if (this.pendingCache.has(key)) {
      return this.pendingCache.get(key)!;
    }
    // Fallback to local DB
    try {
      const db = getDb();
      const row = db.prepare('SELECT * FROM pending_registrations WHERE LOWER(email) = ?').get(key) as any;
      if (row) {
        const item: StoredPendingRegistration = {
          email: row.email,
          username: row.username,
          password_hash: row.password_hash,
          otp_hash: row.otp_hash,
          expires_at: row.expires_at,
          send_count: row.send_count || 1,
          last_sent_at: row.last_sent_at,
          created_at: row.created_at || new Date().toISOString(),
        };
        this.pendingCache.set(key, item);
        return item;
      }
    } catch (_) {}
    return null;
  }

  public static async deletePendingRegistration(email: string): Promise<void> {
    const key = email.toLowerCase().trim();
    this.pendingCache.delete(key);
    try {
      const db = getDb();
      db.prepare('DELETE FROM pending_registrations WHERE LOWER(email) = ?').run(key);
    } catch (_) {}
    this.flushPendingToDrive().catch((err) => Logger.error(`[GDRIVE AUTH] Flush pending failed: ${err.message}`));
  }

  /**
   * Persists all registered players to Google Drive as 'players_registry.json'
   */
  public static async flushPlayersToDrive(): Promise<boolean> {
    const uniquePlayers = Array.from(new Set(this.playersCache.values()));
    const payload = {
      version: '1.0',
      last_synced_at: new Date().toISOString(),
      folder_id: this.FOLDER_ID,
      count: uniquePlayers.length,
      players: uniquePlayers,
    };

    const jsonContent = JSON.stringify(payload, null, 2);
    return await this.uploadOrUpdateDriveFile(this.PLAYERS_REGISTRY_FILENAME, jsonContent);
  }

  /**
   * Persists pending registrations to Google Drive
   */
  public static async flushPendingToDrive(): Promise<boolean> {
    const pendingList = Array.from(this.pendingCache.values());
    const payload = {
      last_synced_at: new Date().toISOString(),
      count: pendingList.length,
      pending: pendingList,
    };

    const jsonContent = JSON.stringify(payload, null, 2);
    return await this.uploadOrUpdateDriveFile(this.PENDING_REGISTRATIONS_FILENAME, jsonContent);
  }

  /**
   * Pulls and restores players from Google Drive
   */
  public static async restoreFromDrive(): Promise<number> {
    try {
      const driveContent = await this.readDriveFile(this.PLAYERS_REGISTRY_FILENAME);
      if (!driveContent) {
        Logger.info('[GDRIVE AUTH] No existing players_registry.json found in Google Drive. Starting fresh store.');
        return 0;
      }

      const parsed = JSON.parse(driveContent);
      const players: StoredPlayerRecord[] = parsed.players || [];

      let imported = 0;
      for (const p of players) {
        this.cachePlayerRecord(p);
        // Sync into DB mirror if missing
        try {
          const db = getDb();
          const exists = db.prepare('SELECT id FROM users WHERE id = ?').get(p.id);
          if (!exists) {
            db.prepare(`
              INSERT INTO users (
                id, username, email, phone, password_hash, google_id,
                is_email_verified, is_phone_verified, is_kyc_verified,
                ff_uid, ff_ign, role, status, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              p.id, p.username, p.email, p.phone || null, p.password_hash || null, p.google_id || null,
              p.email_verified ? 1 : 0, p.phone_verified ? 1 : 0, p.kyc_verified ? 1 : 0,
              p.ff_uid || null, p.ff_ign || null, p.role || 'player', p.status || 'active',
              p.created_at, p.updated_at
            );
            imported++;
          }
        } catch (_) {}
      }

      Logger.info(`[GDRIVE AUTH] Restored ${players.length} players (${imported} new) from Google Drive.`);
      return players.length;
    } catch (err: any) {
      Logger.warn(`[GDRIVE AUTH] Could not restore players from Google Drive: ${err.message}`);
      return 0;
    }
  }

  /**
   * Drive File Read / Write Helpers
   */
  private static async uploadOrUpdateDriveFile(fileName: string, content: string): Promise<boolean> {
    // 1. Always persist to local gdrive_storage mirror
    try {
      const backupDir = path.resolve(process.cwd(), 'gdrive_storage');
      if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
      fs.writeFileSync(path.join(backupDir, fileName), content, 'utf8');
    } catch (err: any) {
      Logger.warn(`[GDRIVE AUTH] Local mirror write warning: ${err.message}`);
    }

    // 2. Google Drive API Service Account Cloud Upload
    const keyFilePath = path.resolve(process.cwd(), 'gdrive-service-account.json');
    const hasKeyFile = fs.existsSync(keyFilePath);
    const hasEnv = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GDRIVE_SERVICE_ACCOUNT_JSON);

    if (hasKeyFile || hasEnv) {
      try {
        const auth = new google.auth.GoogleAuth({
          keyFile: hasKeyFile ? keyFilePath : undefined,
          credentials: process.env.GDRIVE_SERVICE_ACCOUNT_JSON ? JSON.parse(process.env.GDRIVE_SERVICE_ACCOUNT_JSON) : undefined,
          scopes: ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive'],
        });
        const drive = google.drive({ version: 'v3', auth });

        // Search for existing file in target folder
        const listRes = await drive.files.list({
          q: `'${this.FOLDER_ID}' in parents and name = '${fileName}' and trashed = false`,
          fields: 'files(id, name)',
        });

        const existingFile = listRes.data.files && listRes.data.files[0];
        const media = {
          mimeType: 'application/json',
          body: content,
        };

        if (existingFile && existingFile.id) {
          await drive.files.update({
            fileId: existingFile.id,
            media: media,
          });
        } else {
          await drive.files.create({
            requestBody: {
              name: fileName,
              parents: [this.FOLDER_ID],
            },
            media: media,
          });
        }
        return true;
      } catch (err: any) {
        Logger.warn(`[GDRIVE API] Cloud sync info: ${err.message}`);
      }
    }

    // 3. Google Apps Script Webhook
    const webhookUrl = process.env.GDRIVE_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        const res = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          redirect: 'follow',
          signal: AbortSignal.timeout(5000),
          body: JSON.stringify({
            action: 'save_file',
            folderId: this.FOLDER_ID,
            fileName: fileName,
            fileData: Buffer.from(content).toString('base64'),
            mimeType: 'application/json',
          }),
        });
        return res.ok;
      } catch (err: any) {
        Logger.warn(`[GDRIVE Webhook] Cloud sync info: ${err.message}`);
      }
    }

    return true;
  }

  private static async readDriveFile(fileName: string): Promise<string | null> {
    // 1. Check Google Drive API Service Account
    const keyFilePath = path.resolve(process.cwd(), 'gdrive-service-account.json');
    const hasKeyFile = fs.existsSync(keyFilePath);
    const hasEnv = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GDRIVE_SERVICE_ACCOUNT_JSON);

    if (hasKeyFile || hasEnv) {
      try {
        const auth = new google.auth.GoogleAuth({
          keyFile: hasKeyFile ? keyFilePath : undefined,
          credentials: process.env.GDRIVE_SERVICE_ACCOUNT_JSON ? JSON.parse(process.env.GDRIVE_SERVICE_ACCOUNT_JSON) : undefined,
          scopes: ['https://www.googleapis.com/auth/drive.readonly', 'https://www.googleapis.com/auth/drive'],
        });
        const drive = google.drive({ version: 'v3', auth });

        const listRes = await drive.files.list({
          q: `'${this.FOLDER_ID}' in parents and name = '${fileName}' and trashed = false`,
          fields: 'files(id, name)',
        });

        const file = listRes.data.files && listRes.data.files[0];
        if (file && file.id) {
          const res = await drive.files.get(
            { fileId: file.id, alt: 'media' },
            { responseType: 'text' }
          );
          return typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
        }
      } catch (err: any) {
        Logger.warn(`[GDRIVE API] Could not read from Google Drive API: ${err.message}`);
      }
    }

    // 2. Check Google Apps Script Webhook
    const webhookUrl = process.env.GDRIVE_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        const res = await fetch(`${webhookUrl}?action=read_file&folderId=${this.FOLDER_ID}&fileName=${fileName}`, {
          method: 'GET',
          redirect: 'follow',
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          const text = await res.text();
          let data: any = {};
          try { data = JSON.parse(text); } catch (_) {}
          if (data.fileContent) {
            return Buffer.from(data.fileContent, 'base64').toString('utf8');
          }
        }
      } catch (err: any) {
        Logger.warn(`[GDRIVE Webhook] Could not read from Webhook: ${err.message}`);
      }
    }

    // 3. Fallback: Local storage mirror
    const backupPath = path.resolve(process.cwd(), 'gdrive_storage', fileName);
    if (fs.existsSync(backupPath)) {
      return fs.readFileSync(backupPath, 'utf8');
    }

    return null;
  }
}
