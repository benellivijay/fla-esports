const LogRouter = require('../../utils/LogRouter');
const EmbedGenerator = require('../../utils/embed');

module.exports = {
  name: 'messageDelete',
  async execute(message) {
    if (!message.guild || message.author?.bot) return;

    const embed = EmbedGenerator.base()
      .setTitle('🗑️ Message Deleted')
      .setColor(0xED4245)
      .addFields(
        { name: 'Author', value: `${message.author?.tag || 'Unknown'} (\`${message.author?.id || 'N/A'}\`)`, inline: true },
        { name: 'Channel', value: `${message.channel} (\`${message.channel.id}\`)`, inline: true }
      )
      .setTimestamp();

    if (message.cleanContent) {
      embed.addFields({ name: 'Content', value: `\`\`\`${message.cleanContent.slice(0, 1000)}\`\`\`` });
    }

    if (message.attachments.size > 0) {
      embed.addFields({
        name: 'Attachments',
        value: Array.from(message.attachments.values()).map(a => a.name || a.url).join(', ')
      });
    }

    await LogRouter.log(message.guild, 'message', 'deletes', embed);
  }
};
