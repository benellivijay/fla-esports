const { AuditLogEvent } = require('discord.js');
const AuditLogResolver = require('../../antinuke/AuditLogResolver');
const SafetyChecker = require('../../antinuke/SafetyChecker');
const antinukeEngine = require('../../antinuke/AntinukeEngine');
const punishmentExecutor = require('../../antinuke/PunishmentExecutor');
const LogRouter = require('../../utils/LogRouter');
const EmbedGenerator = require('../../utils/embed');
const { ANTINUKE_CATEGORIES } = require('../../config/constants');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member) {
    const { guild, user } = member;

    // Check for Member Prune
    const pruneLog = await AuditLogResolver.resolveExecutor(guild, AuditLogEvent.MemberPrune, null, 5000);
    if (pruneLog && pruneLog.executor) {
      const executor = pruneLog.executor;
      const exemption = await SafetyChecker.checkExemption(guild, executor);
      if (!exemption.exempt) {
        const result = antinukeEngine.recordAction(guild.id, executor.id, ANTINUKE_CATEGORIES.MEMBER_PRUNE);
        if (result.triggered) {
          await punishmentExecutor.execute({
            guild,
            executor,
            category: ANTINUKE_CATEGORIES.MEMBER_PRUNE,
            threshold: result.limitCount,
            windowSeconds: result.timeWindowSeconds,
            punishment: result.punishment,
            target: 'Server Member Pruning',
            details: 'Unauthorized mass member prune detected'
          });
          return;
        }
      }
    }

    // Check for Member Kick
    const kickLog = await AuditLogResolver.resolveExecutor(guild, AuditLogEvent.MemberKick, user.id, 5000);
    if (kickLog && kickLog.executor) {
      const executor = kickLog.executor;
      const exemption = await SafetyChecker.checkExemption(guild, executor);
      if (!exemption.exempt) {
        const result = antinukeEngine.recordAction(guild.id, executor.id, ANTINUKE_CATEGORIES.KICK);
        if (result.triggered) {
          await punishmentExecutor.execute({
            guild,
            executor,
            category: ANTINUKE_CATEGORIES.KICK,
            threshold: result.limitCount,
            windowSeconds: result.timeWindowSeconds,
            punishment: result.punishment,
            target: `${user.tag} (\`${user.id}\`)`,
            details: `Exceeded kick limit (${result.limitCount} kicks in ${result.timeWindowSeconds}s)`
          });
          return;
        }
      }

      // Log Mod Kick Action
      const kickEmbed = EmbedGenerator.base()
        .setTitle('👢 Member Kicked')
        .setColor(0xED4245)
        .addFields(
          { name: 'Target', value: `${user.tag} (\`${user.id}\`)`, inline: true },
          { name: 'Moderator', value: `${executor.tag} (\`${executor.id}\`)`, inline: true },
          { name: 'Reason', value: kickLog.reason || 'No reason provided' }
        )
        .setTimestamp();
      await LogRouter.log(guild, 'mod', 'mod', kickEmbed);
      return;
    }

    // Regular Member Leave Log
    const embed = EmbedGenerator.base()
      .setTitle('📤 Member Left Server')
      .setColor(0xED4245)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: 'User', value: `${user.tag} (\`${user.id}\`)`, inline: true },
        { name: 'Remaining Members', value: `**#${guild.memberCount}**`, inline: true }
      )
      .setTimestamp();

    await LogRouter.log(guild, 'member', 'leaves', embed);
  }
};
