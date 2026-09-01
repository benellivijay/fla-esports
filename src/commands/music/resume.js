const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../../music/MusicManager');
const EmbedGenerator = require('../../utils/embed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Resume paused audio playback'),

  async execute(interaction) {
    const { guild } = interaction;
    if (!guild) return;

    const resumed = musicManager.resume(guild.id);
    if (!resumed) {
      return interaction.reply({ embeds: [EmbedGenerator.warn('Notice', 'Playback is not paused.')], ephemeral: true });
    }
    return interaction.reply({ embeds: [EmbedGenerator.success('Resumed', 'Resumed audio playback.')] });
  }
};
