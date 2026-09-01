const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../../music/MusicManager');
const EmbedGenerator = require('../../utils/embed');
const { EMOJIS } = require('../../config/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('playnow')
    .setDescription('Immediately play a song or playlist right now (bypassing the queue)')
    .addStringOption(opt =>
      opt.setName('query')
        .setDescription('Song title, artist, Spotify URL, or YouTube URL')
        .setRequired(true)
    ),

  async execute(interaction) {
    const { guild, options } = interaction;
    if (!guild) {
      return interaction.reply({
        embeds: [EmbedGenerator.error('Server Only', 'This command can only be used in a server.')],
        ephemeral: true
      });
    }

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply().catch(() => null);
    }

    const query = options.getString('query');
    const result = await musicManager.playNow(interaction, query);

    if (!result.success) {
      return interaction.editReply({ embeds: [EmbedGenerator.error('Music Error', result.message)] });
    }

    if (result.isPlaylist) {
      const embed = EmbedGenerator.base()
        .setTitle(`🟢 Playing Spotify Playlist Now`)
        .setDescription(`[**${result.title}**](${query})\nPlaying **${result.track.title}** now and queued **${result.count - 1}** more songs.`)
        .addFields(
          { name: 'Total Tracks', value: `${result.count}`, inline: true },
          { name: 'Source', value: 'Spotify', inline: true }
        );
      return interaction.editReply({ embeds: [embed] });
    }

    const embed = EmbedGenerator.base()
      .setTitle(`${EMOJIS.MUSIC} Playing Now`)
      .setDescription(`[**${result.track.title}**](${result.track.url})`)
      .addFields(
        { name: 'Duration', value: result.track.duration || 'Live', inline: true },
        { name: 'Artist', value: result.track.author || 'Unknown', inline: true }
      );

    return interaction.editReply({ embeds: [embed] });
  }
};
