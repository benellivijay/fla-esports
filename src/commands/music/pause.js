const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../../music/MusicManager');
const EmbedGenerator = require('../../utils/embed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pause audio playback'),

  async execute(interaction) {
    const { guild } = interaction;
    if (!guild) return;

    const paused = musicManager.pause(guild.id);
    if (!paused) {
      return interaction.reply({ embeds: [EmbedGenerator.warn('Notice', 'Nothing is playing or playback is already paused.')], ephemeral: true });
    }
    return interaction.reply({ embeds: [EmbedGenerator.success('Paused', 'Paused audio playback.')] });
  }
};
