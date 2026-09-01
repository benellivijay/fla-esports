const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const EmbedGenerator = require('../../utils/embed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Unlock the current channel to allow members to send messages')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for unlocking the channel').setRequired(false)),

  async execute(interaction) {
    const channel = interaction.channel;
    const reason = interaction.options.getString('reason') || 'Channel unlocked by staff';

    try {
      await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
        SendMessages: null,
        AddReactions: null
      }, { reason });

      return interaction.reply({
        embeds: [EmbedGenerator.success('Channel Unlocked', `🔓 This channel has been unlocked.\n• **Reason:** ${reason}\n• **Moderator:** ${interaction.user}`)]
      });
    } catch (error) {
      return interaction.reply({
        embeds: [EmbedGenerator.error('Unlock Failed', error.message)],
        ephemeral: true
      });
    }
  }
};
