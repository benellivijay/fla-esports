const db = require('../db');
const { DEFAULT_LIMITS, PUNISHMENTS } = require('../../config/constants');

class AntinukeManager {
  getConfig(guildId) {
    let row = db.get('SELECT * FROM antinuke_config WHERE guild_id = ?', guildId);
    if (!row) {
      this.initConfig(guildId);
      row = db.get('SELECT * FROM antinuke_config WHERE guild_id = ?', guildId);
    }
    return row;
  }

  initConfig(guildId) {
    db.run(
      'INSERT OR IGNORE INTO antinuke_config (guild_id, enabled, log_channel_id, created_at) VALUES (?, ?, ?, ?)',
      guildId,
      1,
      null,
      Date.now()
    );

    // Populate default limits if not existing
    for (const [category, data] of Object.entries(DEFAULT_LIMITS)) {
      db.run(
        'INSERT OR IGNORE INTO antinuke_limits (guild_id, category, limit_count, time_window_seconds, punishment) VALUES (?, ?, ?, ?, ?)',
        guildId,
        category,
        data.limit,
        data.window,
        data.punishment
      );
    }
  }

  setEnabled(guildId, enabled) {
    this.initConfig(guildId);
    db.run('UPDATE antinuke_config SET enabled = ? WHERE guild_id = ?', enabled ? 1 : 0, guildId);
  }

  setLogChannel(guildId, channelId) {
    this.initConfig(guildId);
    db.run('UPDATE antinuke_config SET log_channel_id = ? WHERE guild_id = ?', channelId, guildId);
  }

  getLimits(guildId) {
    this.initConfig(guildId);
    return db.all('SELECT * FROM antinuke_limits WHERE guild_id = ?', guildId);
  }

  getLimit(guildId, category) {
    this.initConfig(guildId);
    let row = db.get('SELECT * FROM antinuke_limits WHERE guild_id = ? AND category = ?', guildId, category);
    if (!row && DEFAULT_LIMITS[category]) {
      const def = DEFAULT_LIMITS[category];
      db.run(
        'INSERT INTO antinuke_limits (guild_id, category, limit_count, time_window_seconds, punishment) VALUES (?, ?, ?, ?, ?)',
        guildId,
        category,
        def.limit,
        def.window,
        def.punishment
      );
      row = db.get('SELECT * FROM antinuke_limits WHERE guild_id = ? AND category = ?', guildId, category);
    }
    return row;
  }

  setLimit(guildId, category, limitCount, timeWindowSeconds, punishment = PUNISHMENTS.BAN) {
    this.initConfig(guildId);
    db.run(
      `INSERT INTO antinuke_limits (guild_id, category, limit_count, time_window_seconds, punishment)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(guild_id, category) DO UPDATE SET
         limit_count = excluded.limit_count,
         time_window_seconds = excluded.time_window_seconds,
         punishment = excluded.punishment`,
      guildId,
      category,
      limitCount,
      timeWindowSeconds,
      punishment
    );
  }

  setPunishment(guildId, category, punishment) {
    this.initConfig(guildId);
    db.run(
      'UPDATE antinuke_limits SET punishment = ? WHERE guild_id = ? AND category = ?',
      punishment,
      guildId,
      category
    );
  }

  // Whitelist Management
  getWhitelist(guildId) {
    return db.all('SELECT * FROM antinuke_whitelist WHERE guild_id = ?', guildId);
  }

  isWhitelisted(guildId, userId) {
    const row = db.get('SELECT user_id FROM antinuke_whitelist WHERE guild_id = ? AND user_id = ?', guildId, userId);
    return !!row;
  }

  addWhitelist(guildId, userId, addedBy) {
    db.run(
      'INSERT OR IGNORE INTO antinuke_whitelist (guild_id, user_id, added_by, created_at) VALUES (?, ?, ?, ?)',
      guildId,
      userId,
      addedBy,
      Date.now()
    );
  }

  removeWhitelist(guildId, userId) {
    db.run('DELETE FROM antinuke_whitelist WHERE guild_id = ? AND user_id = ?', guildId, userId);
  }

  // Extra Owners Management (delegate antinuke configuration)
  getExtraOwners(guildId) {
    return db.all('SELECT * FROM antinuke_extra_owners WHERE guild_id = ?', guildId);
  }

  isExtraOwner(guildId, userId) {
    const row = db.get('SELECT user_id FROM antinuke_extra_owners WHERE guild_id = ? AND user_id = ?', guildId, userId);
    return !!row;
  }

  addExtraOwner(guildId, userId, addedBy) {
    db.run(
      'INSERT OR IGNORE INTO antinuke_extra_owners (guild_id, user_id, added_by, created_at) VALUES (?, ?, ?, ?)',
      guildId,
      userId,
      addedBy,
      Date.now()
    );
  }

  removeExtraOwner(guildId, userId) {
    db.run('DELETE FROM antinuke_extra_owners WHERE guild_id = ? AND user_id = ?', guildId, userId);
  }
}

module.exports = new AntinukeManager();
