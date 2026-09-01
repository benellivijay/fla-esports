const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const EmbedGenerator = require('../../utils/embed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Lock the current channel to prevent members from sending messages')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for locking the channel').setRequired(false)),

  async execute(interaction) {
    const channel = interaction.channel;
    const reason = interaction.options.getString('reason') || 'Channel locked by staff';

    try {
      await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
        SendMessages: false,
        AddReactions: false
      }, { reason });

      return interaction.reply({
        embeds: [EmbedGenerator.security('Channel Locked', `🔒 This channel has been locked.\n• **Reason:** ${reason}\n• **Moderator:** ${interaction.user}`)]
      });
    } catch (error) {
      return interaction.reply({
        embeds: [EmbedGenerator.error('Lock Failed', error.message)],
        ephemeral: true
      });
    }
  }
};
