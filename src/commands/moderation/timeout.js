const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const PermissionHelper = require('../../utils/permissions');
const TimeHelper = require('../../utils/time');
const EmbedGenerator = require('../../utils/embed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout (mute) a member in the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(opt => opt.setName('target').setDescription('The member to timeout').setRequired(true))
    .addStringOption(opt =>
      opt.setName('duration')
        .setDescription('Duration of timeout (e.g. 5m, 1h, 1d, max 28d)')
        .setRequired(true)
    )
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for timeout').setRequired(false)),

  async execute(interaction) {
    const { guild, member: executorMember } = interaction;
    const targetUser = interaction.options.getUser('target');
    const durationInput = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    const durationMs = TimeHelper.parseDuration(durationInput);
    if (!durationMs || durationMs < 5000 || durationMs > 28 * 24 * 60 * 60 * 1000) {
      return interaction.reply({
        embeds: [EmbedGenerator.error('Invalid Duration', 'Duration must be between 5 seconds and 28 days (e.g. `10m`, `2h`, `7d`).')],
        ephemeral: true
      });
    }

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
        embeds: [EmbedGenerator.error('Cannot Timeout Member', check.reason)],
        ephemeral: true
      });
    }

    try {
      await targetMember.timeout(durationMs, `${reason} | Timeout by ${interaction.user.tag}`);
      return interaction.reply({
        embeds: [
          EmbedGenerator.success(
            'Member Timed Out',
            `Successfully timed out **${targetUser.tag}** for **${TimeHelper.formatDuration(durationMs)}**.\n• **Reason:** ${reason}\n• **Moderator:** ${interaction.user}`
          )
        ]
      });
    } catch (error) {
      return interaction.reply({
        embeds: [EmbedGenerator.error('Timeout Failed', error.message)],
        ephemeral: true
      });
    }
  }
};
