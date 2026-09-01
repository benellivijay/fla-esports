const db = require('../db');

const DEFAULT_EVENTS = [
  'joins',
  'leaves',
  'member_update',
  'edits',
  'deletes',
  'purges',
  'pins',
  'voice_join',
  'voice_leave',
  'voice_move',
  'voice_mute',
  'voice_stream',
  'server_update',
  'emoji_update',
  'sticker_update',
  'invite_update',
  'channel_create',
  'channel_delete',
  'channel_update',
  'role_create',
  'role_delete',
  'role_update',
  'ban_add',
  'ban_remove',
  'automod'
];

class LoggingManager {
  /**
   * Get logging config for guild
   */
  getConfig(guildId) {
    let row = db.get('SELECT * FROM logging_config WHERE guild_id = ?', guildId);
    if (!row) {
      this.initConfig(guildId);
      row = db.get('SELECT * FROM logging_config WHERE guild_id = ?', guildId);
    }

    let enabledEvents = DEFAULT_EVENTS;
    try {
      if (row.enabled_events) {
        enabledEvents = JSON.parse(row.enabled_events);
      }
    } catch {}

    return {
      guild_id: row.guild_id,
      enabled: row.enabled !== undefined && row.enabled !== null ? Boolean(row.enabled) : true,
      category_id: row.category_id || null,
      member_channel_id: row.member_channel_id || null,
      message_channel_id: row.message_channel_id || null,
      voice_channel_id: row.voice_channel_id || null,
      server_channel_id: row.server_channel_id || null,
      channel_channel_id: row.channel_channel_id || null,
      role_channel_id: row.role_channel_id || null,
      mod_channel_id: row.mod_channel_id || null,
      general_channel_id: row.general_channel_id || null,
      antinuke_channel_id: row.antinuke_channel_id || null,
      enabled_events: enabledEvents
    };
  }

  /**
   * Initialize logging config
   */
  initConfig(guildId) {
    db.run(
      `INSERT OR IGNORE INTO logging_config (
        guild_id, enabled, enabled_events
      ) VALUES (?, 1, ?)`,
      guildId,
      JSON.stringify(DEFAULT_EVENTS)
    );
  }

  /**
   * Enable/disable logging module
   */
  setEnabled(guildId, enabled) {
    this.initConfig(guildId);
    db.run('UPDATE logging_config SET enabled = ? WHERE guild_id = ?', enabled ? 1 : 0, guildId);
  }

  /**
   * Set category channel
   */
  setChannel(guildId, categoryType, channelId) {
    this.initConfig(guildId);
    const validColumns = {
      member: 'member_channel_id',
      message: 'message_channel_id',
      voice: 'voice_channel_id',
      server: 'server_channel_id',
      channel: 'channel_channel_id',
      role: 'role_channel_id',
      mod: 'mod_channel_id',
      general: 'general_channel_id',
      antinuke: 'antinuke_channel_id'
    };

    const col = validColumns[categoryType.toLowerCase()];
    if (col) {
      db.run(`UPDATE logging_config SET ${col} = ? WHERE guild_id = ?`, channelId, guildId);
      return true;
    }
    return false;
  }

  /**
   * Save complete auto setup mapping
   */
  saveAutoSetup(guildId, {
    categoryId,
    memberChannelId,
    messageChannelId,
    voiceChannelId,
    serverChannelId,
    channelChannelId,
    roleChannelId,
    modChannelId
  }) {
    this.initConfig(guildId);
    db.run(
      `UPDATE logging_config SET
        enabled = 1,
        category_id = ?,
        member_channel_id = ?,
        message_channel_id = ?,
        voice_channel_id = ?,
        server_channel_id = ?,
        channel_channel_id = ?,
        role_channel_id = ?,
        mod_channel_id = ?,
        enabled_events = ?
      WHERE guild_id = ?`,
      categoryId,
      memberChannelId,
      messageChannelId,
      voiceChannelId,
      serverChannelId,
      channelChannelId,
      roleChannelId,
      modChannelId,
      JSON.stringify(DEFAULT_EVENTS),
      guildId
    );
  }

  /**
   * Reset logging configuration
   */
  resetConfig(guildId) {
    db.run(
      `UPDATE logging_config SET
        enabled = 0,
        category_id = null,
        member_channel_id = null,
        message_channel_id = null,
        voice_channel_id = null,
        server_channel_id = null,
        channel_channel_id = null,
        role_channel_id = null,
        mod_channel_id = null,
        general_channel_id = null,
        antinuke_channel_id = null,
        enabled_events = ?
      WHERE guild_id = ?`,
      JSON.stringify(DEFAULT_EVENTS),
      guildId
    );
  }

  /**
   * Toggle event
   */
  toggleEvent(guildId, eventName, enabled) {
    const config = this.getConfig(guildId);
    let events = config.enabled_events;
    if (enabled && !events.includes(eventName)) {
      events.push(eventName);
    } else if (!enabled && events.includes(eventName)) {
      events = events.filter(e => e !== eventName);
    }
    db.run('UPDATE logging_config SET enabled_events = ? WHERE guild_id = ?', JSON.stringify(events), guildId);
  }
}

module.exports = new LoggingManager();
