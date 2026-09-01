const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../../music/MusicManager');
const EmbedGenerator = require('../../utils/embed');
const { EMOJIS } = require('../../config/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('music')
    .setDescription('Voice channel audio player and music controls')
    .addSubcommand(sub =>
      sub.setName('play')
        .setDescription('Play a song or YouTube URL in your voice channel')
        .addStringOption(opt => opt.setName('query').setDescription('Song title or URL to search and play').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('skip')
        .setDescription('Skip the currently playing track')
    )
    .addSubcommand(sub =>
      sub.setName('stop')
        .setDescription('Stop playback, clear queue, and leave voice channel')
    )
    .addSubcommand(sub =>
      sub.setName('pause')
        .setDescription('Pause audio playback')
    )
    .addSubcommand(sub =>
      sub.setName('resume')
        .setDescription('Resume paused audio playback')
    )
    .addSubcommand(sub =>
      sub.setName('queue')
        .setDescription('View current track queue')
    )
    .addSubcommand(sub =>
      sub.setName('nowplaying')
        .setDescription('Show info about the currently playing song')
    )
    .addSubcommand(sub =>
      sub.setName('volume')
        .setDescription('Adjust playback volume')
        .addIntegerOption(opt => opt.setName('percent').setDescription('Volume (0 - 200%)').setRequired(true).setMinValue(0).setMaxValue(200))
    )
    .addSubcommand(sub =>
      sub.setName('loop')
        .setDescription('Toggle repeat mode')
        .addStringOption(opt =>
          opt.setName('mode')
            .setDescription('Loop mode')
            .setRequired(true)
            .addChoices(
              { name: 'Disabled', value: 'off' },
              { name: 'Current Track', value: 'track' },
              { name: 'Entire Queue', value: 'queue' }
            )
        )
    ),

  async execute(interaction) {
    const { guild, options } = interaction;
    if (!guild) {
      return interaction.reply({
        embeds: [EmbedGenerator.error('Server Only', 'This command can only be used in a server.')],
        ephemeral: true
      });
    }

    const sub = options.getSubcommand();
    const queue = musicManager.getQueue(guild.id);

    if (sub === 'play') {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply().catch(() => null);
      }
      const query = options.getString('query');
      const result = await musicManager.play(interaction, query);

      if (!result.success) {
        return interaction.editReply({ embeds: [EmbedGenerator.error('Music Error', result.message)] });
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

    if (sub === 'skip') {
      const success = musicManager.skip(guild.id);
      if (!success) {
        return interaction.reply({ embeds: [EmbedGenerator.warn('Notice', 'No song is currently playing.')], ephemeral: true });
      }
      return interaction.reply({ embeds: [EmbedGenerator.success('Skipped', 'Skipped to the next track in queue.')] });
    }

    if (sub === 'stop') {
      const success = musicManager.stop(guild.id);
      if (!success) {
        return interaction.reply({ embeds: [EmbedGenerator.warn('Notice', 'Bot is not active in a voice channel.')], ephemeral: true });
      }
      return interaction.reply({ embeds: [EmbedGenerator.success('Playback Stopped', 'Queue cleared and left voice channel.')] });
    }

    if (sub === 'pause') {
      const paused = musicManager.pause(guild.id);
      if (!paused) {
        return interaction.reply({ embeds: [EmbedGenerator.warn('Notice', 'Nothing is playing or already paused.')], ephemeral: true });
      }
      return interaction.reply({ embeds: [EmbedGenerator.success('Paused', 'Paused audio playback.')] });
    }

    if (sub === 'resume') {
      const resumed = musicManager.resume(guild.id);
      if (!resumed) {
        return interaction.reply({ embeds: [EmbedGenerator.warn('Notice', 'Playback is not paused.')], ephemeral: true });
      }
      return interaction.reply({ embeds: [EmbedGenerator.success('Resumed', 'Resumed audio playback.')] });
    }

    if (sub === 'queue') {
      if (!queue || (!queue.currentTrack && queue.queue.length === 0)) {
        return interaction.reply({ embeds: [EmbedGenerator.base().setTitle('Music Queue').setDescription('Queue is currently empty.')] });
      }

      let description = `**Now Playing:** [${queue.currentTrack.title}](${queue.currentTrack.url})\n\n`;
      if (queue.queue.length > 0) {
        description += '**Up Next:**\n' + queue.queue.slice(0, 10).map((t, idx) => `${idx + 1}. [${t.title}](${t.url}) (${t.duration})`).join('\n');
        if (queue.queue.length > 10) {
          description += `\n*...and ${queue.queue.length - 10} more tracks*`;
        }
      }

      const embed = EmbedGenerator.base()
        .setTitle('🎵 Queue')
        .setDescription(description);

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'nowplaying') {
      if (!queue || !queue.currentTrack) {
        return interaction.reply({ embeds: [EmbedGenerator.warn('Notice', 'No track is currently playing.')], ephemeral: true });
      }

      const embed = EmbedGenerator.base()
        .setTitle('🎵 Now Playing')
        .setDescription(`[**${queue.currentTrack.title}**](${queue.currentTrack.url})`)
        .addFields(
          { name: 'Duration', value: queue.currentTrack.duration || 'Live', inline: true },
          { name: 'Loop', value: queue.loop ? `\`${queue.loop}\`` : 'Off', inline: true },
          { name: 'Volume', value: `${queue.volume}%`, inline: true }
        );

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'volume') {
      const percent = options.getInteger('percent');
      musicManager.setVolume(guild.id, percent);
      return interaction.reply({ embeds: [EmbedGenerator.success('Volume Adjusted', `Volume set to **${percent}%**.`)] });
    }

    if (sub === 'loop') {
      const mode = options.getString('mode');
      musicManager.setLoop(guild.id, mode === 'off' ? false : mode);
      return interaction.reply({ embeds: [EmbedGenerator.success('Loop Mode Updated', `Loop mode set to **${mode.toUpperCase()}**.`)] });
    }
  }
};
