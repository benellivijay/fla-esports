const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  EmbedBuilder
} = require('discord.js');
const extraFeaturesManager = require('../../database/managers/ExtraFeaturesManager');
const EmbedGenerator = require('../../utils/embed');

const ALL_BUTTONS = [
  { id: 'vm_lock',      label: 'Lock',      emoji: '🔒', style: ButtonStyle.Secondary },
  { id: 'vm_unlock',    label: 'Unlock',    emoji: '🔓', style: ButtonStyle.Secondary },
  { id: 'vm_hide',      label: 'Hide',      emoji: '🙈', style: ButtonStyle.Secondary },
  { id: 'vm_reveal',    label: 'Reveal',    emoji: '👁️', style: ButtonStyle.Secondary },
  { id: 'vm_rename',    label: 'Rename',    emoji: '✏️', style: ButtonStyle.Secondary },
  { id: 'vm_limit',     label: 'Limit',     emoji: '👥', style: ButtonStyle.Secondary },
  { id: 'vm_mute',      label: 'Mute',      emoji: '🔇', style: ButtonStyle.Secondary },
  { id: 'vm_unmute',    label: 'Unmute',    emoji: '🎙️', style: ButtonStyle.Secondary },
  { id: 'vm_deafen',    label: 'Deafen',    emoji: '🔕', style: ButtonStyle.Secondary },
  { id: 'vm_undeafen',  label: 'Undeafen',  emoji: '🎧', style: ButtonStyle.Secondary },
  { id: 'vm_permit',    label: 'Permit',    emoji: '🔊', style: ButtonStyle.Secondary },
  { id: 'vm_ban',       label: 'Ban',       emoji: '🔨', style: ButtonStyle.Danger    },
  { id: 'vm_transfer',  label: 'Transfer',  emoji: '✈️', style: ButtonStyle.Secondary },
  { id: 'vm_claim',     label: 'Claim',     emoji: '👑', style: ButtonStyle.Primary   },
];

function buildInterfaceRows(selectedIds) {
  const ids = (!selectedIds || selectedIds.includes('all'))
    ? ALL_BUTTONS.map(b => b.id)
    : selectedIds;

  const buttons = ALL_BUTTONS
    .filter(b => ids.includes(b.id))
    .map(b =>
      new ButtonBuilder()
        .setCustomId(b.id)
        .setLabel(b.label)
        .setEmoji(b.emoji)
        .setStyle(b.style)
    );

  const rows = [];
  for (let i = 0; i < buttons.length && rows.length < 5; i += 5) {
    rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
  }
  return rows;
}

function buildVoiceMasterSetupEmbed() {
  return EmbedGenerator.base()
    .setTitle('🎙️ VoiceMaster Setup')
    .setDescription(
      'Select which control buttons you want to appear on the VoiceMaster control panel.\n\n' +
      'When done, select your desired buttons from the menu below.\n\n' +
      '*This will create a dedicated Voice Rooms category with an Interface text channel and a Join-to-Create voice channel.*'
    );
}

function buildVoiceMasterSetupComponents() {
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('vm_setup_select_buttons')
    .setPlaceholder('Select buttons to display on the interface panel...')
    .setMinValues(1)
    .setMaxValues(ALL_BUTTONS.length + 1)
    .addOptions(
      { label: 'All Buttons (Recommended)', value: 'all', description: 'Enable all 14 room management buttons', emoji: '⭐' },
      ...ALL_BUTTONS.map(b => ({
        label: b.label,
        value: b.id,
        emoji: b.emoji
      }))
    );

  return [new ActionRowBuilder().addComponents(selectMenu)];
}

function buildVoiceMasterInterfaceEmbed(enabledButtons = ['all']) {
  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🎙️ VoiceMaster Control Panel')
    .setDescription(
      'Welcome to your private temporary voice channel!\n\n' +
      'Use the interactive buttons below to manage your room permissions, user limits, visibility, and moderation:\n\n' +
      '• 🔒 **Lock / Unlock:** Control who can join\n' +
      '• 🙈 **Hide / Reveal:** Control room visibility\n' +
      '• ✏️ **Rename:** Change room name\n' +
      '• 👥 **Limit:** Set user capacity\n' +
      '• 🔇 **Mute / Deafen:** Moderate users\n' +
      '• 🔊 **Permit / Ban:** Allow or kick members\n' +
      '• 👑 **Claim / Transfer:** Manage room ownership'
    );
}

function buildVoiceMasterInterfaceComponents(enabledButtons = ['all']) {
  return buildInterfaceRows(enabledButtons);
}

async function executeVoiceMasterSetup(guild, selectedButtons = ['all']) {
  const existingConfig = extraFeaturesManager.getVoiceMasterConfig(guild.id);

  if (existingConfig && existingConfig.channel_id) {
    const existingCat = guild.channels.cache.get(existingConfig.category_id);
    const existingJoin = guild.channels.cache.get(existingConfig.channel_id);
    const existingInterface = guild.channels.cache.get(existingConfig.interface_channel_id);

    if (existingJoin && existingCat) {
      if (existingInterface) {
        const rows = buildInterfaceRows(selectedButtons);
        const embed = buildVoiceMasterInterfaceEmbed(selectedButtons);
        const msgs = await existingInterface.messages.fetch({ limit: 5 }).catch(() => null);
        const existingMsg = msgs?.find(m => m.author.id === guild.client.user.id && m.embeds.length > 0);
        if (existingMsg) {
          await existingMsg.edit({ embeds: [embed], components: rows }).catch(() => null);
        } else {
          await existingInterface.send({ embeds: [embed], components: rows }).catch(() => null);
        }
      }

      extraFeaturesManager.setVoiceMasterConfig(
        guild.id,
        existingConfig.category_id,
        existingConfig.channel_id,
        existingConfig.interface_channel_id,
        null,
        selectedButtons
      );

      return {
        category: existingCat,
        interfaceChannel: existingInterface || existingJoin,
        joinChannel: existingJoin,
        updated: true
      };
    }
  }

  // Create new VoiceMaster category & channels
  const category = await guild.channels.create({
    name: 'Voice Rooms',
    type: ChannelType.GuildCategory
  });

  const interfaceChannel = await guild.channels.create({
    name: '🎛️・interface',
    type: ChannelType.GuildText,
    parent: category.id,
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
        deny: [PermissionFlagsBits.SendMessages]
      }
    ]
  });

  const joinChannel = await guild.channels.create({
    name: '➕・Join to Create',
    type: ChannelType.GuildVoice,
    parent: category.id
  });

  const rows = buildInterfaceRows(selectedButtons);
  const embed = buildVoiceMasterInterfaceEmbed(selectedButtons);
  const panelMsg = await interfaceChannel.send({ embeds: [embed], components: rows });

  extraFeaturesManager.setVoiceMasterConfig(
    guild.id,
    category.id,
    joinChannel.id,
    interfaceChannel.id,
    panelMsg.id,
    selectedButtons
  );

  return {
    category,
    interfaceChannel,
    joinChannel,
    updated: false
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('voicemaster')
    .setDescription('Set up and manage dynamic Join-to-Create temporary voice channels')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addSubcommand(sub =>
      sub.setName('setup')
        .setDescription('Create and configure VoiceMaster Join-to-Create category & control panel')
    )
    .addSubcommand(sub =>
      sub.setName('buttons')
        .setDescription('Customize which control buttons appear on the VoiceMaster panel')
    ),

  ALL_BUTTONS,
  buildVoiceMasterSetupEmbed,
  buildVoiceMasterSetupComponents,
  buildVoiceMasterInterfaceEmbed,
  buildVoiceMasterInterfaceComponents,
  executeVoiceMasterSetup,

  async execute(interaction) {
    const { options } = interaction;
    const sub = options.getSubcommand();

    if (sub === 'setup' || sub === 'buttons') {
      const embed = buildVoiceMasterSetupEmbed();
      const components = buildVoiceMasterSetupComponents();
      return interaction.reply({ embeds: [embed], components, ephemeral: true });
    }
  }
};
