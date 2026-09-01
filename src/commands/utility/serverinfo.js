const { SlashCommandBuilder } = require('discord.js');
const EmbedGenerator = require('../../utils/embed');
const TimeHelper = require('../../utils/time');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Display comprehensive details and statistics about this server'),

  async execute(interaction) {
    const { guild } = interaction;
    await guild.members.fetch();

    const textChannels = guild.channels.cache.filter(c => c.isTextBased()).size;
    const voiceChannels = guild.channels.cache.filter(c => c.isVoiceBased()).size;
    const totalMembers = guild.memberCount;
    const humans = guild.members.cache.filter(m => !m.user.bot).size;
    const bots = guild.members.cache.filter(m => m.user.bot).size;

    const embed = EmbedGenerator.base()
      .setTitle(`🏰 ${guild.name}`)
      .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }))
      .addFields(
        { name: 'Owner', value: `<@${guild.ownerId}>`, inline: true },
        { name: 'Server ID', value: `\`${guild.id}\``, inline: true },
        { name: 'Created At', value: `${TimeHelper.discordTimestamp(guild.createdTimestamp, 'D')} (${TimeHelper.discordTimestamp(guild.createdTimestamp, 'R')})`, inline: false },
        { name: `Members (${totalMembers})`, value: `👤 **Humans:** ${humans}\n🤖 **Bots:** ${bots}`, inline: true },
        { name: 'Channels', value: `💬 **Text:** ${textChannels}\n🔊 **Voice:** ${voiceChannels}`, inline: true },
        { name: 'Security Tier', value: `🛡️ Verification: **${guild.verificationLevel}**\n✨ Nitro Boosts: **${guild.premiumSubscriptionCount || 0}** (Tier ${guild.premiumTier})`, inline: false },
        { name: 'Roles', value: `Total: **${guild.roles.cache.size}**`, inline: true },
        { name: 'Emojis & Stickers', value: `Emojis: **${guild.emojis.cache.size}** | Stickers: **${guild.stickers.cache.size}**`, inline: true }
      );

    if (guild.bannerURL()) {
      embed.setImage(guild.bannerURL({ size: 1024 }));
    }

    return interaction.reply({ embeds: [embed] });
  }
};
