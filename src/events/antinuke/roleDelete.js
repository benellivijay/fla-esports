const { AuditLogEvent } = require('discord.js');
const AuditLogResolver = require('../../antinuke/AuditLogResolver');
const SafetyChecker = require('../../antinuke/SafetyChecker');
const antinukeEngine = require('../../antinuke/AntinukeEngine');
const punishmentExecutor = require('../../antinuke/PunishmentExecutor');
const LogRouter = require('../../utils/LogRouter');
const EmbedGenerator = require('../../utils/embed');
const { ANTINUKE_CATEGORIES } = require('../../config/constants');

module.exports = {
  name: 'roleDelete',
  async execute(role) {
    const { guild } = role;
    if (!guild) return;

    const resolved = await AuditLogResolver.resolveExecutor(guild, AuditLogEvent.RoleDelete, role.id);
    const executor = resolved?.executor;

    if (executor) {
      const exemption = await SafetyChecker.checkExemption(guild, executor);
      if (!exemption.exempt) {
        const result = antinukeEngine.recordAction(guild.id, executor.id, ANTINUKE_CATEGORIES.ROLE_DELETE);
        if (result.triggered) {
          await punishmentExecutor.execute({
            guild,
            executor,
            category: ANTINUKE_CATEGORIES.ROLE_DELETE,
            threshold: result.limitCount,
            windowSeconds: result.timeWindowSeconds,
            punishment: result.punishment,
            target: `@${role.name} (\`${role.id}\`)`,
            details: `Exceeded role deletion limit (${result.limitCount} roles deleted in ${result.timeWindowSeconds}s)`
          });
        }
      }
    }

    // Role Actions Audit Logging
    const embed = EmbedGenerator.base()
      .setTitle('🗑️ Role Deleted')
      .setColor(0xED4245)
      .addFields(
        { name: 'Role Name', value: `@${role.name} (\`${role.id}\`)`, inline: true },
        { name: 'Deleted By', value: executor ? `${executor.tag} (\`${executor.id}\`)` : '*Unknown*', inline: true },
        { name: 'Color', value: `\`${role.hexColor}\``, inline: true }
      )
      .setTimestamp();

    await LogRouter.log(guild, 'role', 'role_delete', embed);
  }
};
