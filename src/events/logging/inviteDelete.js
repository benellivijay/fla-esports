const LogRouter = require('../../utils/LogRouter');
const EmbedGenerator = require('../../utils/embed');

module.exports = {
  name: 'inviteDelete',
  async execute(invite) {
    const { guild, code, channel } = invite;
    if (!guild) return;

    const embed = EmbedGenerator.base()
      .setTitle('🗑️ Invite Link Deleted')
      .setColor(0xED4245)
      .addFields(
        { name: 'Invite Code', value: `\`${code}\``, inline: true },
        { name: 'Channel', value: `${channel || 'Unknown'}`, inline: true }
      )
      .setTimestamp();

    await LogRouter.log(guild, 'server', 'invite_update', embed);
  }
};
