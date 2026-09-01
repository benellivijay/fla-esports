const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const PermissionHelper = require('../../utils/permissions');
const EmbedGenerator = require('../../utils/embed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('untimeout')
    .setDescription('Remove timeout (unmute) from a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(opt => opt.setName('target').setDescription('The member to remove timeout from').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for removing timeout').setRequired(false)),

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

    const check = PermissionHelper.canModerate(guild, executorMember, targetMember, PermissionFlagsBits.ModerateMembers);
    if (!check.allowed) {
      return interaction.reply({
        embeds: [EmbedGenerator.error('Cannot Untimeout Member', check.reason)],
        ephemeral: true
      });
    }

    try {
      await targetMember.timeout(null, `${reason} | Untimed out by ${interaction.user.tag}`);
      return interaction.reply({
        embeds: [
          EmbedGenerator.success(
            'Timeout Removed',
            `Successfully removed timeout from **${targetUser.tag}**.\n• **Reason:** ${reason}\n• **Moderator:** ${interaction.user}`
          )
        ]
      });
    } catch (error) {
      return interaction.reply({
        embeds: [EmbedGenerator.error('Untimeout Failed', error.message)],
        ephemeral: true
      });
    }
  }
};
