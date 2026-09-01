const SafetyChecker = require('./SafetyChecker');
const antinukeManager = require('../database/managers/AntinukeManager');
const featureManager = require('../database/managers/FeatureManager');
const EmbedGenerator = require('../utils/embed');
const Logger = require('../utils/logger');
const { PUNISHMENTS } = require('../config/constants');

class PunishmentExecutor {
  /**
   * Execute punishment on a rogue executor and notify security log channel
   */
  static async execute({ guild, executor, category, threshold, windowSeconds, punishment, target, details }) {
    if (!guild || !executor) return;

    Logger.security(`[ALERT] Executing punishment for user ${executor.tag || executor.id} in guild ${guild.name} (${guild.id}) - Category: ${category}`);

    // Pre-execution safety check
    const safety = await SafetyChecker.canPunishExecutor(guild, executor.id);
    if (!safety.canPunish) {
      Logger.warn(`[SAFETY BLOCKED] Cannot punish ${executor.tag || executor.id}: ${safety.reason}`);
      this.sendLog(guild, {
        executor,
        action: 'FAILED_SAFETY_CHECK',
        category,
        threshold,
        windowSeconds,
        punishment: 'None (Safety Blocked)',
        target,
        details: `Safety check blocked punishment: ${safety.reason}`
      });
      return;
    }

    const reason = `Mia Antinuke: Triggered [${category}] limit (${threshold} actions in ${windowSeconds}s)`;
    const member = safety.member;

    try {
      switch (punishment) {
        case PUNISHMENTS.BAN:
          await guild.members.ban(executor.id, { reason, deleteMessageSeconds: 60 * 60 * 24 });
          break;

        case PUNISHMENTS.KICK:
          if (member) {
            await member.kick(reason);
          } else {
            await guild.members.ban(executor.id, { reason });
          }
          break;

        case PUNISHMENTS.STRIP_ROLES:
          if (member) {
            const manageableRoles = member.roles.cache.filter(r => r.id !== guild.id && r.editable);
            if (manageableRoles.size > 0) {
              await member.roles.remove(manageableRoles, reason);
            }
          }
          break;

        case PUNISHMENTS.QUARANTINE:
          if (member && member.moderatable) {
            await member.timeout(28 * 24 * 60 * 60 * 1000, reason);
          } else {
            await guild.members.ban(executor.id, { reason });
          }
          break;

        default:
          await guild.members.ban(executor.id, { reason });
          break;
      }

      Logger.success(`[PUNISHED] Successfully applied ${punishment} on ${executor.tag || executor.id}`);
    } catch (error) {
      Logger.error(`[PUNISH FAILED] Error executing ${punishment} on ${executor.tag || executor.id}: ${error.message}`);
    }

    // Dispatch Security Log
    this.sendLog(guild, {
      executor,
      action: 'PUNISHED',
      category,
      threshold,
      windowSeconds,
      punishment,
      target,
      details
    });
  }

  /**
   * Send notification to antinuke security channel
   */
  static async sendLog(guild, alertData) {
    try {
      const antinukeConfig = antinukeManager.getConfig(guild.id);
      const loggingConfig = featureManager.getLoggingConfig(guild.id);

      const targetChannelId = antinukeConfig?.log_channel_id || loggingConfig?.antinuke_channel_id || loggingConfig?.general_channel_id;
      if (!targetChannelId) return;

      const channel = guild.channels.cache.get(targetChannelId) || (await guild.channels.fetch(targetChannelId).catch(() => null));
      if (!channel || !channel.isTextBased()) return;

      const embed = EmbedGenerator.securityAlert(alertData);
      await channel.send({ embeds: [embed] }).catch(() => null);
    } catch (err) {
      Logger.error(`Failed to send antinuke log: ${err.message}`);
    }
  }
}

module.exports = PunishmentExecutor;
