const { AuditLogEvent } = require('discord.js');
const AuditLogResolver = require('../../antinuke/AuditLogResolver');
const SafetyChecker = require('../../antinuke/SafetyChecker');
const antinukeEngine = require('../../antinuke/AntinukeEngine');
const punishmentExecutor = require('../../antinuke/PunishmentExecutor');
const LogRouter = require('../../utils/LogRouter');
const EmbedGenerator = require('../../utils/embed');
const { ANTINUKE_CATEGORIES } = require('../../config/constants');
const Logger = require('../../utils/logger');

module.exports = {
  name: 'guildBanAdd',
  async execute(ban) {
    const { guild, user: bannedUser } = ban;
    const resolved = await AuditLogResolver.resolveExecutor(guild, AuditLogEvent.MemberBanAdd, bannedUser.id);
    const executor = resolved?.executor;

    if (executor) {
      const exemption = await SafetyChecker.checkExemption(guild, executor);
      if (!exemption.exempt) {
        const result = antinukeEngine.recordAction(guild.id, executor.id, ANTINUKE_CATEGORIES.BAN);
        if (result.triggered) {
          await punishmentExecutor.execute({
            guild,
            executor,
            category: ANTINUKE_CATEGORIES.BAN,
            threshold: result.limitCount,
            windowSeconds: result.timeWindowSeconds,
            punishment: result.punishment,
            target: `${bannedUser.tag} (\`${bannedUser.id}\`)`,
            details: `Exceeded ban limit (${result.limitCount} bans within ${result.timeWindowSeconds}s)`
          });
          return;
        }
      }
    }

    // Mod Logs: Ban Add
    const embed = EmbedGenerator.base()
      .setTitle('🔨 Member Banned')
      .setColor(0xED4245)
      .addFields(
        { name: 'Banned User', value: `${bannedUser.tag} (\`${bannedUser.id}\`)`, inline: true },
        { name: 'Moderator', value: executor ? `${executor.tag} (\`${executor.id}\`)` : '*Unknown*', inline: true },
        { name: 'Reason', value: ban.reason || resolved?.reason || '*No reason provided*' }
      )
      .setTimestamp();

    await LogRouter.log(guild, 'mod', 'ban_add', embed);
  }
};
