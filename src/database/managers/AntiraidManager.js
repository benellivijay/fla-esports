const db = require('../db');

const PRESETS = {
  high: {
    name: 'High Security',
    score_limit: 15,
    window_seconds: 60,
    min_account_age_days: 7,
    age_score: 5,
    no_avatar_score: 4,
    rapid_join_score: 4,
    base_score: 2,
    punishment: 'ban'
  },
  standard: {
    name: 'Standard (Recommended)',
    score_limit: 25,
    window_seconds: 60,
    min_account_age_days: 3,
    age_score: 3,
    no_avatar_score: 3,
    rapid_join_score: 3,
    base_score: 1,
    punishment: 'kick'
  },
  lenient: {
    name: 'Lenient',
    score_limit: 45,
    window_seconds: 60,
    min_account_age_days: 1,
    age_score: 2,
    no_avatar_score: 2,
    rapid_join_score: 2,
    base_score: 1,
    punishment: 'timeout'
  }
};

class AntiraidManager {
  /**
   * Get Anti-Raid configuration for a guild
   */
  getConfig(guildId) {
    let row = db.get('SELECT * FROM anti_raid_config WHERE guild_id = ?', guildId);
    if (!row) {
      this.initConfig(guildId);
      row = db.get('SELECT * FROM anti_raid_config WHERE guild_id = ?', guildId);
    }

    return {
      guild_id: row.guild_id,
      enabled: row.enabled !== undefined && row.enabled !== null ? Boolean(row.enabled) : true,
      score_limit: row.score_limit || 25,
      window_seconds: row.window_seconds || 60,
      punishment: row.punishment || 'kick',
      timeout_duration_minutes: row.timeout_duration_minutes || 60,
      min_account_age_days: row.min_account_age_days || 3,
      age_score: row.age_score !== undefined ? row.age_score : 3,
      no_avatar_score: row.no_avatar_score !== undefined ? row.no_avatar_score : 3,
      rapid_join_score: row.rapid_join_score !== undefined ? row.rapid_join_score : 3,
      base_score: row.base_score !== undefined ? row.base_score : 1,
      badge_bypass_enabled: row.badge_bypass_enabled !== undefined ? Boolean(row.badge_bypass_enabled) : true,
      auto_lockdown_enabled: row.auto_lockdown_enabled !== undefined ? Boolean(row.auto_lockdown_enabled) : true,
      active_preset: row.active_preset || 'standard',
      lockdown_active: Boolean(row.lockdown_active),
      last_raid_timestamp: row.last_raid_timestamp || null
    };
  }

  /**
   * Initialize default Anti-Raid configuration
   */
  initConfig(guildId) {
    const std = PRESETS.standard;
    db.run(
      `INSERT OR IGNORE INTO anti_raid_config (
        guild_id, enabled, score_limit, window_seconds, punishment,
        timeout_duration_minutes, min_account_age_days, age_score,
        no_avatar_score, rapid_join_score, base_score, badge_bypass_enabled,
        auto_lockdown_enabled, active_preset, lockdown_active
      ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      guildId,
      std.score_limit,
      std.window_seconds,
      std.punishment,
      60,
      std.min_account_age_days,
      std.age_score,
      std.no_avatar_score,
      std.rapid_join_score,
      std.base_score,
      1,
      1,
      'standard'
    );
  }

  /**
   * Enable/disable Anti-Raid
   */
  setEnabled(guildId, enabled) {
    this.initConfig(guildId);
    db.run('UPDATE anti_raid_config SET enabled = ? WHERE guild_id = ?', enabled ? 1 : 0, guildId);
  }

  /**
   * Apply a security preset (high, standard, lenient)
   */
  applyPreset(guildId, presetKey) {
    const preset = PRESETS[presetKey.toLowerCase()];
    if (!preset) return false;

    this.initConfig(guildId);
    db.run(
      `UPDATE anti_raid_config SET
        score_limit = ?,
        window_seconds = ?,
        min_account_age_days = ?,
        age_score = ?,
        no_avatar_score = ?,
        rapid_join_score = ?,
        base_score = ?,
        punishment = ?,
        active_preset = ?
      WHERE guild_id = ?`,
      preset.score_limit,
      preset.window_seconds,
      preset.min_account_age_days,
      preset.age_score,
      preset.no_avatar_score,
      preset.rapid_join_score,
      preset.base_score,
      preset.punishment,
      presetKey.toLowerCase(),
      guildId
    );
    return true;
  }

  /**
   * Set custom score limit
   */
  setScoreLimit(guildId, scoreLimit) {
    this.initConfig(guildId);
    db.run('UPDATE anti_raid_config SET score_limit = ?, active_preset = "custom" WHERE guild_id = ?', scoreLimit, guildId);
  }

  /**
   * Set punishment type ('ban' | 'kick' | 'timeout')
   */
  setPunishment(guildId, punishment) {
    this.initConfig(guildId);
    db.run('UPDATE anti_raid_config SET punishment = ? WHERE guild_id = ?', punishment.toLowerCase(), guildId);
  }

  /**
   * Set lockdown state
   */
  setLockdownState(guildId, isActive, raidTimestamp = Date.now()) {
    this.initConfig(guildId);
    db.run(
      'UPDATE anti_raid_config SET lockdown_active = ?, last_raid_timestamp = ? WHERE guild_id = ?',
      isActive ? 1 : 0,
      isActive ? raidTimestamp : null,
      guildId
    );
  }

  /**
   * Reset configuration
   */
  resetConfig(guildId) {
    const std = PRESETS.standard;
    db.run(
      `UPDATE anti_raid_config SET
        enabled = 1,
        score_limit = ?,
        window_seconds = ?,
        punishment = ?,
        timeout_duration_minutes = 60,
        min_account_age_days = ?,
        age_score = ?,
        no_avatar_score = ?,
        rapid_join_score = ?,
        base_score = ?,
        badge_bypass_enabled = 1,
        auto_lockdown_enabled = 1,
        active_preset = "standard",
        lockdown_active = 0,
        last_raid_timestamp = null
      WHERE guild_id = ?`,
      std.score_limit,
      std.window_seconds,
      std.punishment,
      std.min_account_age_days,
      std.age_score,
      std.no_avatar_score,
      std.rapid_join_score,
      std.base_score,
      guildId
    );
  }
}

module.exports = new AntiraidManager();
module.exports.PRESETS = PRESETS;
