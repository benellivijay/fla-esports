const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../../music/MusicManager');
const EmbedGenerator = require('../../utils/embed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autoplay')
    .setDescription('Toggle or configure smart autoplay for related songs when queue ends')
    .addBooleanOption(opt =>
      opt.setName('enabled')
        .setDescription('Turn autoplay ON (true) or OFF (false)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const { guild, options } = interaction;
    if (!guild) return;

    const explicitState = options.getBoolean('enabled');
    const queue = musicManager.getQueue(guild.id);
    if (!queue) {
      return interaction.reply({
        embeds: [EmbedGenerator.warn('Notice', 'No active music queue in this server. Autoplay is enabled by default when you play a song.')],
        ephemeral: true
      });
    }

    const state = queue.toggleAutoplay(explicitState);
    return interaction.reply({
      embeds: [EmbedGenerator.success('Autoplay Updated', `Smart Autoplay is now: **${state ? '🟢 ON (Recommended)' : '🔴 OFF'}**`)]
    });
  }
};
