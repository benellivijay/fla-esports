const { SlashCommandBuilder } = require('discord.js');
const EmbedGenerator = require('../../utils/embed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check bot websocket latency and API roundtrip response time'),

  async execute(interaction) {
    const sent = await interaction.reply({ content: '🏓 Pinging...', fetchReply: true });
    const latency = sent.createdTimestamp - interaction.createdTimestamp;
    const wsLatency = interaction.client.ws.ping;

    const embed = EmbedGenerator.base()
      .setTitle('🏓 Pong!')
      .addFields(
        { name: 'Gateway Latency', value: `\`${wsLatency}ms\``, inline: true },
        { name: 'Roundtrip API Time', value: `\`${latency}ms\``, inline: true }
      );

    return interaction.editReply({ content: null, embeds: [embed] });
  }
};
