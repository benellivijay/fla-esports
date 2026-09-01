const loggingManager = require('../database/managers/LoggingManager');
const Logger = require('./logger');

class LogRouter {
  /**
   * Check if event or category is enabled
   */
  static isEventEnabled(config, category, eventName) {
    if (!config || !config.enabled) return false;

    // If no specific enabled_events array or empty, default to enabled
    if (!config.enabled_events || !Array.isArray(config.enabled_events) || config.enabled_events.length === 0) {
      return true;
    }

    // Direct match
    if (eventName && config.enabled_events.includes(eventName)) return true;

    // Category match & legacy aliases
    if (category) {
      const cat = category.toLowerCase();
      if (config.enabled_events.includes(cat) || config.enabled_events.includes(`${cat}s`)) return true;

      const categoryMap = {
        member: ['joins', 'leaves', 'member_update'],
        message: ['edits', 'deletes', 'purges', 'pins', 'thread_update'],
        voice: ['voice', 'voice_join', 'voice_leave', 'voice_mute', 'voice_stream'],
        server: ['server_update', 'emoji_update', 'sticker_update', 'invite_update', 'boost'],
        channel: ['channels', 'channel_create', 'channel_delete', 'channel_update'],
        role: ['roles', 'role_create', 'role_delete', 'role_update'],
        mod: ['automod', 'ban_add', 'ban_remove', 'mod']
      };

      const aliases = categoryMap[cat] || [];
      for (const a of aliases) {
        if (config.enabled_events.includes(a)) return true;
      }
    }

    return true; // Default fallback to active when category channel exists
  }

  /**
   * Routes a structured log embed to the configured channel
   * @param {import('discord.js').Guild} guild
   * @param {string} category 'member' | 'message' | 'voice' | 'server' | 'channel' | 'role' | 'mod'
   * @param {string} eventName specific event key in enabled_events
   * @param {import('discord.js').EmbedBuilder} embed
   */
  static async log(guild, category, eventName, embed) {
    if (!guild) return;

    try {
      const config = loggingManager.getConfig(guild.id);
      if (!config || !config.enabled) return;

      if (!this.isEventEnabled(config, category, eventName)) {
        return;
      }

      let channelId = null;
      switch (category?.toLowerCase()) {
        case 'member':
          channelId = config.member_channel_id || config.general_channel_id;
          break;
        case 'message':
          channelId = config.message_channel_id || config.general_channel_id;
          break;
        case 'voice':
          channelId = config.voice_channel_id || config.general_channel_id;
          break;
        case 'server':
          channelId = config.server_channel_id || config.general_channel_id;
          break;
        case 'channel':
          channelId = config.channel_channel_id || config.general_channel_id;
          break;
        case 'role':
          channelId = config.role_channel_id || config.general_channel_id;
          break;
        case 'mod':
          channelId = config.mod_channel_id || config.antinuke_channel_id || config.general_channel_id;
          break;
        default:
          channelId = config.general_channel_id;
      }

      if (!channelId) return;

      const channel = guild.channels.cache.get(channelId);
      if (channel && channel.isTextBased()) {
        await channel.send({ embeds: [embed] }).catch(err => {
          Logger.warn(`Failed to send log to channel #${channel.name}: ${err.message}`);
        });
      }
    } catch (err) {
      Logger.error(`Error in LogRouter: ${err.message}`);
    }
  }
}

module.exports = LogRouter;
