const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const moderationManager = require('../../database/managers/ModerationManager');
const EmbedGenerator = require('../../utils/embed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clearwarn')
    .setDescription('Clear warnings for a member or delete a specific warning by ID')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(opt => opt.setName('target').setDescription('The member whose warnings to clear').setRequired(false))
    .addIntegerOption(opt => opt.setName('warning_id').setDescription('Specific warning ID to delete').setRequired(false)),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('target');
    const warningId = interaction.options.getInteger('warning_id');

    if (!targetUser && !warningId) {
      return interaction.reply({
        embeds: [EmbedGenerator.error('Invalid Options', 'Please specify either a user `target` to clear all warnings, or a `warning_id` to delete a single warning.')],
        ephemeral: true
      });
    }

    if (warningId) {
      moderationManager.deleteWarning(interaction.guildId, warningId);
      return interaction.reply({
        embeds: [EmbedGenerator.success('Warning Removed', `Successfully deleted warning ID \`#${warningId}\`.`)]
      });
    }

    if (targetUser) {
      moderationManager.clearWarnings(interaction.guildId, targetUser.id);
      return interaction.reply({
        embeds: [EmbedGenerator.success('Warnings Cleared', `Successfully cleared all warnings for **${targetUser.tag}**.`)]
      });
    }
  }
};
