import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { Logger } from '../utils/logger';
import { getDb } from '../database/db';

export interface StoredTournamentEntry {
  id: string;
  tournament_id: string;
  user_id: string;
  slot_number: number;
  team_name?: string | null;
  player_ff_uid: string;
  player_ff_ign: string;
  teammate_details?: string | null;
  entry_fee_paid: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface StoredTournamentRecord {
  id: string;
  title: string;
  description?: string | null;
  game: string;
  game_mode: string;
  mode: string;
  map: string;
  entry_type: string;
  entry_fee: number;
  prize_pool: number;
  prize_distribution: string;
  per_kill_prize: number;
  max_slots: number;
  filled_slots: number;
  start_time: string;
  registration_closes_at?: string | null;
  room_reveal_time_minutes: number;
  room_id?: string | null;
  room_password?: string | null;
  room_revealed: number;
  room_revealed_at?: string | null;
  room_updated_at?: string | null;
  room_updated_by?: string | null;
  status: string;
  payout_status?: string;
  payout_executed_at?: string | null;
  payout_executed_by?: string | null;
  banner_url?: string | null;
  rules?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  entries?: StoredTournamentEntry[];
}

export class GDriveTournamentStore {
  public static readonly FOLDER_ID = '1aR8N0GpxbdNFbY-u24iFvW145vjR0MhO';
  public static readonly TOURNAMENTS_REGISTRY_FILENAME = 'tournaments_registry.json';

  private static tournamentsCache: Map<string, StoredTournamentRecord> = new Map();
  private static isInitialized = false;

  /**
   * Initializes the Google Drive Tournament Store on backend startup.
   */
  public static async initStore(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;

    Logger.info('[GDRIVE TOURNAMENTS] Initializing Google Drive tournament store...');

    // 1. Populate cache from local DB
    try {
      const db = getDb();
      const dbTournaments = db.prepare('SELECT * FROM tournaments').all() as any[];
      for (const t of dbTournaments) {
        const entries = db.prepare('SELECT * FROM tournament_entries WHERE tournament_id = ?').all(t.id) as any[];
        const record: StoredTournamentRecord = {
          ...t,
          entries: entries || [],
        };
        this.tournamentsCache.set(t.id, record);
      }
      Logger.info(`[GDRIVE TOURNAMENTS] Loaded ${dbTournaments.length} tournaments from local database mirror.`);
    } catch (err: any) {
      Logger.warn(`[GDRIVE TOURNAMENTS] Local DB pre-load skipped: ${err.message}`);
    }

    // 2. Pull and sync latest tournaments from Google Drive
    this.restoreFromDrive().catch((err: any) => {
      Logger.warn(`[GDRIVE TOURNAMENTS] Initial drive restore warning: ${err.message}`);
    });
  }

  public static async getTournament(id: string): Promise<StoredTournamentRecord | null> {
    if (!this.isInitialized) await this.initStore();
    return this.tournamentsCache.get(id) || null;
  }

  public static async getAllTournaments(): Promise<StoredTournamentRecord[]> {
    if (!this.isInitialized) await this.initStore();
    return Array.from(this.tournamentsCache.values());
  }

  /**
   * Saves or updates a tournament in Google Drive and local cache
   */
  public static async saveTournament(record: StoredTournamentRecord): Promise<StoredTournamentRecord> {
    if (!this.isInitialized) await this.initStore();

    record.updated_at = record.updated_at || new Date().toISOString();
    this.tournamentsCache.set(record.id, record);

    // Sync to local DB
    try {
      const db = getDb();
      const existing = db.prepare('SELECT id FROM tournaments WHERE id = ?').get(record.id);

      const prizeDistStr = typeof record.prize_distribution === 'string'
        ? record.prize_distribution
        : JSON.stringify(record.prize_distribution || []);

      if (existing) {
        db.prepare(`
          UPDATE tournaments SET 
            title = ?, description = ?, game = ?, game_mode = ?, mode = ?, map = ?,
            entry_type = ?, entry_fee = ?, prize_pool = ?, prize_distribution = ?,
            per_kill_prize = ?, max_slots = ?, filled_slots = ?, start_time = ?,
            registration_closes_at = ?, room_reveal_time_minutes = ?, room_id = ?,
            room_password = ?, room_revealed = ?, room_revealed_at = ?, room_updated_at = ?,
            room_updated_by = ?, status = ?, payout_status = ?, payout_executed_at = ?,
            payout_executed_by = ?, banner_url = ?, rules = ?, updated_at = ?
          WHERE id = ?
        `).run(
          record.title,
          record.description || null,
          record.game || 'Free Fire',
          record.game_mode || 'survival',
          record.mode,
          record.map,
          record.entry_type,
          record.entry_fee || 0,
          record.prize_pool || 0,
          prizeDistStr,
          record.per_kill_prize || 0,
          record.max_slots,
          record.filled_slots || 0,
          record.start_time,
          record.registration_closes_at || null,
          record.room_reveal_time_minutes || 15,
          record.room_id || null,
          record.room_password || null,
          record.room_revealed ? 1 : 0,
          record.room_revealed_at || null,
          record.room_updated_at || null,
          record.room_updated_by || null,
          record.status || 'upcoming',
          record.payout_status || 'unpaid',
          record.payout_executed_at || null,
          record.payout_executed_by || null,
          record.banner_url || null,
          record.rules || null,
          record.updated_at,
          record.id
        );
      } else {
        db.prepare(`
          INSERT INTO tournaments (
            id, title, description, game, game_mode, mode, map, entry_type, entry_fee,
            prize_pool, prize_distribution, per_kill_prize, max_slots, filled_slots,
            start_time, registration_closes_at, room_reveal_time_minutes, room_id,
            room_password, room_revealed, room_revealed_at, room_updated_at,
            room_updated_by, status, payout_status, payout_executed_at,
            payout_executed_by, banner_url, rules, created_by, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          record.id,
          record.title,
          record.description || null,
          record.game || 'Free Fire',
          record.game_mode || 'survival',
          record.mode,
          record.map,
          record.entry_type,
          record.entry_fee || 0,
          record.prize_pool || 0,
          prizeDistStr,
          record.per_kill_prize || 0,
          record.max_slots,
          record.filled_slots || 0,
          record.start_time,
          record.registration_closes_at || null,
          record.room_reveal_time_minutes || 15,
          record.room_id || null,
          record.room_password || null,
          record.room_revealed ? 1 : 0,
          record.room_revealed_at || null,
          record.room_updated_at || null,
          record.room_updated_by || null,
          record.status || 'upcoming',
          record.payout_status || 'unpaid',
          record.payout_executed_at || null,
          record.payout_executed_by || null,
          record.banner_url || null,
          record.rules || null,
          record.created_by || null,
          record.created_at || new Date().toISOString(),
          record.updated_at
        );
      }

      // Upsert confirmed entries if provided
      if (record.entries && record.entries.length > 0) {
        for (const entry of record.entries) {
          try {
            db.prepare(`
              INSERT INTO tournament_entries (
                id, tournament_id, user_id, slot_number, team_name, player_ff_uid,
                player_ff_ign, teammate_details, entry_fee_paid, status, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                status = excluded.status,
                player_ff_uid = excluded.player_ff_uid,
                player_ff_ign = excluded.player_ff_ign,
                teammate_details = excluded.teammate_details,
                updated_at = excluded.updated_at
            `).run(
              entry.id,
              record.id,
              entry.user_id,
              entry.slot_number,
              entry.team_name || null,
              entry.player_ff_uid,
              entry.player_ff_ign,
              entry.teammate_details || null,
              entry.entry_fee_paid || 0,
              entry.status || 'confirmed',
              entry.created_at || new Date().toISOString(),
              entry.updated_at || new Date().toISOString()
            );
          } catch (_) {}
        }
      }
    } catch (err: any) {
      Logger.warn(`[GDRIVE TOURNAMENTS] DB sync warning: ${err.message}`);
    }

    // Flush to Google Drive asynchronously
    this.flushTournamentsToDrive().catch((err) => {
      Logger.error(`[GDRIVE TOURNAMENTS] Background sync to Google Drive failed: ${err.message}`);
    });

    return record;
  }

  /**
   * Syncs entry / slot booking changes
   */
  public static async syncEntry(tournamentId: string, entry: StoredTournamentEntry): Promise<void> {
    const tourney = await this.getTournament(tournamentId);
    if (!tourney) return;

    if (!tourney.entries) tourney.entries = [];
    const idx = tourney.entries.findIndex((e) => e.id === entry.id || (e.slot_number === entry.slot_number && e.status === 'confirmed'));
    if (idx >= 0) {
      tourney.entries[idx] = entry;
    } else {
      tourney.entries.push(entry);
    }

    // Recalculate filled slots
    tourney.filled_slots = tourney.entries.filter((e) => e.status === 'confirmed').length;
    await this.saveTournament(tourney);
  }

  /**
   * Explicitly delete tournament from cache and Google Drive ONLY on admin command
   */
  public static async deleteTournament(tournamentId: string): Promise<void> {
    if (!this.isInitialized) await this.initStore();
    this.tournamentsCache.delete(tournamentId);

    this.flushTournamentsToDrive().catch((err) => {
      Logger.error(`[GDRIVE TOURNAMENTS] Delete sync to Google Drive failed: ${err.message}`);
    });
  }

  /**
   * Persists all tournaments to Google Drive as 'tournaments_registry.json'
   */
  public static async flushTournamentsToDrive(): Promise<boolean> {
    const all = Array.from(this.tournamentsCache.values());
    const payload = {
      version: '1.0',
      last_synced_at: new Date().toISOString(),
      folder_id: this.FOLDER_ID,
      count: all.length,
      tournaments: all,
    };

    const jsonContent = JSON.stringify(payload, null, 2);
    return await this.uploadOrUpdateDriveFile(this.TOURNAMENTS_REGISTRY_FILENAME, jsonContent);
  }

  /**
   * Restores all tournaments and entries from Google Drive
   */
  public static async restoreFromDrive(): Promise<{ restoredCount: number; newCount: number }> {
    let restoredCount = 0;
    let newCount = 0;

    try {
      const content = await this.readDriveFile(this.TOURNAMENTS_REGISTRY_FILENAME);
      if (!content) {
        Logger.info('[GDRIVE TOURNAMENTS] No tournaments_registry.json found in Google Drive. Starting fresh.');
        return { restoredCount: 0, newCount: 0 };
      }

      const parsed = JSON.parse(content);
      const list: StoredTournamentRecord[] = parsed.tournaments || [];
      const db = getDb();

      for (const t of list) {
        if (!t.id || !t.title) continue;
        restoredCount++;

        if (!this.tournamentsCache.has(t.id)) {
          this.tournamentsCache.set(t.id, t);
          newCount++;
        }

        // Restore into SQLite if not present
        const inDb = db.prepare('SELECT id FROM tournaments WHERE id = ?').get(t.id);
        if (!inDb) {
          const prizeDistStr = typeof t.prize_distribution === 'string'
            ? t.prize_distribution
            : JSON.stringify(t.prize_distribution || []);

          try {
            db.prepare(`
              INSERT INTO tournaments (
                id, title, description, game, game_mode, mode, map, entry_type, entry_fee,
                prize_pool, prize_distribution, per_kill_prize, max_slots, filled_slots,
                start_time, registration_closes_at, room_reveal_time_minutes, room_id,
                room_password, room_revealed, room_revealed_at, room_updated_at,
                room_updated_by, status, payout_status, payout_executed_at,
                payout_executed_by, banner_url, rules, created_by, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              t.id,
              t.title,
              t.description || null,
              t.game || 'Free Fire',
              t.game_mode || 'survival',
              t.mode,
              t.map,
              t.entry_type,
              t.entry_fee || 0,
              t.prize_pool || 0,
              prizeDistStr,
              t.per_kill_prize || 0,
              t.max_slots,
              t.filled_slots || 0,
              t.start_time,
              t.registration_closes_at || null,
              t.room_reveal_time_minutes || 15,
              t.room_id || null,
              t.room_password || null,
              t.room_revealed ? 1 : 0,
              t.room_revealed_at || null,
              t.room_updated_at || null,
              t.room_updated_by || null,
              t.status || 'upcoming',
              t.payout_status || 'unpaid',
              t.payout_executed_at || null,
              t.payout_executed_by || null,
              t.banner_url || null,
              t.rules || null,
              t.created_by || null,
              t.created_at || new Date().toISOString(),
              t.updated_at || new Date().toISOString()
            );
          } catch (insertErr: any) {
            Logger.warn(`[GDRIVE TOURNAMENTS] Error restoring tournament ${t.title}: ${insertErr.message}`);
          }

          if (t.entries && t.entries.length > 0) {
            for (const entry of t.entries) {
              try {
                db.prepare(`
                  INSERT OR IGNORE INTO tournament_entries (
                    id, tournament_id, user_id, slot_number, team_name, player_ff_uid,
                    player_ff_ign, teammate_details, entry_fee_paid, status, created_at, updated_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                  entry.id,
                  t.id,
                  entry.user_id,
                  entry.slot_number,
                  entry.team_name || null,
                  entry.player_ff_uid,
                  entry.player_ff_ign,
                  entry.teammate_details || null,
                  entry.entry_fee_paid || 0,
                  entry.status || 'confirmed',
                  entry.created_at || new Date().toISOString(),
                  entry.updated_at || new Date().toISOString()
                );
              } catch (_) {}
            }
          }
        }
      }

      Logger.info(`[GDRIVE TOURNAMENTS] Restored ${restoredCount} tournaments (${newCount} new) from Google Drive.`);
    } catch (err: any) {
      Logger.error(`[GDRIVE TOURNAMENTS] Restore from Drive failed: ${err.message}`);
    }

    return { restoredCount, newCount };
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
      Logger.warn(`[GDRIVE TOURNAMENTS] Local mirror write warning: ${err.message}`);
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

    // 3. Google Apps Script Webhook fallback
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
    // 1. Google Drive API Service Account
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

    // 2. Google Apps Script Webhook
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
