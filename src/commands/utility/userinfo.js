const { SlashCommandBuilder } = require('discord.js');
const EmbedGenerator = require('../../utils/embed');
const TimeHelper = require('../../utils/time');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Display detailed information about a server member')
    .addUserOption(opt => opt.setName('target').setDescription('User to inspect').setRequired(false)),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('target') || interaction.user;
    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    const embed = EmbedGenerator.base()
      .setTitle(`👤 ${targetUser.tag}`)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        { name: 'User ID', value: `\`${targetUser.id}\``, inline: true },
        { name: 'Bot Account', value: targetUser.bot ? 'Yes' : 'No', inline: true },
        { name: 'Account Created', value: `${TimeHelper.discordTimestamp(targetUser.createdTimestamp, 'D')} (${TimeHelper.discordTimestamp(targetUser.createdTimestamp, 'R')})`, inline: false }
      );

    if (member) {
      const roles = member.roles.cache
        .filter(r => r.id !== interaction.guildId)
        .sort((a, b) => b.position - a.position)
        .map(r => `<@&${r.id}>`);

      embed.addFields(
        { name: 'Joined Server', value: `${TimeHelper.discordTimestamp(member.joinedTimestamp, 'D')} (${TimeHelper.discordTimestamp(member.joinedTimestamp, 'R')})`, inline: false },
        { name: `Roles (${roles.length})`, value: roles.slice(0, 15).join(', ') || 'No roles' }
      );
    }

    return interaction.reply({ embeds: [embed] });
  }
};
