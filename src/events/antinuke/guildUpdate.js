const { AuditLogEvent } = require('discord.js');
const AuditLogResolver = require('../../antinuke/AuditLogResolver');
const SafetyChecker = require('../../antinuke/SafetyChecker');
const antinukeEngine = require('../../antinuke/AntinukeEngine');
const punishmentExecutor = require('../../antinuke/PunishmentExecutor');
const LogRouter = require('../../utils/LogRouter');
const EmbedGenerator = require('../../utils/embed');
const { ANTINUKE_CATEGORIES } = require('../../config/constants');

module.exports = {
  name: 'guildUpdate',
  async execute(oldGuild, newGuild) {
    const resolved = await AuditLogResolver.resolveExecutor(newGuild, AuditLogEvent.GuildUpdate);
    const executor = resolved?.executor;

    if (executor) {
      const exemption = await SafetyChecker.checkExemption(newGuild, executor);
      if (!exemption.exempt) {
        // Check if Vanity URL was changed
        if (oldGuild.vanityURLCode !== newGuild.vanityURLCode) {
          const result = antinukeEngine.recordAction(newGuild.id, executor.id, ANTINUKE_CATEGORIES.VANITY_CHANGE);
          if (result.triggered) {
            await punishmentExecutor.execute({
              guild: newGuild,
              executor,
              category: ANTINUKE_CATEGORIES.VANITY_CHANGE,
              threshold: result.limitCount,
              windowSeconds: result.timeWindowSeconds,
              punishment: result.punishment,
              target: `Vanity URL (${oldGuild.vanityURLCode} -> ${newGuild.vanityURLCode})`,
              details: 'Unauthorized Vanity URL modification intercepted'
            });
            return;
          }
        }

        // General Server Update limit check
        const result = antinukeEngine.recordAction(newGuild.id, executor.id, ANTINUKE_CATEGORIES.SERVER_UPDATE);
        if (result.triggered) {
          await punishmentExecutor.execute({
            guild: newGuild,
            executor,
            category: ANTINUKE_CATEGORIES.SERVER_UPDATE,
            threshold: result.limitCount,
            windowSeconds: result.timeWindowSeconds,
            punishment: result.punishment,
            target: newGuild.name,
            details: `Exceeded server update limit (${result.limitCount} server modifications in ${result.timeWindowSeconds}s)`
          });
          return;
        }
      }
    }

    // Server Actions Audit Logging
    const embed = EmbedGenerator.base()
      .setTitle('🌐 Server Settings Updated')
      .setColor(0x5865F2)
      .setThumbnail(newGuild.iconURL({ dynamic: true }))
      .addFields(
        { name: 'Updated By', value: executor ? `${executor.tag} (\`${executor.id}\`)` : '*Unknown*', inline: true }
      );

    if (oldGuild.name !== newGuild.name) {
      embed.addFields({ name: 'Server Name', value: `\`${oldGuild.name}\` ➔ \`${newGuild.name}\`` });
    }
    if (oldGuild.icon !== newGuild.icon) {
      embed.addFields({ name: 'Server Icon', value: '*Server icon changed*', inline: true });
    }
    if (oldGuild.banner !== newGuild.banner) {
      embed.addFields({ name: 'Server Banner', value: '*Server banner changed*', inline: true });
    }
    if (oldGuild.verificationLevel !== newGuild.verificationLevel) {
      embed.addFields({ name: 'Verification Level', value: `Level: ${newGuild.verificationLevel}`, inline: true });
    }
    embed.setTimestamp();

    await LogRouter.log(newGuild, 'server', 'server_update', embed);
  }
};
