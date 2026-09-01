const { PermissionFlagsBits } = require('discord.js');
const guildManager = require('../database/managers/GuildManager');
const { FLOOR_ROLE_NAME } = require('../config/constants');
const Logger = require('../utils/logger');

class FloorRoleHelper {
  /**
   * Creates or configures the permissionless floor role positioned right below the bot
   */
  static async setupFloorRole(guild) {
    const botMember = guild.members.me;
    if (!botMember) {
      return { success: false, message: 'Bot member not found in guild.' };
    }

    if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return { success: false, message: 'Bot lacks `ManageRoles` permission to create or position the floor role.' };
    }

    let floorRoleId = guildManager.getFloorRole(guild.id);
    let floorRole = floorRoleId ? guild.roles.cache.get(floorRoleId) : null;

    if (!floorRole) {
      // Find existing role by name or create new
      floorRole = guild.roles.cache.find(r => r.name === FLOOR_ROLE_NAME);
      if (!floorRole) {
        floorRole = await guild.roles.create({
          name: FLOOR_ROLE_NAME,
          color: '#2B2D31',
          permissions: 0n,
          reason: 'Mia Security: Bulk-ban mitigation floor role'
        });
      }
      guildManager.setFloorRole(guild.id, floorRole.id);
    }

    // Attempt to position right below bot's highest role
    const botHighestRole = botMember.roles.highest;
    const targetPosition = Math.max(1, botHighestRole.position - 1);

    try {
      if (floorRole.position !== targetPosition && targetPosition > 0) {
        await floorRole.setPosition(targetPosition, { reason: 'Mia Security: Floor role position calibration' });
      }
    } catch (err) {
      Logger.warn(`Could not set exact floor role position: ${err.message}`);
    }

    return {
      success: true,
      role: floorRole,
      position: floorRole.position,
      botPosition: botHighestRole.position
    };
  }

  /**
   * Analyzes guild roles and checks which elevated roles are safely below the floor role
   */
  static analyzeHierarchy(guild) {
    const floorRoleId = guildManager.getFloorRole(guild.id);
    const floorRole = floorRoleId ? guild.roles.cache.get(floorRoleId) : null;
    const botHighest = guild.members.me?.roles.highest;

    const dangerousPermissions = [
      PermissionFlagsBits.Administrator,
      PermissionFlagsBits.BanMembers,
      PermissionFlagsBits.KickMembers,
      PermissionFlagsBits.ManageGuild,
      PermissionFlagsBits.ManageChannels,
      PermissionFlagsBits.ManageRoles,
      PermissionFlagsBits.ManageWebhooks
    ];

    const elevatedRoles = guild.roles.cache
      .filter(r => r.id !== guild.id && dangerousPermissions.some(perm => r.permissions.has(perm)))
      .sort((a, b) => b.position - a.position);

    const aboveFloor = [];
    const belowFloor = [];

    elevatedRoles.forEach(role => {
      if (!floorRole || role.position > floorRole.position) {
        aboveFloor.push(role);
      } else {
        belowFloor.push(role);
      }
    });

    return {
      floorRole,
      botHighest,
      totalElevated: elevatedRoles.size,
      aboveFloor,
      belowFloor
    };
  }
}

module.exports = FloorRoleHelper;
