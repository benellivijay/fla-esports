const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const EmbedGenerator = require('../../utils/embed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Bulk delete messages from the current channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(opt =>
      opt.setName('amount')
        .setDescription('Number of messages to delete (1-100)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    )
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('Only delete messages sent by this user')
        .setRequired(false)
    ),

  async execute(interaction) {
    const amount = interaction.options.getInteger('amount');
    const targetUser = interaction.options.getUser('user');
    const channel = interaction.channel;

    await interaction.deferReply({ ephemeral: true });

    try {
      const messages = await channel.messages.fetch({ limit: targetUser ? 100 : amount });
      let filtered = messages;

      if (targetUser) {
        filtered = messages.filter(m => m.author.id === targetUser.id);
        const limited = Array.from(filtered.values()).slice(0, amount);
        const deleted = await channel.bulkDelete(limited, true);
        return interaction.editReply({
          embeds: [EmbedGenerator.success('Purge Complete', `Deleted **${deleted.size}** messages from **${targetUser.tag}**.`)]
        });
      } else {
        const deleted = await channel.bulkDelete(filtered, true);
        return interaction.editReply({
          embeds: [EmbedGenerator.success('Purge Complete', `Deleted **${deleted.size}** messages.`)]
        });
      }
    } catch (err) {
      return interaction.editReply({
        embeds: [EmbedGenerator.error('Purge Failed', `Could not delete messages: ${err.message}`)]
      });
    }
  }
};
