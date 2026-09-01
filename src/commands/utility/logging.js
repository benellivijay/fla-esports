const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');
const loggingManager = require('../../database/managers/LoggingManager');
const EmbedGenerator = require('../../utils/embed');
const Logger = require('../../utils/logger');

const CHANNEL_DEFINITIONS = [
  {
    key: 'memberChannelId',
    name: 'member-logs',
    title: 'Member Logs Channel',
    topic: 'Member Joins, Leaves, Nicknames, Role updates',
    events: [
      'Member Join',
      'Member Leave',
      'Bot Add',
      'Bot Remove',
      'Nickname Update',
      'Members Pruned',
      'Server Avatar Changed'
    ]
  },
  {
    key: 'messageChannelId',
    name: 'message-logs',
    title: 'Message Logs Channel',
    topic: 'Message Deletions, Edits, Purges, Pins',
    events: [
      'Delete Attachment',
      'Poll Created',
      'Poll Deleted',
      'Poll Vote Added',
      'Poll Vote Removed',
      'Poll Finalized',
      'Delete Multiple Messages',
      'Delete Thread Message',
      'Delete Single Message',
      'Edit Thread Message',
      'Edit Message',
      'Thread Create',
      'Thread Delete',
      'Thread Updated',
      'Message Pinned',
      'And 1 more...'
    ]
  },
  {
    key: 'voiceChannelId',
    name: 'voice-logs',
    title: 'Voice Logs Channel',
    topic: 'Voice Channel Activity, Mutes, Streaming',
    events: [
      'Stream Start',
      'Stream End',
      'Video Start',
      'Video Stop',
      'Moved',
      'Voice Channel Join',
      'Voice Channel Leave',
      'Server Deafen',
      'Server Mute',
      'Server Undeafen',
      'Server Unmute',
      'Self Mute',
      'Self Unmute',
      'Self Deafen',
      'Self Undeafen',
      'And 6 more...'
    ]
  },
  {
    key: 'serverChannelId',
    name: 'server-logs',
    title: 'Server Logs Channel',
    topic: 'Server Changes, Invites, Emojis, Stickers',
    events: [
      'Invite Create',
      'Invite Delete',
      'Emoji Create',
      'Emoji Delete',
      'Emoji Update',
      'Event Create',
      'Event Deleted',
      'Event Updated',
      'Server Modified',
      'Server Icon Update',
      'Server Boost Added',
      'Server Boost Removed'
    ]
  },
  {
    key: 'channelChannelId',
    name: 'channel-logs',
    title: 'Channel Logs Channel',
    topic: 'Channel Creations, Deletions, Permission changes',
    events: [
      'Channel Create',
      'Channel Delete',
      'Channel Update',
      'Channel Permissions Added',
      'Channel Permissions Deleted',
      'Channel Permissions Updated',
      'Webhook Created',
      'Webhook Deleted',
      'Webhook Modified',
      'Webhook Avatar Updated',
      'Channel Followed',
      'Channel Unfollowed',
      'Followed Channel Updated'
    ]
  },
  {
    key: 'roleChannelId',
    name: 'role-logs',
    title: 'Role Logs Channel',
    topic: 'Role Creations, Deletions, Permissions updates',
    events: [
      'Role Create',
      'Role Delete',
      'Role Update',
      'Role Permissions Updated',
      'Role Position Changed',
      'Role Color Updated'
    ]
  },
  {
    key: 'modChannelId',
    name: 'mod-logs',
    title: 'Mod Logs Channel',
    topic: 'Bans, Kicks, Timeouts, AutoMod Interceptions',
    events: [
      'Member Banned',
      'Member Unbanned',
      'Member Kicked',
      'Member Timed Out',
      'Member Timeout Removed',
      'AutoMod Violations Intercepted'
    ]
  }
];

function buildLoggingSetupEmbed(guild) {
  const config = loggingManager.getConfig(guild.id);
  const isEnabled = config.enabled;

  const categories = [
    { name: '👥 Member Actions', key: 'member', channelId: config.member_channel_id, desc: 'Joins, Leaves, Nicknames, Role updates' },
    { name: '💬 Message Actions', key: 'message', channelId: config.message_channel_id, desc: 'Deletions, Edits, Purges, Pins' },
    { name: '🔊 Voice Actions', key: 'voice', channelId: config.voice_channel_id, desc: 'VC Join/Leave, Mutes, Streaming' },
    { name: '🌐 Server Actions', key: 'server', channelId: config.server_channel_id, desc: 'Server updates, Invites, Emojis, Stickers' },
    { name: '📁 Channel Actions', key: 'channel', channelId: config.channel_channel_id, desc: 'Channel Create, Delete, Permissions' },
    { name: '🎭 Role Actions', key: 'role', channelId: config.role_channel_id, desc: 'Role Create, Delete, Modifications' },
    { name: '🛡️ Mod Logs', key: 'mod', channelId: config.mod_channel_id, desc: 'Bans, Kicks, Timeouts, AutoMod' }
  ];

  let statusText = categories.map(cat => {
    const chText = cat.channelId ? `<#${cat.channelId}>` : '`Not Configured`';
    return `**${cat.name}**\n↳ ${chText} • *${cat.desc}*`;
  }).join('\n\n');

  const embed = new EmbedBuilder()
    .setColor(isEnabled ? 0x06B6D4 : 0xED4245)
    .setTitle('📋 Advanced Server Logging Setup')
    .setDescription(
      `Keep a detailed audit trail of every action in your server.\nStatus: **${isEnabled ? '🟢 ENABLED' : '🔴 DISABLED'}**\n\n` +
      `Click **⚡ Auto Setup** to automatically generate a complete logging category with dedicated channels for every event type.\n\n` +
      `----------------------------------------\n${statusText}`
    )
    .setFooter({ text: '𝐌𝐢𝐚 ⚚ Advanced Security & Logging • docs.zynraxbotz.site' })
    .setTimestamp();

  return embed;
}

function buildLoggingComponents(guild) {
  const config = loggingManager.getConfig(guild.id);

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('logging_select_category')
    .setPlaceholder('Select a logging category to configure...')
    .addOptions([
      { label: 'Member Actions', description: 'Configure Member Join/Leave & Nickname logs', value: 'member', emoji: '👥' },
      { label: 'Message Actions', description: 'Configure Message Delete, Edit & Purge logs', value: 'message', emoji: '💬' },
      { label: 'Voice Actions', description: 'Configure Voice Activity & Stream logs', value: 'voice', emoji: '🔊' },
      { label: 'Server Actions', description: 'Configure Server, Invite & Emoji logs', value: 'server', emoji: '🌐' },
      { label: 'Channel Actions', description: 'Configure Channel Create/Delete logs', value: 'channel', emoji: '📁' },
      { label: 'Role Actions', description: 'Configure Role Creation & Update logs', value: 'role', emoji: '🎭' },
      { label: 'Mod Logs', description: 'Configure Ban, Kick, Timeout & AutoMod logs', value: 'mod', emoji: '🛡️' }
    ]);

  const row1 = new ActionRowBuilder().addComponents(selectMenu);

  const autoBtn = new ButtonBuilder()
    .setCustomId('logging_auto_setup')
    .setLabel('Auto Setup (7 Channels)')
    .setStyle(ButtonStyle.Success)
    .setEmoji('⚡');

  const toggleBtn = new ButtonBuilder()
    .setCustomId('logging_toggle_status')
    .setLabel(config.enabled ? 'Disable Module' : 'Enable Module')
    .setStyle(config.enabled ? ButtonStyle.Danger : ButtonStyle.Primary)
    .setEmoji(config.enabled ? '🔴' : '🟢');

  const resetBtn = new ButtonBuilder()
    .setCustomId('logging_reset')
    .setLabel('Reset Config')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('🔄');

  const cancelBtn = new ButtonBuilder()
    .setCustomId('logging_cancel')
    .setLabel('Close')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('❌');

  const row2 = new ActionRowBuilder().addComponents(autoBtn, toggleBtn, resetBtn, cancelBtn);

  return [row1, row2];
}

async function executeAutoSetup(guild) {
  // 1. Create 𝐌𝐢𝐚 ⚚ LOGS category
  const everyoneRole = guild.roles.everyone;
  const botMember = guild.members.me;

  const category = await guild.channels.create({
    name: '𝐌𝐢𝐚 ⚚ LOGS',
    type: ChannelType.GuildCategory,
    permissionOverwrites: [
      {
        id: everyoneRole.id,
        deny: [PermissionFlagsBits.ViewChannel]
      },
      {
        id: botMember.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.ManageChannels
        ]
      }
    ]
  });

  const createdChannels = {};

  // 2. Create each dedicated channel and post initial info card
  for (const item of CHANNEL_DEFINITIONS) {
    const ch = await guild.channels.create({
      name: item.name,
      type: ChannelType.GuildText,
      parent: category.id,
      topic: item.topic
    });
    createdChannels[item.key] = ch.id;

    // Send the initial informative channel card exactly like shown in screenshots
    const infoEmbed = new EmbedBuilder()
      .setColor(0x2B2D31)
      .setTitle(item.title)
      .setDescription(
        `📑 **This channel will log the following events:**\n` +
        item.events.map(e => `❯ ${e}`).join('\n')
      )
      .setFooter({ text: 'Auto setup via Mia Logging' })
      .setTimestamp();

    await ch.send({ embeds: [infoEmbed] }).catch(() => null);
  }

  loggingManager.saveAutoSetup(guild.id, {
    categoryId: category.id,
    ...createdChannels
  });

  return { category, createdChannels };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('logging')
    .setDescription('Advanced server audit logging and automated channel setup')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('setup')
        .setDescription('Open the interactive logging configuration dashboard')
    )
    .addSubcommand(sub =>
      sub.setName('auto')
        .setDescription('Automatically create logging category with 7 specialized channels')
    )
    .addSubcommand(sub =>
      sub.setName('config')
        .setDescription('View current audit, message, and security logging configuration')
    )
    .addSubcommand(sub =>
      sub.setName('enable')
        .setDescription('Enable the server logging module')
    )
    .addSubcommand(sub =>
      sub.setName('disable')
        .setDescription('Disable the server logging module')
    )
    .addSubcommand(sub =>
      sub.setName('reset')
        .setDescription('Wipe all logging configuration and channels')
    )
    .addSubcommand(sub =>
      sub.setName('channel')
        .setDescription('Set a specific logging category channel')
        .addStringOption(opt =>
          opt.setName('category')
            .setDescription('Logging category')
            .setRequired(true)
            .addChoices(
              { name: 'Member Actions (member)', value: 'member' },
              { name: 'Message Actions (message)', value: 'message' },
              { name: 'Voice Actions (voice)', value: 'voice' },
              { name: 'Server Actions (server)', value: 'server' },
              { name: 'Channel Actions (channel)', value: 'channel' },
              { name: 'Role Actions (role)', value: 'role' },
              { name: 'Mod Logs (mod)', value: 'mod' }
            )
        )
        .addChannelOption(opt =>
          opt.setName('target')
            .setDescription('Channel to send logs to')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    ),

  buildLoggingSetupEmbed,
  buildLoggingComponents,
  executeAutoSetup,

  async execute(interaction) {
    const { guild, options } = interaction;
    const sub = options.getSubcommand();

    if (sub === 'setup') {
      const embed = buildLoggingSetupEmbed(guild);
      const components = buildLoggingComponents(guild);
      return interaction.reply({ embeds: [embed], components });
    }

    if (sub === 'auto') {
      await interaction.deferReply();
      try {
        const { category, createdChannels } = await executeAutoSetup(guild);
        const embed = new EmbedBuilder()
          .setColor(0x06B6D4)
          .setTitle('✨ Logging Auto Setup Complete')
          .setDescription(
            `Successfully created category **${category.name}** and 7 specialized logging channels:\n\n` +
            `• 👥 **Member Logs:** <#${createdChannels.memberChannelId}>\n` +
            `• 💬 **Message Logs:** <#${createdChannels.messageChannelId}>\n` +
            `• 🔊 **Voice Logs:** <#${createdChannels.voiceChannelId}>\n` +
            `• 🌐 **Server Logs:** <#${createdChannels.serverChannelId}>\n` +
            `• 📁 **Channel Logs:** <#${createdChannels.channelChannelId}>\n` +
            `• 🎭 **Role Logs:** <#${createdChannels.roleChannelId}>\n` +
            `• 🛡️ **Mod Logs:** <#${createdChannels.modChannelId}>\n\n` +
            `*All audit events are now actively monitored and routed!*`
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        Logger.error(`Auto setup failed: ${err.message}`);
        return interaction.editReply({
          embeds: [EmbedGenerator.error('Setup Failed', `Failed to create channels: ${err.message}`)]
        });
      }
    }

    if (sub === 'config' || sub === 'status') {
      const embed = buildLoggingSetupEmbed(guild);
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'enable') {
      loggingManager.setEnabled(guild.id, true);
      return interaction.reply({
        embeds: [EmbedGenerator.success('Logging Enabled', 'The server logging module has been turned **ON 🟢**.')]
      });
    }

    if (sub === 'disable') {
      loggingManager.setEnabled(guild.id, false);
      return interaction.reply({
        embeds: [EmbedGenerator.success('Logging Disabled', 'The server logging module has been turned **OFF 🔴**.')]
      });
    }

    if (sub === 'reset') {
      loggingManager.resetConfig(guild.id);
      return interaction.reply({
        embeds: [EmbedGenerator.success('Logging Reset', 'All logging configurations have been wiped and reset.')]
      });
    }

    if (sub === 'channel') {
      const category = options.getString('category');
      const target = options.getChannel('target');

      loggingManager.setChannel(guild.id, category, target.id);
      return interaction.reply({
        embeds: [EmbedGenerator.success('Channel Configured', `Category **${category.toUpperCase()}** logs will now be sent to ${target}.`)]
      });
    }
  }
};
