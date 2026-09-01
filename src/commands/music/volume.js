const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../../music/MusicManager');
const EmbedGenerator = require('../../utils/embed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Adjust music playback volume')
    .addIntegerOption(opt =>
      opt.setName('percent')
        .setDescription('Volume level (0 - 200%)')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(200)
    ),

  async execute(interaction) {
    const { guild, options } = interaction;
    if (!guild) return;

    const percent = options.getInteger('percent');
    const success = musicManager.setVolume(guild.id, percent);
    if (!success) {
      return interaction.reply({ embeds: [EmbedGenerator.warn('Notice', 'No active music queue in this server.')], ephemeral: true });
    }
    return interaction.reply({ embeds: [EmbedGenerator.success('Volume Adjusted', `Volume set to **${percent}%**.`)] });
  }
};
