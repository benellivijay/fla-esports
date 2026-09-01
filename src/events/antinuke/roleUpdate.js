const { AuditLogEvent } = require('discord.js');
const AuditLogResolver = require('../../antinuke/AuditLogResolver');
const SafetyChecker = require('../../antinuke/SafetyChecker');
const antinukeEngine = require('../../antinuke/AntinukeEngine');
const punishmentExecutor = require('../../antinuke/PunishmentExecutor');
const LogRouter = require('../../utils/LogRouter');
const EmbedGenerator = require('../../utils/embed');
const { ANTINUKE_CATEGORIES } = require('../../config/constants');

module.exports = {
  name: 'roleUpdate',
  async execute(oldRole, newRole) {
    const { guild } = newRole;
    if (!guild) return;

    const resolved = await AuditLogResolver.resolveExecutor(guild, AuditLogEvent.RoleUpdate, newRole.id);
    const executor = resolved?.executor;

    if (executor) {
      const exemption = await SafetyChecker.checkExemption(guild, executor);
      if (!exemption.exempt) {
        const result = antinukeEngine.recordAction(guild.id, executor.id, ANTINUKE_CATEGORIES.ROLE_UPDATE);
        if (result.triggered) {
          await punishmentExecutor.execute({
            guild,
            executor,
            category: ANTINUKE_CATEGORIES.ROLE_UPDATE,
            threshold: result.limitCount,
            windowSeconds: result.timeWindowSeconds,
            punishment: result.punishment,
            target: `@${newRole.name} (\`${newRole.id}\`)`,
            details: `Exceeded role update limit (${result.limitCount} edits in ${result.timeWindowSeconds}s)`
          });
          return;
        }
      }
    }

    // Role Actions Audit Logging
    const embed = EmbedGenerator.base()
      .setTitle('🎭 Role Modified')
      .setColor(newRole.color || 0xFEE75C)
      .addFields(
        { name: 'Role', value: `${newRole} (\`@${newRole.name}\`)`, inline: true },
        { name: 'Updated By', value: executor ? `${executor.tag} (\`${executor.id}\`)` : '*Unknown*', inline: true }
      );

    if (oldRole.name !== newRole.name) {
      embed.addFields({ name: 'Name Change', value: `\`@${oldRole.name}\` ➔ \`@${newRole.name}\`` });
    }
    if (oldRole.hexColor !== newRole.hexColor) {
      embed.addFields({ name: 'Color Change', value: `\`${oldRole.hexColor}\` ➔ \`${newRole.hexColor}\``, inline: true });
    }
    if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) {
      embed.addFields({ name: 'Permissions', value: '*Role permissions modified*', inline: true });
    }
    embed.setTimestamp();

    await LogRouter.log(guild, 'role', 'role_update', embed);
  }
};
