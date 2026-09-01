const { SlashCommandBuilder } = require('discord.js');
const EmbedGenerator = require('../../utils/embed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('Get user avatar image in high resolution')
    .addUserOption(opt => opt.setName('target').setDescription('User whose avatar to display').setRequired(false)),

  async execute(interaction) {
    const target = interaction.options.getUser('target') || interaction.user;
    const url = target.displayAvatarURL({ dynamic: true, size: 1024 });

    const embed = EmbedGenerator.base()
      .setTitle(`🖼️ Avatar for ${target.tag}`)
      .setImage(url)
      .setDescription(`[Direct Link](${url})`);

    return interaction.reply({ embeds: [embed] });
  }
};
