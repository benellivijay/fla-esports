const LogRouter = require('../../utils/LogRouter');
const EmbedGenerator = require('../../utils/embed');

module.exports = {
  name: 'threadCreate',
  async execute(thread) {
    const { guild, parent, name, id } = thread;
    if (!guild) return;

    const embed = EmbedGenerator.base()
      .setTitle('🧵 Thread Created')
      .setColor(0x57F287)
      .addFields(
        { name: 'Thread Name', value: `${thread} (\`${name}\`)`, inline: true },
        { name: 'Parent Channel', value: `${parent}`, inline: true },
        { name: 'Thread ID', value: `\`${id}\``, inline: true }
      )
      .setTimestamp();

    await LogRouter.log(guild, 'message', 'thread_update', embed);
  }
};
