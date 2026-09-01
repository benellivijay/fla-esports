const db = require('../db');

class MicGuardManager {
  getConfig(guildId) {
    let row = db.get('SELECT * FROM mic_guard_config WHERE guild_id = ?', guildId);
    if (!row) {
      this.initConfig(guildId);
      row = db.get('SELECT * FROM mic_guard_config WHERE guild_id = ?', guildId);
    }
    return row;
  }

  initConfig(guildId) {
    db.run(
      `INSERT OR IGNORE INTO mic_guard_config (guild_id, enabled, sensitivity, punishment, warn_dm, log_channel_id)
       VALUES (?, 1, 'standard', 'disconnect', 1, null)`,
      guildId
    );
  }

  setEnabled(guildId, enabled) {
    this.initConfig(guildId);
    return db.run('UPDATE mic_guard_config SET enabled = ? WHERE guild_id = ?', enabled ? 1 : 0, guildId);
  }

  setSensitivity(guildId, sensitivity) {
    this.initConfig(guildId);
    return db.run('UPDATE mic_guard_config SET sensitivity = ? WHERE guild_id = ?', sensitivity, guildId);
  }

  setPunishment(guildId, punishment) {
    this.initConfig(guildId);
    return db.run('UPDATE mic_guard_config SET punishment = ? WHERE guild_id = ?', punishment, guildId);
  }

  setLogChannel(guildId, channelId) {
    this.initConfig(guildId);
    return db.run('UPDATE mic_guard_config SET log_channel_id = ? WHERE guild_id = ?', channelId, guildId);
  }

  // Warning Management
  addWarning(guildId, userId) {
    const row = db.get('SELECT * FROM mic_guard_warnings WHERE guild_id = ? AND user_id = ?', guildId, userId);
    let count = 1;
    const now = Date.now();

    if (row) {
      // If last warning was within 2 hours, increment; otherwise reset to 1
      if (now - (row.last_warn_timestamp || 0) < 2 * 60 * 60 * 1000) {
        count = (row.warning_count || 0) + 1;
      } else {
        count = 1;
      }

      db.run(
        'UPDATE mic_guard_warnings SET warning_count = ?, last_warn_timestamp = ? WHERE guild_id = ? AND user_id = ?',
        count,
        now,
        guildId,
        userId
      );
    } else {
      db.run(
        'INSERT INTO mic_guard_warnings (guild_id, user_id, warning_count, last_warn_timestamp) VALUES (?, ?, ?, ?)',
        guildId,
        userId,
        1,
        now
      );
    }

    return count;
  }

  getWarnings(guildId, userId) {
    const row = db.get('SELECT * FROM mic_guard_warnings WHERE guild_id = ? AND user_id = ?', guildId, userId);
    if (!row) return 0;
    if (Date.now() - (row.last_warn_timestamp || 0) > 2 * 60 * 60 * 1000) {
      return 0;
    }
    return row.warning_count || 0;
  }

  resetWarnings(guildId, userId) {
    return db.run(
      'UPDATE mic_guard_warnings SET warning_count = 0, last_warn_timestamp = ? WHERE guild_id = ? AND user_id = ?',
      Date.now(),
      guildId,
      userId
    );
  }
}

module.exports = new MicGuardManager();
