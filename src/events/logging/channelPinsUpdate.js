const LogRouter = require('../../utils/LogRouter');
const EmbedGenerator = require('../../utils/embed');

module.exports = {
  name: 'channelPinsUpdate',
  async execute(channel, time) {
    if (!channel.guild) return;

    const embed = EmbedGenerator.base()
      .setTitle('📌 Message Pin Updated')
      .setColor(0x5865F2)
      .setDescription(`A message pin was added or removed in ${channel}.`)
      .addFields(
        { name: 'Channel', value: `${channel} (\`${channel.id}\`)`, inline: true },
        { name: 'Timestamp', value: `<t:${Math.floor(new Date(time).getTime() / 1000)}:R>`, inline: true }
      )
      .setTimestamp();

    await LogRouter.log(channel.guild, 'message', 'pins', embed);
  }
};
