const { AuditLogEvent } = require('discord.js');

class AuditLogResolver {
  /**
   * Resolves the executor of an audit log event
   */
  static async resolveExecutor(guild, auditLogType, targetId = null, maxAgeMs = 7000) {
    try {
      if (!guild.members.me?.permissions.has('ViewAuditLog')) {
        return null;
      }

      // Small sleep to ensure Discord has populated the audit log entry
      await new Promise(resolve => setTimeout(resolve, 300));

      const auditLogs = await guild.fetchAuditLogs({
        type: auditLogType,
        limit: 5
      });

      const now = Date.now();
      for (const entry of auditLogs.entries.values()) {
        const entryAge = now - entry.createdTimestamp;

        // Check if log entry is recent
        if (entryAge <= maxAgeMs) {
          // If a target is provided, verify match
          if (targetId && entry.target && entry.target.id && entry.target.id !== targetId) {
            continue;
          }
          return {
            executor: entry.executor,
            entry: entry,
            target: entry.target
          };
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }
}

module.exports = AuditLogResolver;
