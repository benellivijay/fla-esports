const { SlashCommandBuilder } = require('discord.js');
const EmbedGenerator = require('../../utils/embed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('banner')
    .setDescription('Get user or server banner image')
    .addUserOption(opt => opt.setName('user').setDescription('User whose banner to get').setRequired(false))
    .addBooleanOption(opt => opt.setName('server').setDescription('Get server banner instead').setRequired(false)),

  async execute(interaction) {
    const isServer = interaction.options.getBoolean('server');
    const targetUser = interaction.options.getUser('user') || interaction.user;

    if (isServer) {
      const bannerUrl = interaction.guild.bannerURL({ size: 1024 });
      if (!bannerUrl) {
        return interaction.reply({
          embeds: [EmbedGenerator.warn('No Banner', 'This server does not have a banner set.')],
          ephemeral: true
        });
      }

      const embed = EmbedGenerator.base()
        .setTitle(`🏰 Banner for ${interaction.guild.name}`)
        .setImage(bannerUrl)
        .setDescription(`[Direct Link](${bannerUrl})`);

      return interaction.reply({ embeds: [embed] });
    }

    const fetchedUser = await interaction.client.users.fetch(targetUser.id, { force: true });
    const bannerUrl = fetchedUser.bannerURL({ size: 1024 });

    if (!bannerUrl) {
      return interaction.reply({
        embeds: [EmbedGenerator.warn('No Banner', `**${targetUser.tag}** does not have a custom profile banner.`)],
        ephemeral: true
      });
    }

    const embed = EmbedGenerator.base()
      .setTitle(`🖼️ Banner for ${targetUser.tag}`)
      .setImage(bannerUrl)
      .setDescription(`[Direct Link](${bannerUrl})`);

    return interaction.reply({ embeds: [embed] });
  }
};
