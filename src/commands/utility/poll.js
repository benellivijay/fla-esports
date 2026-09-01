const { SlashCommandBuilder } = require('discord.js');
const EmbedGenerator = require('../../utils/embed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Create an interactive community reaction poll')
    .addStringOption(opt => opt.setName('question').setDescription('Poll question').setRequired(true))
    .addStringOption(opt => opt.setName('option1').setDescription('First option').setRequired(true))
    .addStringOption(opt => opt.setName('option2').setDescription('Second option').setRequired(true))
    .addStringOption(opt => opt.setName('option3').setDescription('Third option').setRequired(false))
    .addStringOption(opt => opt.setName('option4').setDescription('Fourth option').setRequired(false)),

  async execute(interaction) {
    const question = interaction.options.getString('question');
    const options = [
      interaction.options.getString('option1'),
      interaction.options.getString('option2'),
      interaction.options.getString('option3'),
      interaction.options.getString('option4')
    ].filter(Boolean);

    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];
    const optionsText = options.map((opt, i) => `${emojis[i]} **${opt}**`).join('\n\n');

    const embed = EmbedGenerator.base()
      .setTitle(`📊 Poll: ${question}`)
      .setDescription(optionsText)
      .setFooter({ text: `Poll started by ${interaction.user.tag}` });

    const msg = await interaction.reply({ embeds: [embed], fetchReply: true });

    for (let i = 0; i < options.length; i++) {
      await msg.react(emojis[i]).catch(() => null);
    }
  }
};
