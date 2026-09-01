const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../../music/MusicManager');
const EmbedGenerator = require('../../utils/embed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Skip the currently playing song'),

  async execute(interaction) {
    const { guild } = interaction;
    if (!guild) return;

    const success = musicManager.skip(guild.id);
    if (!success) {
      return interaction.reply({ embeds: [EmbedGenerator.warn('Notice', 'No song is currently playing.')], ephemeral: true });
    }
    return interaction.reply({ embeds: [EmbedGenerator.success('Skipped', 'Skipped to the next track in queue.')] });
  }
};
