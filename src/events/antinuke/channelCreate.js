const { AuditLogEvent } = require('discord.js');
const AuditLogResolver = require('../../antinuke/AuditLogResolver');
const SafetyChecker = require('../../antinuke/SafetyChecker');
const antinukeEngine = require('../../antinuke/AntinukeEngine');
const punishmentExecutor = require('../../antinuke/PunishmentExecutor');
const LogRouter = require('../../utils/LogRouter');
const EmbedGenerator = require('../../utils/embed');
const { ANTINUKE_CATEGORIES } = require('../../config/constants');

module.exports = {
  name: 'channelCreate',
  async execute(channel) {
    const { guild } = channel;
    if (!guild) return;

    const resolved = await AuditLogResolver.resolveExecutor(guild, AuditLogEvent.ChannelCreate, channel.id);
    const executor = resolved?.executor;

    if (executor) {
      const exemption = await SafetyChecker.checkExemption(guild, executor);
      if (!exemption.exempt) {
        const result = antinukeEngine.recordAction(guild.id, executor.id, ANTINUKE_CATEGORIES.CHANNEL_CREATE);
        if (result.triggered) {
          await punishmentExecutor.execute({
            guild,
            executor,
            category: ANTINUKE_CATEGORIES.CHANNEL_CREATE,
            threshold: result.limitCount,
            windowSeconds: result.timeWindowSeconds,
            punishment: result.punishment,
            target: `#${channel.name} (\`${channel.id}\`)`,
            details: `Exceeded channel creation limit (${result.limitCount} channels in ${result.timeWindowSeconds}s)`
          });
        }
      }
    }

    // Channel Actions Audit Logging
    const embed = EmbedGenerator.base()
      .setTitle('📁 Channel Created')
      .setColor(0x57F287)
      .addFields(
        { name: 'Channel', value: `${channel} (\`#${channel.name}\`)`, inline: true },
        { name: 'Created By', value: executor ? `${executor.tag} (\`${executor.id}\`)` : '*Unknown*', inline: true },
        { name: 'Category', value: channel.parent ? `${channel.parent.name}` : '*None*', inline: true }
      )
      .setTimestamp();

    await LogRouter.log(guild, 'channel', 'channel_create', embed);
  }
};
