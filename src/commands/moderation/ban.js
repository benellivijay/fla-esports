const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const PermissionHelper = require('../../utils/permissions');
const EmbedGenerator = require('../../utils/embed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(opt => opt.setName('target').setDescription('The user to ban').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for the ban').setRequired(false))
    .addIntegerOption(opt =>
      opt.setName('delete_messages')
        .setDescription('Days of message history to delete')
        .setRequired(false)
        .addChoices(
          { name: 'Don\'t delete any', value: 0 },
          { name: 'Previous 24 hours', value: 1 },
          { name: 'Previous 7 days', value: 7 }
        )
    ),

  async execute(interaction) {
    const { guild, member: executorMember } = interaction;
    const targetUser = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const deleteDays = interaction.options.getInteger('delete_messages') || 0;

    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

    // Pre-execution safety check
    const check = PermissionHelper.canModerate(guild, executorMember, targetMember, PermissionFlagsBits.BanMembers);
    if (!check.allowed) {
      return interaction.reply({
        embeds: [EmbedGenerator.error('Cannot Ban Member', check.reason)],
        ephemeral: true
      });
    }

    try {
      await guild.members.ban(targetUser.id, {
        reason: `${reason} | Executed by ${interaction.user.tag}`,
        deleteMessageSeconds: deleteDays * 24 * 60 * 60
      });

      return interaction.reply({
        embeds: [
          EmbedGenerator.success(
            'Member Banned',
            `Successfully banned **${targetUser.tag}** (\`${targetUser.id}\`).\n• **Reason:** ${reason}\n• **Moderator:** ${interaction.user}`
          )
        ]
      });
    } catch (error) {
      return interaction.reply({
        embeds: [EmbedGenerator.error('Ban Failed', `An error occurred: ${error.message}`)],
        ephemeral: true
      });
    }
  }
};
