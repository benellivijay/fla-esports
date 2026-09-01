const LogRouter = require('../../utils/LogRouter');
const EmbedGenerator = require('../../utils/embed');

module.exports = {
  name: 'messageDeleteBulk',
  async execute(messages, channel) {
    if (!channel.guild) return;

    const authors = new Set();
    messages.forEach(msg => {
      if (msg.author) authors.add(msg.author.tag);
    });

    const authorsList = Array.from(authors).slice(0, 10).join(', ') + (authors.size > 10 ? ` and ${authors.size - 10} more` : '');

    const embed = EmbedGenerator.base()
      .setTitle('🧹 Messages Bulk Purged')
      .setColor(0xED4245)
      .addFields(
        { name: 'Channel', value: `${channel} (\`${channel.id}\`)`, inline: true },
        { name: 'Count', value: `**${messages.size}** messages`, inline: true },
        { name: 'Authors Affected', value: authorsList || '*Unknown authors*', inline: false }
      )
      .setFooter({ text: `Purge Log • Total Messages: ${messages.size}` })
      .setTimestamp();

    await LogRouter.log(channel.guild, 'message', 'purges', embed);
  }
};
