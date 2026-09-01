const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../../music/MusicManager');
const EmbedGenerator = require('../../utils/embed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Show information about the currently playing song'),

  async execute(interaction) {
    const { guild } = interaction;
    if (!guild) return;

    const queue = musicManager.getQueue(guild.id);
    if (!queue || !queue.currentTrack) {
      return interaction.reply({ embeds: [EmbedGenerator.warn('Notice', 'No track is currently playing.')], ephemeral: true });
    }

    const embed = queue.buildNowPlayingEmbed(queue.currentTrack);
    const components = queue.buildControllerComponents(queue.audioPlayer.state.status === 'paused');

    return interaction.reply({ embeds: [embed], components });
  }
};
