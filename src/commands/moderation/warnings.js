const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const moderationManager = require('../../database/managers/ModerationManager');
const EmbedGenerator = require('../../utils/embed');
const TimeHelper = require('../../utils/time');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('View the warning history for a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(opt => opt.setName('target').setDescription('The member whose warnings to view').setRequired(true)),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('target');
    const warnings = moderationManager.getWarnings(interaction.guildId, targetUser.id);

    if (warnings.length === 0) {
      return interaction.reply({
        embeds: [EmbedGenerator.base().setTitle('Warning History').setDescription(`**${targetUser.tag}** has no active warnings.`)]
      });
    }

    const warningList = warnings
      .map((w, idx) => `**#${idx + 1}** (ID: \`${w.id}\`) - ${TimeHelper.discordTimestamp(w.created_at, 'R')}\n• **Reason:** ${w.reason}\n• **Moderator:** <@${w.moderator_id}>`)
      .join('\n\n');

    const embed = EmbedGenerator.base()
      .setTitle(`⚠️ Warnings for ${targetUser.tag} (${warnings.length})`)
      .setDescription(warningList);

    return interaction.reply({ embeds: [embed] });
  }
};
