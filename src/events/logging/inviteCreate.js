const LogRouter = require('../../utils/LogRouter');
const EmbedGenerator = require('../../utils/embed');

module.exports = {
  name: 'inviteCreate',
  async execute(invite) {
    const { guild, inviter, code, maxUses, maxAge, channel } = invite;
    if (!guild) return;

    const embed = EmbedGenerator.base()
      .setTitle('🔗 Invite Link Created')
      .setColor(0x57F287)
      .addFields(
        { name: 'Invite Code', value: `\`${code}\``, inline: true },
        { name: 'Created By', value: inviter ? `${inviter.tag} (\`${inviter.id}\`)` : '*Unknown*', inline: true },
        { name: 'Target Channel', value: `${channel}`, inline: true },
        { name: 'Max Uses', value: maxUses === 0 ? 'Unlimited ♾️' : `${maxUses}`, inline: true },
        { name: 'Expires In', value: maxAge === 0 ? 'Never ♾️' : `<t:${Math.floor(Date.now() / 1000) + maxAge}:R>`, inline: true }
      )
      .setTimestamp();

    await LogRouter.log(guild, 'server', 'invite_update', embed);
  }
};
