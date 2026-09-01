const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const PermissionHelper = require('../../utils/permissions');
const EmbedGenerator = require('../../utils/embed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption(opt => opt.setName('target').setDescription('The member to kick').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for the kick').setRequired(false)),

  async execute(interaction) {
    const { guild, member: executorMember } = interaction;
    const targetUser = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
    if (!targetMember) {
      return interaction.reply({
        embeds: [EmbedGenerator.error('Member Not Found', 'That user is not currently in this server.')],
        ephemeral: true
      });
    }

    // Pre-execution safety check
    const check = PermissionHelper.canModerate(guild, executorMember, targetMember, PermissionFlagsBits.KickMembers);
    if (!check.allowed) {
      return interaction.reply({
        embeds: [EmbedGenerator.error('Cannot Kick Member', check.reason)],
        ephemeral: true
      });
    }

    try {
      await targetMember.kick(`${reason} | Executed by ${interaction.user.tag}`);
      return interaction.reply({
        embeds: [
          EmbedGenerator.success(
            'Member Kicked',
            `Successfully kicked **${targetUser.tag}** (\`${targetUser.id}\`).\n• **Reason:** ${reason}\n• **Moderator:** ${interaction.user}`
          )
        ]
      });
    } catch (error) {
      return interaction.reply({
        embeds: [EmbedGenerator.error('Kick Failed', `An error occurred: ${error.message}`)],
        ephemeral: true
      });
    }
  }
};
