const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../../music/MusicManager');
const EmbedGenerator = require('../../utils/embed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('View current track queue'),

  async execute(interaction) {
    const { guild } = interaction;
    if (!guild) return;

    const queue = musicManager.getQueue(guild.id);
    if (!queue || (!queue.currentTrack && queue.queue.length === 0)) {
      return interaction.reply({ embeds: [EmbedGenerator.base().setTitle('🎵 Music Queue').setDescription('Queue is currently empty.')] });
    }

    let description = `**Now Playing:** [${queue.currentTrack?.title || 'None'}](${queue.currentTrack?.url || ''})\n\n`;
    if (queue.queue.length > 0) {
      description += '**Up Next:**\n' + queue.queue.slice(0, 10).map((t, idx) => `${idx + 1}. [${t.title}](${t.url}) (${t.duration})`).join('\n');
      if (queue.queue.length > 10) {
        description += `\n*...and ${queue.queue.length - 10} more tracks*`;
      }
    } else {
      description += '*No upcoming tracks in queue.*';
    }

    const embed = EmbedGenerator.base()
      .setTitle('🎵 Queue')
      .setDescription(description);

    return interaction.reply({ embeds: [embed] });
  }
};
