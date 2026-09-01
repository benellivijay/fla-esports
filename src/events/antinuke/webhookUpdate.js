const { AuditLogEvent } = require('discord.js');
const AuditLogResolver = require('../../antinuke/AuditLogResolver');
const SafetyChecker = require('../../antinuke/SafetyChecker');
const antinukeEngine = require('../../antinuke/AntinukeEngine');
const punishmentExecutor = require('../../antinuke/PunishmentExecutor');
const { ANTINUKE_CATEGORIES } = require('../../config/constants');

module.exports = {
  name: 'webhookUpdate',
  async execute(channel) {
    const { guild } = channel;
    if (!guild) return;

    // Check webhook create/delete/update audit logs
    const resolved =
      (await AuditLogResolver.resolveExecutor(guild, AuditLogEvent.WebhookCreate)) ||
      (await AuditLogResolver.resolveExecutor(guild, AuditLogEvent.WebhookDelete)) ||
      (await AuditLogResolver.resolveExecutor(guild, AuditLogEvent.WebhookUpdate));

    if (!resolved || !resolved.executor) return;

    const executor = resolved.executor;
    const exemption = await SafetyChecker.checkExemption(guild, executor);
    if (exemption.exempt) return;

    const result = antinukeEngine.recordAction(guild.id, executor.id, ANTINUKE_CATEGORIES.WEBHOOK_CREATE);
    if (result.triggered) {
      await punishmentExecutor.execute({
        guild,
        executor,
        category: ANTINUKE_CATEGORIES.WEBHOOK_CREATE,
        threshold: result.limitCount,
        windowSeconds: result.timeWindowSeconds,
        punishment: result.punishment,
        target: `#${channel.name}`,
        details: `Exceeded webhook actions limit in #${channel.name}`
      });
    }
  }
};
