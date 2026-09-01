const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../../music/MusicManager');
const EmbedGenerator = require('../../utils/embed');
const { EMOJIS } = require('../../config/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a song or playlist from Spotify, YouTube, or SoundCloud')
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
    const result = await musicManager.play(interaction, query);

    if (!result.success) {
      return interaction.editReply({ embeds: [EmbedGenerator.error('Music Error', result.message)] });
    }

    if (result.isPlaylist) {
      const embed = EmbedGenerator.base()
        .setTitle(`🟢 Added Spotify Playlist to Queue`)
        .setDescription(`[**${result.title}**](${query})\nQueued **${result.count}** songs into the music queue.`)
        .addFields(
          { name: 'Total Tracks', value: `${result.count}`, inline: true },
          { name: 'Source', value: 'Spotify', inline: true }
        );
      return interaction.editReply({ embeds: [embed] });
    }

    const embed = EmbedGenerator.base()
      .setTitle(`${EMOJIS.MUSIC} Added to Queue`)
      .setDescription(`[**${result.track.title}**](${result.track.url})`)
      .addFields(
        { name: 'Position', value: `#${result.position}`, inline: true },
        { name: 'Duration', value: result.track.duration || 'Live', inline: true }
      );

    return interaction.editReply({ embeds: [embed] });
  }
};
