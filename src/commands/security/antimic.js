const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const { joinVoiceChannel, getVoiceConnection, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const micGuardManager = require('../../database/managers/MicGuardManager');
const micGuardEngine = require('../../antimic/MicGuardEngine');
const EmbedGenerator = require('../../utils/embed');

function buildMicGuardEmbed(guild) {
  const config = micGuardManager.getConfig(guild.id);
  const statusEmoji = config.enabled ? '🟢' : '🔴';
  const connection = getVoiceConnection(guild.id);
  const isGuarding = connection && connection.state.status !== VoiceConnectionStatus.Destroyed;

  return EmbedGenerator.base()
    .setTitle(`🎙️ Louder Mic & Earrape Guard — ${guild.name}`)
    .setDescription(
      `Protects your voice channels by **automatically detecting and disconnecting users who use modified louder mics, gain boosters, or earrape soundboards**, and sends them a formal warning DM.\n\n` +
      `**Guard Status:** ${statusEmoji} **${config.enabled ? 'Enabled' : 'Disabled'}**\n` +
      `**Sensitivity:** \`${(config.sensitivity || 'standard').toUpperCase()}\`\n` +
      `**Punishment:** \`Disconnect from Voice + Warning DM\`\n` +
      `**Active Voice Monitor:** ${isGuarding ? `🟢 Guarding <#${connection.joinConfig.channelId}>` : '⚪ Inactive (Join voice to start)'}\n\n` +
      `*Use the buttons below to toggle protection, change sensitivity, or have the bot join/leave your voice channel.*`
    );
}

function buildMicGuardComponents(guild) {
  const config = micGuardManager.getConfig(guild.id);
  const connection = getVoiceConnection(guild.id);
  const isGuarding = connection && connection.state.status !== VoiceConnectionStatus.Destroyed;

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('antimic_toggle_btn')
      .setLabel(config.enabled ? 'Disable Mic Guard' : 'Enable Mic Guard')
      .setStyle(config.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
      .setEmoji(config.enabled ? '🔴' : '🟢'),
    new ButtonBuilder()
      .setCustomId('antimic_join_btn')
      .setLabel(isGuarding ? 'Leave Voice' : 'Guard My Voice Channel')
      .setStyle(isGuarding ? ButtonStyle.Secondary : ButtonStyle.Primary)
      .setEmoji(isGuarding ? '🚪' : '🛡️'),
    new ButtonBuilder()
      .setCustomId('antimic_cycle_sens_btn')
      .setLabel(`Sensitivity: ${(config.sensitivity || 'standard').toUpperCase()}`)
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('⚙️')
  );

  return [row];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('antimic')
    .setDescription('Automatically disconnect users who use modified louder mics or earrape audio')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('status')
        .setDescription('View current louder mic guard dashboard and settings')
    )
    .addSubcommand(sub =>
      sub.setName('enable')
        .setDescription('Enable louder mic & earrape detection')
    )
    .addSubcommand(sub =>
      sub.setName('disable')
        .setDescription('Disable louder mic & earrape detection')
    )
    .addSubcommand(sub =>
      sub.setName('sensitivity')
        .setDescription('Configure mic detection sensitivity')
        .addStringOption(opt =>
          opt.setName('level')
            .setDescription('Sensitivity level')
            .setRequired(true)
            .addChoices(
              { name: 'High (Fastest detection for aggressive screaming / gain boosters)', value: 'high' },
              { name: 'Standard (Recommended balance)', value: 'standard' },
              { name: 'Lenient (Only triggers on extreme square-wave earrape)', value: 'lenient' }
            )
        )
    )
    .addSubcommand(sub =>
      sub.setName('join')
        .setDescription('Have the bot join your voice channel to actively guard and monitor audio')
    )
    .addSubcommand(sub =>
      sub.setName('leave')
        .setDescription('Disconnect the bot from the voice channel')
    ),

  buildMicGuardEmbed,
  buildMicGuardComponents,

  async execute(interaction) {
    const { guild, member, options } = interaction;
    const sub = options.getSubcommand();

    if (sub === 'status') {
      const embed = buildMicGuardEmbed(guild);
      const components = buildMicGuardComponents(guild);
      return interaction.reply({ embeds: [embed], components });
    }

    if (sub === 'enable' || sub === 'disable') {
      const newState = sub === 'enable' ? 1 : 0;
      micGuardManager.setEnabled(guild.id, newState);
      return interaction.reply({
        embeds: [EmbedGenerator.success('Mic Guard Updated', `Louder Mic & Earrape Guard is now **${newState ? 'ENABLED 🟢' : 'DISABLED 🔴'}**.`)]
      });
    }

    if (sub === 'sensitivity') {
      const level = options.getString('level');
      micGuardManager.setSensitivity(guild.id, level);
      return interaction.reply({
        embeds: [EmbedGenerator.success('Sensitivity Updated', `Louder Mic sensitivity set to **${level.toUpperCase()}**.`)]
      });
    }

    if (sub === 'join') {
      const voiceChannel = member.voice?.channel;
      if (!voiceChannel) {
        return interaction.reply({ content: '❌ You must join a voice channel first before activating Mic Guard.', ephemeral: true });
      }

      await interaction.deferReply();

      const connection = joinVoiceChannel({
        channelId: String(voiceChannel.id),
        guildId: String(guild.id),
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: true
      });

      try {
        await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
      } catch (e) {}

      micGuardEngine.attach(connection, guild, interaction.channel);

      return interaction.editReply({
        embeds: [
          EmbedGenerator.success(
            '🛡️ Voice Channel Guard Active',
            `Now actively monitoring **${voiceChannel.name}**.\n\n` +
            `• Anyone using a **modified louder mic, volume booster, or earrape soundboard** will be **instantly disconnected** and sent a warning DM.`
          )
        ]
      });
    }

    if (sub === 'leave') {
      const connection = getVoiceConnection(guild.id);
      if (connection) {
        connection.destroy();
        return interaction.reply({ embeds: [EmbedGenerator.success('Disconnected', 'Left voice channel. Voice Mic Guard is now in standby.')] });
      } else {
        return interaction.reply({ content: '❌ I am not in any voice channel in this server.', ephemeral: true });
      }
    }
  }
};
