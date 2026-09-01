const { PermissionFlagsBits } = require('discord.js');
const isBotOwner = require('./isBotOwner');
const antinukeManager = require('../database/managers/AntinukeManager');

class PermissionHelper {
  /**
   * Master authorization check:
   * Returns true ONLY if user is:
   * 1. Bot Owner
   * 2. Server Owner (guild owner)
   * 3. Extra Owner (configured via antinuke extraowner)
   */
  static async isCommandAuthorized(guild, user, client) {
    if (!user) return false;

    // 1. Bot Owner check
    if (client && await isBotOwner(client, user.id)) return true;

    // 2. Server Owner check
    if (guild) {
      if (guild.ownerId === user.id) return true;

      // 3. Extra Owner check
      if (antinukeManager.isExtraOwner(guild.id, user.id)) return true;
    }

    return false;
  }

  /**
   * Check if user is the guild owner or an extra-owner (legacy helper)
   */
  static isOwnerOrExtra(guild, user, extraOwnerManager = antinukeManager) {
    if (!guild || !user) return false;
    if (guild.ownerId === user.id) return true;
    if (extraOwnerManager && extraOwnerManager.isExtraOwner(guild.id, user.id)) return true;
    return false;
  }

  /**
   * Check if bot's role is above target member and bot has permissions to moderate them
   */
  static canModerate(guild, executorMember, targetMember, requiredPermission = PermissionFlagsBits.BanMembers) {
    const botMember = guild.members.me;
    if (!botMember) return { allowed: false, reason: 'Bot member could not be resolved.' };

    // Bot permission check
    if (!botMember.permissions.has(requiredPermission) && !botMember.permissions.has(PermissionFlagsBits.Administrator)) {
      return { allowed: false, reason: 'The bot lacks the required Discord permissions to perform this action.' };
    }

    // Target check
    if (targetMember) {
      if (targetMember.id === guild.ownerId) {
        return { allowed: false, reason: 'The server owner cannot be moderated.' };
      }
      if (targetMember.id === botMember.id) {
        return { allowed: false, reason: 'The bot cannot moderate itself.' };
      }
      if (botMember.roles.highest.position <= targetMember.roles.highest.position) {
        return { allowed: false, reason: "The target member's highest role is equal to or higher than the bot's highest role." };
      }
      if (executorMember && executorMember.id !== guild.ownerId) {
        const isExtra = antinukeManager.isExtraOwner(guild.id, executorMember.id);
        if (!isExtra && executorMember.roles.highest.position <= targetMember.roles.highest.position) {
          return { allowed: false, reason: "Your highest role is equal to or lower than the target member's highest role." };
        }
      }
    }

    return { allowed: true };
  }

  /**
   * Compare role positions
   */
  static isRoleHigher(member1, member2) {
    if (!member1 || !member2) return false;
    return member1.roles.highest.position > member2.roles.highest.position;
  }
}

PermissionHelper.isBotOwner = isBotOwner;
module.exports = PermissionHelper;
module.exports.PermissionHelper = PermissionHelper;
module.exports.isBotOwner = isBotOwner;
