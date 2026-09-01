const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const EmbedGenerator = require('../../utils/embed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addStringOption(opt => opt.setName('user_id').setDescription('The ID of the user to unban').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for the unban').setRequired(false)),

  async execute(interaction) {
    const userId = interaction.options.getString('user_id');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
      await interaction.guild.members.unban(userId, `${reason} | Unbanned by ${interaction.user.tag}`);
      return interaction.reply({
        embeds: [
          EmbedGenerator.success(
            'User Unbanned',
            `Successfully unbanned user ID \`${userId}\`.\n• **Reason:** ${reason}\n• **Moderator:** ${interaction.user}`
          )
        ]
      });
    } catch (error) {
      return interaction.reply({
        embeds: [EmbedGenerator.error('Unban Failed', `Could not unban user \`${userId}\`: ${error.message}`)],
        ephemeral: true
      });
    }
  }
};
