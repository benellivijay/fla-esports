const LogRouter = require('../../utils/LogRouter');
const EmbedGenerator = require('../../utils/embed');

module.exports = {
  name: 'emojiUpdate',
  async execute(oldEmoji, newEmoji) {
    const { guild } = newEmoji;
    if (!guild) return;

    if (oldEmoji.name !== newEmoji.name) {
      const embed = EmbedGenerator.base()
        .setTitle('✏️ Emoji Name Changed')
        .setColor(0xFEE75C)
        .setThumbnail(newEmoji.url)
        .addFields(
          { name: 'Emoji', value: `${newEmoji}`, inline: true },
          { name: 'Old Name', value: `\`:${oldEmoji.name}:\``, inline: true },
          { name: 'New Name', value: `\`:${newEmoji.name}:\``, inline: true }
        )
        .setTimestamp();

      await LogRouter.log(guild, 'server', 'emoji_update', embed);
    }
  }
};
