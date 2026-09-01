const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../../music/MusicManager');
const EmbedGenerator = require('../../utils/embed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Toggle track or queue loop mode')
    .addStringOption(opt =>
      opt.setName('mode')
        .setDescription('Loop mode')
        .setRequired(false)
        .addChoices(
          { name: 'Disabled', value: 'off' },
          { name: 'Current Track', value: 'track' },
          { name: 'Entire Queue', value: 'queue' }
        )
    ),

  async execute(interaction) {
    const { guild, options } = interaction;
    if (!guild) return;

    const queue = musicManager.getQueue(guild.id);
    if (!queue) {
      return interaction.reply({ embeds: [EmbedGenerator.warn('Notice', 'No active music queue in this server.')], ephemeral: true });
    }

    const explicitMode = options.getString('mode');
    let finalMode;
    if (explicitMode) {
      queue.loop = explicitMode === 'off' ? false : explicitMode;
      finalMode = queue.loop;
    } else {
      finalMode = queue.toggleLoop();
    }

    return interaction.reply({
      embeds: [EmbedGenerator.success('Loop Mode Updated', `Loop mode set to: **${finalMode ? finalMode.toUpperCase() : 'OFF'}**`)]
    });
  }
};
