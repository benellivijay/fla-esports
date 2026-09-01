const antinukeManager = require('../database/managers/AntinukeManager');
const Logger = require('../utils/logger');

class SafetyChecker {
  /**
   * Evaluates whether an executor is exempt or if an action should be checked by Antinuke
   */
  static async checkExemption(guild, executor) {
    if (!guild || !executor) {
      return { exempt: true, reason: 'Invalid guild or executor' };
    }

    const config = antinukeManager.getConfig(guild.id);
    if (!config || !config.enabled) {
      return { exempt: true, reason: 'Antinuke disabled for guild' };
    }

    // 1. Bot itself is always exempt
    if (executor.id === guild.client.user.id) {
      return { exempt: true, reason: 'Bot action' };
    }

    // 2. Guild Owner is unconditionally exempt
    if (executor.id === guild.ownerId) {
      return { exempt: true, reason: 'Guild Owner' };
    }

    // 3. Extra Owners are exempt
    if (antinukeManager.isExtraOwner(guild.id, executor.id)) {
      return { exempt: true, reason: 'Extra Owner' };
    }

    // 4. Whitelisted Users are exempt from limits
    if (antinukeManager.isWhitelisted(guild.id, executor.id)) {
      return { exempt: true, reason: 'Whitelisted User' };
    }

    return { exempt: false };
  }

  /**
   * Pre-execution safety check: verify if the bot can punish the acting executor
   */
  static async canPunishExecutor(guild, executorId) {
    try {
      const botMember = guild.members.me;
      if (!botMember) return { canPunish: false, reason: 'Bot member unavailable' };

      // Fetch executor member
      const executorMember = await guild.members.fetch(executorId).catch(() => null);
      if (!executorMember) {
        return { canPunish: true, member: null, reason: 'Executor not in guild (can still ban by ID)' };
      }

      // Owner check
      if (executorMember.id === guild.ownerId) {
        return { canPunish: false, reason: 'Cannot punish server owner' };
      }

      // Hierarchy check: Bot's highest role must be higher than executor's highest role
      if (botMember.roles.highest.position <= executorMember.roles.highest.position) {
        return {
          canPunish: false,
          member: executorMember,
          reason: "Executor's role is equal to or higher than the bot's highest role"
        };
      }

      return { canPunish: true, member: executorMember };
    } catch (err) {
      Logger.error(`Error in canPunishExecutor: ${err.message}`);
      return { canPunish: false, reason: err.message };
    }
  }
}

module.exports = SafetyChecker;
