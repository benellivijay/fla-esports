const { AuditLogEvent } = require('discord.js');
const AuditLogResolver = require('../../antinuke/AuditLogResolver');
const SafetyChecker = require('../../antinuke/SafetyChecker');
const antinukeEngine = require('../../antinuke/AntinukeEngine');
const punishmentExecutor = require('../../antinuke/PunishmentExecutor');
const LogRouter = require('../../utils/LogRouter');
const EmbedGenerator = require('../../utils/embed');
const { ANTINUKE_CATEGORIES } = require('../../config/constants');

module.exports = {
  name: 'roleCreate',
  async execute(role) {
    const { guild } = role;
    if (!guild) return;

    const resolved = await AuditLogResolver.resolveExecutor(guild, AuditLogEvent.RoleCreate, role.id);
    const executor = resolved?.executor;

    if (executor) {
      const exemption = await SafetyChecker.checkExemption(guild, executor);
      if (!exemption.exempt) {
        const result = antinukeEngine.recordAction(guild.id, executor.id, ANTINUKE_CATEGORIES.ROLE_CREATE);
        if (result.triggered) {
          await punishmentExecutor.execute({
            guild,
            executor,
            category: ANTINUKE_CATEGORIES.ROLE_CREATE,
            threshold: result.limitCount,
            windowSeconds: result.timeWindowSeconds,
            punishment: result.punishment,
            target: `@${role.name} (\`${role.id}\`)`,
            details: `Exceeded role creation limit (${result.limitCount} roles created in ${result.timeWindowSeconds}s)`
          });
        }
      }
    }

    // Role Actions Audit Logging
    const embed = EmbedGenerator.base()
      .setTitle('🎭 Role Created')
      .setColor(role.color || 0x57F287)
      .addFields(
        { name: 'Role', value: `${role} (\`@${role.name}\`)`, inline: true },
        { name: 'Created By', value: executor ? `${executor.tag} (\`${executor.id}\`)` : '*Unknown*', inline: true },
        { name: 'Color', value: `\`${role.hexColor}\``, inline: true },
        { name: 'Hoisted', value: role.hoist ? 'Yes 🟢' : 'No ⚪', inline: true },
        { name: 'Mentionable', value: role.mentionable ? 'Yes 🟢' : 'No ⚪', inline: true }
      )
      .setTimestamp();

    await LogRouter.log(guild, 'role', 'role_create', embed);
  }
};
