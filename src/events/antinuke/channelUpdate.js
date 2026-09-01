const { AuditLogEvent } = require('discord.js');
const AuditLogResolver = require('../../antinuke/AuditLogResolver');
const SafetyChecker = require('../../antinuke/SafetyChecker');
const antinukeEngine = require('../../antinuke/AntinukeEngine');
const punishmentExecutor = require('../../antinuke/PunishmentExecutor');
const LogRouter = require('../../utils/LogRouter');
const EmbedGenerator = require('../../utils/embed');
const { ANTINUKE_CATEGORIES } = require('../../config/constants');

module.exports = {
  name: 'channelUpdate',
  async execute(oldChannel, newChannel) {
    const { guild } = newChannel;
    if (!guild) return;

    const resolved = await AuditLogResolver.resolveExecutor(guild, AuditLogEvent.ChannelUpdate, newChannel.id);
    const executor = resolved?.executor;

    if (executor) {
      const exemption = await SafetyChecker.checkExemption(guild, executor);
      if (!exemption.exempt) {
        const result = antinukeEngine.recordAction(guild.id, executor.id, ANTINUKE_CATEGORIES.CHANNEL_UPDATE);
        if (result.triggered) {
          await punishmentExecutor.execute({
            guild,
            executor,
            category: ANTINUKE_CATEGORIES.CHANNEL_UPDATE,
            threshold: result.limitCount,
            windowSeconds: result.timeWindowSeconds,
            punishment: result.punishment,
            target: `#${newChannel.name} (\`${newChannel.id}\`)`,
            details: `Exceeded channel update limit (${result.limitCount} channel edits in ${result.timeWindowSeconds}s)`
          });
          return;
        }
      }
    }

    // Check if any visible attribute changed
    const changes = [];

    if (oldChannel.name !== newChannel.name) {
      changes.push(`**Name:** \`#${oldChannel.name}\` ➔ \`#${newChannel.name}\``);
    }
    if (oldChannel.topic !== newChannel.topic) {
      changes.push(`**Topic:** \`${oldChannel.topic || 'None'}\` ➔ \`${newChannel.topic || 'None'}\``);
    }
    if (oldChannel.parentId !== newChannel.parentId) {
      const oldParent = oldChannel.parent ? oldChannel.parent.name : 'None';
      const newParent = newChannel.parent ? newChannel.parent.name : 'None';
      changes.push(`**Category:** \`${oldParent}\` ➔ \`${newParent}\``);
    }
    if (oldChannel.nsfw !== newChannel.nsfw) {
      changes.push(`**Age-Restricted (NSFW):** ${newChannel.nsfw ? 'Enabled 🔞' : 'Disabled 🟢'}`);
    }
    if (oldChannel.rateLimitPerUser !== newChannel.rateLimitPerUser) {
      changes.push(`**Slowmode:** \`${oldChannel.rateLimitPerUser || 0}s\` ➔ \`${newChannel.rateLimitPerUser || 0}s\``);
    }

    // Channel Actions Audit Logging
    const embed = EmbedGenerator.base()
      .setTitle('📁 Channel Modified')
      .setColor(0xFEE75C)
      .addFields(
        { name: 'Channel', value: `${newChannel} (\`#${newChannel.name}\`)`, inline: true },
        { name: 'Updated By', value: executor ? `${executor.tag} (\`${executor.id}\`)` : '*Unknown*', inline: true }
      );

    if (changes.length > 0) {
      embed.addFields({ name: 'Changes', value: changes.join('\n') });
    } else {
      embed.addFields({ name: 'Details', value: '*Permissions or settings modified*' });
    }

    embed.setTimestamp();

    await LogRouter.log(guild, 'channel', 'channel_update', embed);
  }
};
