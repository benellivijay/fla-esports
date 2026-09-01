const { AuditLogEvent } = require('discord.js');
const AuditLogResolver = require('../../antinuke/AuditLogResolver');
const SafetyChecker = require('../../antinuke/SafetyChecker');
const antinukeEngine = require('../../antinuke/AntinukeEngine');
const punishmentExecutor = require('../../antinuke/PunishmentExecutor');
const { ANTINUKE_CATEGORIES } = require('../../config/constants');

module.exports = {
  name: 'guildIntegrationsUpdate',
  async execute(guild) {
    const resolved = await AuditLogResolver.resolveExecutor(guild, AuditLogEvent.IntegrationCreate);
    if (!resolved || !resolved.executor) return;

    const executor = resolved.executor;
    const exemption = await SafetyChecker.checkExemption(guild, executor);
    if (exemption.exempt) return;

    const result = antinukeEngine.recordAction(guild.id, executor.id, ANTINUKE_CATEGORIES.INTEGRATION_ADD);
    if (result.triggered) {
      await punishmentExecutor.execute({
        guild,
        executor,
        category: ANTINUKE_CATEGORIES.INTEGRATION_ADD,
        threshold: result.limitCount,
        windowSeconds: result.timeWindowSeconds,
        punishment: result.punishment,
        target: 'Server Integrations',
        details: 'Unauthorized third-party integration addition'
      });
    }
  }
};
