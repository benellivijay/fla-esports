const vcStatManager = require('../database/managers/VcStatManager');
const Logger = require('./logger');

class VcStatUpdater {
  constructor() {
    this.client = null;
    this.interval = null;
    this.lastStatuses = new Map(); // channelId -> status string
  }

  start(client) {
    this.client = client;
    // Update immediately on start then every 2 minutes
    this.updateAll();
    if (this.interval) clearInterval(this.interval);
    this.interval = setInterval(() => this.updateAll(), 2 * 60 * 1000);
    Logger.info('[VC STATS] Voice Channel Status auto-updater active (updates every 2 minutes)');
  }

  buildStatus(template, guild) {
    const totalusers = guild.memberCount || 0;

    // Online members (online, idle, dnd)
    const onlineusers = guild.members.cache.filter(
      m => m.presence?.status && m.presence.status !== 'offline'
    ).size;

    // Voice channels with at least 1 member
    const activevc = guild.channels.cache.filter(
      c => c.isVoiceBased?.() && c.members?.size > 0
    ).size;

    // All users across all voice channels
    const vcusers = guild.channels.cache
      .filter(c => c.isVoiceBased?.())
      .reduce((sum, c) => sum + (c.members?.size || 0), 0);

    return template
      .replace(/\{totalusers\}/gi, totalusers)
      .replace(/\{onlineusers\}/gi, onlineusers)
      .replace(/\{activevc\}/gi, activevc)
      .replace(/\{vcusers\}/gi, vcusers);
  }

  async setChannelStatus(channelId, status) {
    if (!this.client) return;
    try {
      await this.client.rest.put(`/channels/${channelId}/voice-status`, {
        body: { status: status || '' }
      });
      this.lastStatuses.set(channelId, status);
      return true;
    } catch (e) {
      Logger.warn(`[VC STATS] Failed to set voice status for channel ${channelId}: ${e.message}`);
      return false;
    }
  }

  async clearStatus(channelId) {
    return this.setChannelStatus(channelId, '');
  }

  async updateSingle(guildId, channelId) {
    if (!this.client) return;
    const trackers = vcStatManager.getAll(guildId);
    const tracker = trackers.find(t => t.channel_id === channelId);
    if (!tracker) return;

    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) return;

    const newStatus = this.buildStatus(tracker.template, guild);
    await this.setChannelStatus(channelId, newStatus);
    Logger.info(`[VC STATS] Updated status of VC <#${channelId}> to: "${newStatus}" in "${guild.name}"`);
  }

  async updateAll() {
    if (!this.client) return;
    const trackers = vcStatManager.getAllTrackers();

    for (const tracker of trackers) {
      try {
        const guild = this.client.guilds.cache.get(tracker.guild_id);
        if (!guild) continue;

        const channel = guild.channels.cache.get(tracker.channel_id);
        if (!channel) {
          // Channel was deleted — auto-remove tracker
          vcStatManager.remove(tracker.guild_id, tracker.channel_id);
          Logger.warn(`[VC STATS] Voice channel ${tracker.channel_id} not found — tracker removed`);
          continue;
        }

        const newStatus = this.buildStatus(tracker.template, guild);
        const prevStatus = this.lastStatuses.get(tracker.channel_id);

        if (prevStatus !== newStatus) {
          await this.setChannelStatus(tracker.channel_id, newStatus);
          Logger.info(`[VC STATS] "${guild.name}" → VC ${channel.name} status updated to: "${newStatus}"`);
        }
      } catch (e) {
        Logger.warn(`[VC STATS] Failed to update status for channel ${tracker.channel_id}: ${e.message}`);
      }
    }
  }
}

module.exports = new VcStatUpdater();
