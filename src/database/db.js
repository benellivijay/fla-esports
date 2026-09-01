let DatabaseSync;
try {
  DatabaseSync = require('better-sqlite3');
} catch (e1) {
  try {
    DatabaseSync = require('node:sqlite').DatabaseSync;
  } catch (e2) {
    throw new Error('SQLite library not found. Please install better-sqlite3 or use Node.js 22+');
  }
}

const fs = require('node:fs');
const path = require('node:path');
const env = require('../config/env');

class Database {
  constructor(dbPath = env.DATABASE_PATH) {
    this.dbPath = dbPath;
    this.db = null;
    this.init();
  }

  init() {
    const dir = path.dirname(path.resolve(this.dbPath));
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new DatabaseSync(this.dbPath);

    // Initialize Schema
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      this.db.exec(schemaSql);
    }

    // Auto-migrate new columns
    const automodCols = ['anticaps', 'antimention', 'antiemojispam', 'antinsfw'];
    for (const col of automodCols) {
      try {
        this.db.exec(`ALTER TABLE automod_config ADD COLUMN ${col} INTEGER DEFAULT 0;`);
      } catch {}
    }

    const loggingCols = [
      { name: 'enabled', type: 'INTEGER DEFAULT 1' },
      { name: 'member_channel_id', type: 'TEXT' },
      { name: 'message_channel_id', type: 'TEXT' },
      { name: 'voice_channel_id', type: 'TEXT' },
      { name: 'server_channel_id', type: 'TEXT' },
      { name: 'channel_channel_id', type: 'TEXT' },
      { name: 'role_channel_id', type: 'TEXT' },
      { name: 'mod_channel_id', type: 'TEXT' },
      { name: 'category_id', type: 'TEXT' }
    ];
    for (const col of loggingCols) {
      try {
        this.db.exec(`ALTER TABLE logging_config ADD COLUMN ${col.name} ${col.type};`);
      } catch {}
    }

    // Auto-create anti_raid_config table
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS anti_raid_config (
          guild_id TEXT PRIMARY KEY,
          enabled INTEGER DEFAULT 1,
          score_limit INTEGER DEFAULT 25,
          window_seconds INTEGER DEFAULT 60,
          punishment TEXT DEFAULT 'kick',
          timeout_duration_minutes INTEGER DEFAULT 60,
          min_account_age_days INTEGER DEFAULT 3,
          age_score INTEGER DEFAULT 3,
          no_avatar_score INTEGER DEFAULT 3,
          rapid_join_score INTEGER DEFAULT 3,
          base_score INTEGER DEFAULT 1,
          badge_bypass_enabled INTEGER DEFAULT 1,
          auto_lockdown_enabled INTEGER DEFAULT 1,
          active_preset TEXT DEFAULT 'standard',
          lockdown_active INTEGER DEFAULT 0,
          last_raid_timestamp INTEGER
        );
      `);
    } catch {}

    const vmCols = [
      { name: 'interface_channel_id', type: 'TEXT' },
      { name: 'interface_message_id', type: 'TEXT' },
      { name: 'enabled_buttons', type: "TEXT DEFAULT '[\"all\"]'" }
    ];
    for (const col of vmCols) {
      try {
        this.db.exec(`ALTER TABLE voicemaster_config ADD COLUMN ${col.name} ${col.type};`);
      } catch {}
    }

    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS mic_guard_config (
          guild_id TEXT PRIMARY KEY,
          enabled INTEGER DEFAULT 1,
          sensitivity TEXT DEFAULT 'standard',
          punishment TEXT DEFAULT 'disconnect',
          warn_dm INTEGER DEFAULT 1,
          log_channel_id TEXT
        );

        CREATE TABLE IF NOT EXISTS mic_guard_warnings (
          guild_id TEXT,
          user_id TEXT,
          warning_count INTEGER DEFAULT 0,
          last_warn_timestamp INTEGER,
          PRIMARY KEY(guild_id, user_id)
        );
      `);
    } catch {}

    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS vc_stat_trackers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guild_id TEXT NOT NULL,
          channel_id TEXT NOT NULL,
          template TEXT NOT NULL,
          UNIQUE(guild_id, channel_id)
        );
      `);
    } catch {}
  }

  prepare(sql) {
    return this.db.prepare(sql);
  }

  exec(sql) {
    return this.db.exec(sql);
  }

  run(sql, ...params) {
    const stmt = this.db.prepare(sql);
    return stmt.run(...params);
  }

  get(sql, ...params) {
    const stmt = this.db.prepare(sql);
    return stmt.get(...params);
  }

  all(sql, ...params) {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params);
  }
}

// Export singleton instance
const databaseInstance = new Database();
module.exports = databaseInstance;
module.exports.Database = Database;
