const { AuditLogEvent } = require('discord.js');
const AuditLogResolver = require('../../antinuke/AuditLogResolver');
const SafetyChecker = require('../../antinuke/SafetyChecker');
const antinukeEngine = require('../../antinuke/AntinukeEngine');
const punishmentExecutor = require('../../antinuke/PunishmentExecutor');
const LogRouter = require('../../utils/LogRouter');
const EmbedGenerator = require('../../utils/embed');
const { ANTINUKE_CATEGORIES } = require('../../config/constants');

module.exports = {
  name: 'guildBanRemove',
  async execute(ban) {
    const { guild, user: unbannedUser } = ban;
    const resolved = await AuditLogResolver.resolveExecutor(guild, AuditLogEvent.MemberBanRemove, unbannedUser.id);
    const executor = resolved?.executor;

    if (executor) {
      const exemption = await SafetyChecker.checkExemption(guild, executor);
      if (!exemption.exempt) {
        const result = antinukeEngine.recordAction(guild.id, executor.id, ANTINUKE_CATEGORIES.UNBAN);
        if (result.triggered) {
          await punishmentExecutor.execute({
            guild,
            executor,
            category: ANTINUKE_CATEGORIES.UNBAN,
            threshold: result.limitCount,
            windowSeconds: result.timeWindowSeconds,
            punishment: result.punishment,
            target: `${unbannedUser.tag} (\`${unbannedUser.id}\`)`,
            details: `Exceeded unban limit (${result.limitCount} unbans in ${result.timeWindowSeconds}s)`
          });
          return;
        }
      }
    }

    // Mod Logs: Ban Remove (Unban)
    const embed = EmbedGenerator.base()
      .setTitle('🔓 Member Unbanned')
      .setColor(0x57F287)
      .addFields(
        { name: 'Unbanned User', value: `${unbannedUser.tag} (\`${unbannedUser.id}\`)`, inline: true },
        { name: 'Moderator', value: executor ? `${executor.tag} (\`${executor.id}\`)` : '*Unknown*', inline: true }
      )
      .setTimestamp();

    await LogRouter.log(guild, 'mod', 'ban_remove', embed);
  }
};
