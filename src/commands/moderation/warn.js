const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const moderationManager = require('../../database/managers/ModerationManager');
const PermissionHelper = require('../../utils/permissions');
const EmbedGenerator = require('../../utils/embed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Issue a formal warning to a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(opt => opt.setName('target').setDescription('The member to warn').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for the warning').setRequired(true)),

  async execute(interaction) {
    const { guild, member: executorMember } = interaction;
    const targetUser = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason');

    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
    if (targetMember) {
      const check = PermissionHelper.canModerate(guild, executorMember, targetMember, PermissionFlagsBits.ModerateMembers);
      if (!check.allowed) {
        return interaction.reply({
          embeds: [EmbedGenerator.error('Cannot Warn Member', check.reason)],
          ephemeral: true
        });
      }
    }

    moderationManager.addWarning(guild.id, targetUser.id, interaction.user.id, reason);
    const warnings = moderationManager.getWarnings(guild.id, targetUser.id);

    // Try sending DM to user
    targetUser.send({
      embeds: [
        EmbedGenerator.warn(
          `Warning from ${guild.name}`,
          `You have received a warning in **${guild.name}**.\n• **Reason:** ${reason}\n• **Total Warnings:** ${warnings.length}`
        )
      ]
    }).catch(() => null);

    return interaction.reply({
      embeds: [
        EmbedGenerator.success(
          'Warning Issued',
          `Successfully warned **${targetUser.tag}** (\`${targetUser.id}\`).\n• **Reason:** ${reason}\n• **Total Active Warnings:** ${warnings.length}\n• **Moderator:** ${interaction.user}`
        )
      ]
    });
  }
};
