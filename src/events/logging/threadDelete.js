const LogRouter = require('../../utils/LogRouter');
const EmbedGenerator = require('../../utils/embed');

module.exports = {
  name: 'threadDelete',
  async execute(thread) {
    const { guild, parent, name, id } = thread;
    if (!guild) return;

    const embed = EmbedGenerator.base()
      .setTitle('🗑️ Thread Deleted')
      .setColor(0xED4245)
      .addFields(
        { name: 'Thread Name', value: `\`${name}\` (\`${id}\`)`, inline: true },
        { name: 'Parent Channel', value: `${parent || 'Unknown'}`, inline: true }
      )
      .setTimestamp();

    await LogRouter.log(guild, 'message', 'thread_update', embed);
  }
};
