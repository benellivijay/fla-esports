const LogRouter = require('../../utils/LogRouter');
const EmbedGenerator = require('../../utils/embed');

module.exports = {
  name: 'messageUpdate',
  async execute(oldMessage, newMessage) {
    if (!newMessage.guild || newMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return;

    const embed = EmbedGenerator.base()
      .setTitle('✏️ Message Edited')
      .setColor(0xFEE75C)
      .addFields(
        { name: 'Author', value: `${newMessage.author?.tag} (\`${newMessage.author?.id}\`)`, inline: true },
        { name: 'Channel', value: `${newMessage.channel} (\`${newMessage.channel.id}\`)`, inline: true },
        { name: 'Before', value: `\`\`\`${(oldMessage.cleanContent || '*No previous content*').slice(0, 800)}\`\`\`` },
        { name: 'After', value: `\`\`\`${(newMessage.cleanContent || '*Empty*').slice(0, 800)}\`\`\`` },
        { name: 'Jump to Message', value: `[Click Here](${newMessage.url})` }
      )
      .setTimestamp();

    await LogRouter.log(newMessage.guild, 'message', 'edits', embed);
  }
};
