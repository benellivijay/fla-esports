const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const antinukeManager = require('../../database/managers/AntinukeManager');
const FloorRoleHelper = require('../../antinuke/FloorRoleHelper');
const EmbedGenerator = require('../../utils/embed');
const PermissionHelper = require('../../utils/permissions');
const { ANTINUKE_CATEGORIES, PUNISHMENTS, COLORS, EMOJIS } = require('../../config/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('antinuke')
    .setDescription('Configure and manage Mia Antinuke server security & limits')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    // Subcommand: config
    .addSubcommand(sub =>
      sub.setName('config')
        .setDescription('View full antinuke configuration, limits, and trust hierarchy at a glance')
    )
    // Subcommand: enable
    .addSubcommand(sub =>
      sub.setName('enable')
        .setDescription('Enable antinuke protection for this server')
    )
    // Subcommand: disable
    .addSubcommand(sub =>
      sub.setName('disable')
        .setDescription('Disable antinuke protection for this server')
    )
    // Subcommand group: limit
    .addSubcommandGroup(group =>
      group.setName('limit')
        .setDescription('Configure rolling action limits and time windows')
        .addSubcommand(sub =>
          sub.setName('set')
            .setDescription('Set threshold and sliding time window for an event category')
            .addStringOption(opt =>
              opt.setName('category')
                .setDescription('Event category')
                .setRequired(true)
                .addChoices(
                  ...Object.values(ANTINUKE_CATEGORIES).map(cat => ({ name: cat, value: cat }))
                )
            )
            .addIntegerOption(opt =>
              opt.setName('threshold')
                .setDescription('Maximum allowed actions within the time window')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(50)
            )
            .addIntegerOption(opt =>
              opt.setName('window_seconds')
                .setDescription('Time window in seconds')
                .setRequired(true)
                .setMinValue(3)
                .setMaxValue(300)
            )
            .addStringOption(opt =>
              opt.setName('punishment')
                .setDescription('Action taken when limit is exceeded')
                .setRequired(false)
                .addChoices(
                  { name: 'Ban', value: PUNISHMENTS.BAN },
                  { name: 'Kick', value: PUNISHMENTS.KICK },
                  { name: 'Strip Roles', value: PUNISHMENTS.STRIP_ROLES },
                  { name: 'Quarantine (Timeout)', value: PUNISHMENTS.QUARANTINE }
                )
            )
        )
        .addSubcommand(sub =>
          sub.setName('view')
            .setDescription('View current action thresholds for all categories')
        )
    )
    // Subcommand group: punish
    .addSubcommandGroup(group =>
      group.setName('punish')
        .setDescription('Configure punishment for event categories')
        .addSubcommand(sub =>
          sub.setName('set')
            .setDescription('Set punishment for an event category')
            .addStringOption(opt =>
              opt.setName('category')
                .setDescription('Event category')
                .setRequired(true)
                .addChoices(
                  ...Object.values(ANTINUKE_CATEGORIES).map(cat => ({ name: cat, value: cat }))
                )
            )
            .addStringOption(opt =>
              opt.setName('action')
                .setDescription('Punishment action')
                .setRequired(true)
                .addChoices(
                  { name: 'Ban', value: PUNISHMENTS.BAN },
                  { name: 'Kick', value: PUNISHMENTS.KICK },
                  { name: 'Strip Roles', value: PUNISHMENTS.STRIP_ROLES },
                  { name: 'Quarantine (Timeout)', value: PUNISHMENTS.QUARANTINE }
                )
            )
        )
    )
    // Subcommand group: whitelist
    .addSubcommandGroup(group =>
      group.setName('whitelist')
        .setDescription('Manage antinuke exempt whitelist')
        .addSubcommand(sub =>
          sub.setName('add')
            .setDescription('Add a user to the antinuke whitelist (exempt from all limits)')
            .addUserOption(opt => opt.setName('user').setDescription('User to whitelist').setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName('remove')
            .setDescription('Remove a user from the antinuke whitelist')
            .addUserOption(opt => opt.setName('user').setDescription('User to remove').setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName('list')
            .setDescription('List all whitelisted users')
        )
    )
    // Subcommand group: extraowner
    .addSubcommandGroup(group =>
      group.setName('extraowner')
        .setDescription('Manage co-admins with antinuke configuration privileges')
        .addSubcommand(sub =>
          sub.setName('add')
            .setDescription('Delegate antinuke management rights to a co-admin')
            .addUserOption(opt => opt.setName('user').setDescription('Co-admin to add').setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName('remove')
            .setDescription('Revoke antinuke management rights from a co-admin')
            .addUserOption(opt => opt.setName('user').setDescription('Co-admin to remove').setRequired(true))
        )
        .addSubcommand(sub =>
          sub.setName('list')
            .setDescription('List all extra owners')
        )
    )
    // Subcommand group: floor-role
    .addSubcommandGroup(group =>
      group.setName('floor-role')
        .setDescription('Setup bulk-ban mitigation floor role')
        .addSubcommand(sub =>
          sub.setName('setup')
            .setDescription('Create and position a permissionless floor role right below the bot')
        )
        .addSubcommand(sub =>
          sub.setName('inspect')
            .setDescription('Inspect server role hierarchy and elevated role placement')
        )
    )
    // Subcommand group: log
    .addSubcommandGroup(group =>
      group.setName('log')
        .setDescription('Configure security alert logging')
        .addSubcommand(sub =>
          sub.setName('set')
            .setDescription('Set channel for antinuke security logs')
            .addChannelOption(opt =>
              opt.setName('channel')
                .setDescription('Text channel for security logs')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
            )
        )
    ),

  async execute(interaction) {
    const { guild, user, options } = interaction;

    // Verify user is Guild Owner or Extra Owner for ANY antinuke configuration modifications
    const isAuthorized = PermissionHelper.isOwnerOrExtra(guild, user, antinukeManager);
    if (!isAuthorized) {
      return interaction.reply({
        embeds: [
          EmbedGenerator.error(
            'Access Denied',
            'Only the **Server Owner** or delegated **Extra Owners** can view or configure Antinuke settings.'
          )
        ],
        ephemeral: true
      });
    }

    const group = options.getSubcommandGroup(false);
    const sub = options.getSubcommand();

    // 1. /antinuke enable / disable
    if (!group && sub === 'enable') {
      antinukeManager.setEnabled(guild.id, 1);
      return interaction.reply({
        embeds: [EmbedGenerator.success('Antinuke Activated', '🛡️ Mia Antinuke protection is now **ENABLED** on this server.')]
      });
    }

    if (!group && sub === 'disable') {
      // Only server owner can completely disable antinuke
      if (guild.ownerId !== user.id) {
        return interaction.reply({
          embeds: [EmbedGenerator.error('Action Restricted', 'Only the **Server Owner** can completely disable Antinuke protection.')],
          ephemeral: true
        });
      }
      antinukeManager.setEnabled(guild.id, 0);
      return interaction.reply({
        embeds: [EmbedGenerator.warn('Antinuke Deactivated', '⚠️ Mia Antinuke protection is now **DISABLED** on this server.')]
      });
    }

    // 2. /antinuke config
    if (!group && sub === 'config') {
      const config = antinukeManager.getConfig(guild.id);
      const limits = antinukeManager.getLimits(guild.id);
      const whitelist = antinukeManager.getWhitelist(guild.id);
      const extraOwners = antinukeManager.getExtraOwners(guild.id);
      const floorRoleData = FloorRoleHelper.analyzeHierarchy(guild);

      const embed = EmbedGenerator.base()
        .setTitle(`${EMOJIS.SHIELD} Mia Antinuke Configuration`)
        .setDescription(`Comprehensive security posture and threshold status for **${guild.name}**.`)
        .addFields(
          {
            name: '⚡ System Status',
            value: `Status: **${config.enabled ? '🟢 Active' : '🔴 Inactive'}**\nSecurity Log: ${config.log_channel_id ? `<#${config.log_channel_id}>` : '*Not configured*'}`,
            inline: true
          },
          {
            name: '👑 Trust Hierarchy',
            value: `Server Owner: <@${guild.ownerId}>\nExtra Owners: **${extraOwners.length}**\nWhitelisted Members: **${whitelist.length}**`,
            inline: true
          },
          {
            name: '🛡️ Floor Role Defense',
            value: `Floor Role: ${floorRoleData.floorRole ? `<@&${floorRoleData.floorRole.id}>` : '*Not setup*'}\nRoles Above Floor: **${floorRoleData.aboveFloor.length}**\nRoles Below Floor: **${floorRoleData.belowFloor.length}**`,
            inline: true
          }
        );

      // Format limits table in chunks
      const limitLines = limits.slice(0, 12).map(l => `• \`${l.category.padEnd(20)}\` → **${l.limit_count}** in **${l.time_window_seconds}s** [${l.punishment.toUpperCase()}]`).join('\n');
      const limitLines2 = limits.slice(12).map(l => `• \`${l.category.padEnd(20)}\` → **${l.limit_count}** in **${l.time_window_seconds}s** [${l.punishment.toUpperCase()}]`).join('\n');

      embed.addFields({ name: '📊 Event Limits & Punishments (Part 1)', value: limitLines || 'No custom limits set' });
      if (limitLines2) {
        embed.addFields({ name: '📊 Event Limits & Punishments (Part 2)', value: limitLines2 });
      }

      return interaction.reply({ embeds: [embed] });
    }

    // 3. /antinuke limit set / view
    if (group === 'limit') {
      if (sub === 'set') {
        const category = options.getString('category');
        const threshold = options.getInteger('threshold');
        const windowSec = options.getInteger('window_seconds');
        const punishment = options.getString('punishment') || PUNISHMENTS.BAN;

        antinukeManager.setLimit(guild.id, category, threshold, windowSec, punishment);

        return interaction.reply({
          embeds: [
            EmbedGenerator.success(
              'Limit Updated',
              `Successfully updated limit for category \`${category}\`:\n` +
              `• **Threshold:** ${threshold} actions\n` +
              `• **Time Window:** ${windowSec} seconds\n` +
              `• **Punishment:** \`${punishment.toUpperCase()}\``
            )
          ]
        });
      }

      if (sub === 'view') {
        const limits = antinukeManager.getLimits(guild.id);
        const description = limits.map(l => `• **${l.category}**: ${l.limit_count} in ${l.time_window_seconds}s (Action: \`${l.punishment.toUpperCase()}\`)`).join('\n');

        const embed = EmbedGenerator.base()
          .setTitle('📊 Rolling Limit Thresholds')
          .setDescription(description || 'No limits configured.');

        return interaction.reply({ embeds: [embed] });
      }
    }

    // 4. /antinuke punish set
    if (group === 'punish' && sub === 'set') {
      const category = options.getString('category');
      const action = options.getString('action');

      antinukeManager.setPunishment(guild.id, category, action);
      return interaction.reply({
        embeds: [
          EmbedGenerator.success(
            'Punishment Configured',
            `Punishment for \`${category}\` set to **${action.toUpperCase()}**.`
          )
        ]
      });
    }

    // 5. /antinuke whitelist add / remove / list
    if (group === 'whitelist') {
      if (sub === 'add') {
        const targetUser = options.getUser('user');
        if (targetUser.id === guild.ownerId) {
          return interaction.reply({ embeds: [EmbedGenerator.warn('Notice', 'Server owner is already unconditionally exempt.')], ephemeral: true });
        }

        antinukeManager.addWhitelist(guild.id, targetUser.id, user.id);
        return interaction.reply({
          embeds: [
            EmbedGenerator.success(
              'User Whitelisted',
              `Added <@${targetUser.id}> (\`${targetUser.tag}\`) to the Antinuke Whitelist. They are now exempt from all rolling action limits.`
            )
          ]
        });
      }

      if (sub === 'remove') {
        const targetUser = options.getUser('user');
        antinukeManager.removeWhitelist(guild.id, targetUser.id);
        return interaction.reply({
          embeds: [
            EmbedGenerator.success(
              'Whitelist Removed',
              `Removed <@${targetUser.id}> (\`${targetUser.tag}\`) from the Antinuke Whitelist.`
            )
          ]
        });
      }

      if (sub === 'list') {
        const whitelist = antinukeManager.getWhitelist(guild.id);
        const list = whitelist.length > 0
          ? whitelist.map((w, idx) => `${idx + 1}. <@${w.user_id}> (\`${w.user_id}\`) - Added by <@${w.added_by}>`).join('\n')
          : '*No users are currently whitelisted.*';

        const embed = EmbedGenerator.base()
          .setTitle('🛡️ Whitelisted Users')
          .setDescription(list);

        return interaction.reply({ embeds: [embed] });
      }
    }

    // 6. /antinuke extraowner add / remove / list
    if (group === 'extraowner') {
      // Only server owner can manage extra owners
      if (guild.ownerId !== user.id) {
        return interaction.reply({
          embeds: [EmbedGenerator.error('Restricted Action', 'Only the **Server Owner** can add or remove Extra Owners.')],
          ephemeral: true
        });
      }

      if (sub === 'add') {
        const targetUser = options.getUser('user');
        if (targetUser.id === guild.ownerId) {
          return interaction.reply({ embeds: [EmbedGenerator.warn('Notice', 'You are already the server owner!')], ephemeral: true });
        }

        antinukeManager.addExtraOwner(guild.id, targetUser.id, user.id);
        return interaction.reply({
          embeds: [
            EmbedGenerator.success(
              'Extra Owner Added',
              `Delegated Antinuke configuration rights to <@${targetUser.id}> (\`${targetUser.tag}\`).`
            )
          ]
        });
      }

      if (sub === 'remove') {
        const targetUser = options.getUser('user');
        antinukeManager.removeExtraOwner(guild.id, targetUser.id);
        return interaction.reply({
          embeds: [
            EmbedGenerator.success(
              'Extra Owner Removed',
              `Revoked Antinuke configuration rights from <@${targetUser.id}> (\`${targetUser.tag}\`).`
            )
          ]
        });
      }

      if (sub === 'list') {
        const extraOwners = antinukeManager.getExtraOwners(guild.id);
        const list = extraOwners.length > 0
          ? extraOwners.map((o, idx) => `${idx + 1}. <@${o.user_id}> (\`${o.user_id}\`) - Added by <@${o.added_by}>`).join('\n')
          : '*No Extra Owners have been delegated.*';

        const embed = EmbedGenerator.base()
          .setTitle('👑 Delegated Extra Owners')
          .setDescription(list);

        return interaction.reply({ embeds: [embed] });
      }
    }

    // 7. /antinuke floor-role setup / inspect
    if (group === 'floor-role') {
      if (sub === 'setup') {
        await interaction.deferReply();
        const result = await FloorRoleHelper.setupFloorRole(guild);
        if (!result.success) {
          return interaction.editReply({ embeds: [EmbedGenerator.error('Floor Role Setup Failed', result.message)] });
        }

        return interaction.editReply({
          embeds: [
            EmbedGenerator.success(
              'Bulk-Ban Floor Role Active',
              `Successfully created & configured the floor role <@&${result.role.id}> at position **#${result.position}** (Right below bot role at #${result.botPosition}).\n\n` +
              `💡 **Setup Tip:** Position your staff & elevated roles beneath this floor role to ensure compromised accounts cannot execute mass bulk-bans.`
            )
          ]
        });
      }

      if (sub === 'inspect') {
        const analysis = FloorRoleHelper.analyzeHierarchy(guild);
        const aboveStr = analysis.aboveFloor.length > 0
          ? analysis.aboveFloor.map(r => `• <@&${r.id}> (Pos #${r.position})`).join('\n')
          : '*None (All elevated roles are safely below floor)*';

        const belowStr = analysis.belowFloor.length > 0
          ? analysis.belowFloor.map(r => `• <@&${r.id}> (Pos #${r.position})`).join('\n')
          : '*None*';

        const embed = EmbedGenerator.base()
          .setTitle('🛡️ Hierarchy & Floor Role Inspection')
          .setDescription(`Analysis of roles holding elevated/dangerous permissions in **${guild.name}**.`)
          .addFields(
            { name: `⚠️ Elevated Roles Above Floor (${analysis.aboveFloor.length})`, value: aboveStr },
            { name: `✅ Elevated Roles Below Floor (${analysis.belowFloor.length})`, value: belowStr }
          );

        return interaction.reply({ embeds: [embed] });
      }
    }

    // 8. /antinuke log set
    if (group === 'log' && sub === 'set') {
      const channel = options.getChannel('channel');
      antinukeManager.setLogChannel(guild.id, channel.id);
      return interaction.reply({
        embeds: [
          EmbedGenerator.success(
            'Security Log Configured',
            `All Antinuke security alerts and intercepted actions will now be logged to ${channel}.`
          )
        ]
      });
    }
  }
};
