const db = require('../db');

class FeatureManager {
  // Logging configuration
  getLoggingConfig(guildId) {
    let row = db.get('SELECT * FROM logging_config WHERE guild_id = ?', guildId);
    if (!row) {
      this.initLoggingConfig(guildId);
      row = db.get('SELECT * FROM logging_config WHERE guild_id = ?', guildId);
    }
    return {
      ...row,
      enabled_events: JSON.parse(row.enabled_events || '["joins","leaves","edits","deletes","purges","pins","automod","roles","channels","voice"]')
    };
  }

  initLoggingConfig(guildId) {
    db.run(
      `INSERT OR IGNORE INTO logging_config (guild_id, general_channel_id, antinuke_channel_id, enabled_events)
       VALUES (?, null, null, '["joins","leaves","edits","deletes","purges","pins","automod","roles","channels","voice"]')`,
      guildId
    );
  }

  setLoggingChannel(guildId, type, channelId) {
    this.initLoggingConfig(guildId);
    if (type === 'general') {
      db.run('UPDATE logging_config SET general_channel_id = ? WHERE guild_id = ?', channelId, guildId);
    } else if (type === 'antinuke') {
      db.run('UPDATE logging_config SET antinuke_channel_id = ? WHERE guild_id = ?', channelId, guildId);
    }
  }

  toggleLoggingEvent(guildId, eventName, enable) {
    const config = this.getLoggingConfig(guildId);
    let events = config.enabled_events;
    if (enable && !events.includes(eventName)) {
      events.push(eventName);
    } else if (!enable && events.includes(eventName)) {
      events = events.filter(e => e !== eventName);
    }
    db.run('UPDATE logging_config SET enabled_events = ? WHERE guild_id = ?', JSON.stringify(events), guildId);
  }

  // Vanity Roles
  getVanityConfig(guildId) {
    let row = db.get('SELECT * FROM vanity_roles WHERE guild_id = ?', guildId);
    return row || null;
  }

  setVanityConfig(guildId, roleId, vanityString, enabled = 1) {
    db.run(
      `INSERT INTO vanity_roles (guild_id, role_id, vanity_string, enabled)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(guild_id) DO UPDATE SET
         role_id = excluded.role_id,
         vanity_string = excluded.vanity_string,
         enabled = excluded.enabled`,
      guildId,
      roleId,
      vanityString,
      enabled ? 1 : 0
    );
  }

  removeVanityConfig(guildId) {
    db.run('DELETE FROM vanity_roles WHERE guild_id = ?', guildId);
  }

  // Welcomer
  getWelcomerConfig(guildId) {
    let row = db.get('SELECT * FROM welcomer_config WHERE guild_id = ?', guildId);
    if (!row) {
      this.initWelcomerConfig(guildId);
      row = db.get('SELECT * FROM welcomer_config WHERE guild_id = ?', guildId);
    }
    return {
      ...row,
      embed_data: row.embed_data ? JSON.parse(row.embed_data) : null
    };
  }

  initWelcomerConfig(guildId) {
    db.run(
      `INSERT OR IGNORE INTO welcomer_config (guild_id, channel_id, message, embed_data, auto_role_id, bot_auto_role_id, enabled)
       VALUES (?, null, 'Welcome {user} to **{server}**! We now have {membercount} members.', null, null, null, 0)`,
      guildId
    );
  }

  setWelcomerChannel(guildId, channelId) {
    this.initWelcomerConfig(guildId);
    db.run('UPDATE welcomer_config SET channel_id = ? WHERE guild_id = ?', channelId, guildId);
  }

  setWelcomerMessage(guildId, message) {
    this.initWelcomerConfig(guildId);
    db.run('UPDATE welcomer_config SET message = ? WHERE guild_id = ?', message, guildId);
  }

  setWelcomerEmbedData(guildId, embedData) {
    this.initWelcomerConfig(guildId);
    const jsonStr = embedData ? (typeof embedData === 'string' ? embedData : JSON.stringify(embedData)) : null;
    db.run('UPDATE welcomer_config SET embed_data = ? WHERE guild_id = ?', jsonStr, guildId);
  }

  setWelcomerAutoRole(guildId, roleId, isBot = false) {
    this.initWelcomerConfig(guildId);
    if (isBot) {
      db.run('UPDATE welcomer_config SET bot_auto_role_id = ? WHERE guild_id = ?', roleId, guildId);
    } else {
      db.run('UPDATE welcomer_config SET auto_role_id = ? WHERE guild_id = ?', roleId, guildId);
    }
  }

  setWelcomerEnabled(guildId, enabled) {
    this.initWelcomerConfig(guildId);
    db.run('UPDATE welcomer_config SET enabled = ? WHERE guild_id = ?', enabled ? 1 : 0, guildId);
  }

  // Reaction Roles
  getReactionRoles(guildId, messageId) {
    return db.all(
      'SELECT * FROM reaction_roles WHERE guild_id = ? AND message_id = ?',
      guildId,
      messageId
    );
  }

  addReactionRole(guildId, channelId, messageId, customId, roleId) {
    return db.run(
      'INSERT INTO reaction_roles (guild_id, channel_id, message_id, custom_id, role_id) VALUES (?, ?, ?, ?, ?)',
      guildId,
      channelId,
      messageId,
      customId,
      roleId
    );
  }

  removeReactionRole(guildId, messageId, customId) {
    return db.run(
      'DELETE FROM reaction_roles WHERE guild_id = ? AND message_id = ? AND custom_id = ?',
      guildId,
      messageId,
      customId
    );
  }
}

module.exports = new FeatureManager();
