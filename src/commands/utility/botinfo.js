const { SlashCommandBuilder, version: djsVersion } = require('discord.js');
const EmbedGenerator = require('../../utils/embed');
const TimeHelper = require('../../utils/time');
const os = require('node:os');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('botinfo')
    .setDescription('Display information and metrics about Mia bot'),

  async execute(interaction) {
    const { client } = interaction;
    const uptime = TimeHelper.formatDuration(client.uptime);
    const memory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
    const totalGuilds = client.guilds.cache.size;
    const totalUsers = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);

    const embed = EmbedGenerator.base()
      .setTitle('🤖 Mia — Security & Multipurpose Bot')
      .setDescription('A high-performance Discord protection suite combining an advanced rolling Antinuke Limit Engine with full moderation, ticketing, music, giveaways, and utilities.')
      .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: '⚡ Core Systems', value: '• **Antinuke Engine** (Rolling Sliding-Window)\n• **Pre-execution Safety Checker**\n• **Bulk-ban Floor Role Mitigation**\n• **Automod Engine**\n• **Dual-Channel Audit Logging**', inline: false },
        { name: '📊 Statistics', value: `Servers: **${totalGuilds}**\nTotal Users: **${totalUsers.toLocaleString()}**\nUptime: **${uptime}**\nMemory: **${memory} MB**`, inline: true },
        { name: '🛠️ Environment', value: `Node.js: **${process.version}**\nDiscord.js: **v${djsVersion}**\nPlatform: **${os.type()} ${os.arch()}**`, inline: true }
      );

    return interaction.reply({ embeds: [embed] });
  }
};
