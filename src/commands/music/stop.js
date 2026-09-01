const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../../music/MusicManager');
const antinukeManager = require('../../database/managers/AntinukeManager');
const isBotOwner = require('../../utils/isBotOwner');
const EmbedGenerator = require('../../utils/embed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop music playback, clear queue, and leave voice channel'),

  async execute(interaction) {
    const { guild, user } = interaction;
    if (!guild) return;

    const isServerOwner = guild.ownerId === user.id;
    const isExtraOwner = antinukeManager.isExtraOwner(guild.id, user.id);
    const isBotOwnerUser = isBotOwner(user.id);

    if (!isServerOwner && !isExtraOwner && !isBotOwnerUser) {
      return interaction.reply({
        embeds: [EmbedGenerator.error('Permission Denied', 'Only the **Server Owner**, **Extra Owner**, or **Bot Owner** can stop the music session.')],
        ephemeral: true
      });
    }

    const success = musicManager.stop(guild.id);
    if (!success) {
      return interaction.reply({ embeds: [EmbedGenerator.warn('Notice', 'Bot is not active in a voice channel.')], ephemeral: true });
    }
    return interaction.reply({ embeds: [EmbedGenerator.success('Playback Stopped', 'Queue cleared and left voice channel.')] });
  }
};
