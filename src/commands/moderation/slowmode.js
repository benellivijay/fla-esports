const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const TimeHelper = require('../../utils/time');
const EmbedGenerator = require('../../utils/embed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Set slowmode rate limit for the current channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addIntegerOption(opt =>
      opt.setName('seconds')
        .setDescription('Slowmode delay in seconds (0 to disable, max 21600 / 6 hours)')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(21600)
    ),

  async execute(interaction) {
    const seconds = interaction.options.getInteger('seconds');

    try {
      await interaction.channel.setRateLimitPerUser(seconds, `Slowmode set by ${interaction.user.tag}`);

      if (seconds === 0) {
        return interaction.reply({
          embeds: [EmbedGenerator.success('Slowmode Disabled', 'Slowmode has been deactivated for this channel.')]
        });
      }

      return interaction.reply({
        embeds: [EmbedGenerator.success('Slowmode Enabled', `Slowmode set to **${seconds} seconds** per user.`)]
      });
    } catch (error) {
      return interaction.reply({
        embeds: [EmbedGenerator.error('Slowmode Failed', error.message)],
        ephemeral: true
      });
    }
  }
};
