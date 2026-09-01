const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const EmbedGenerator = require('../../utils/embed');
const isBotOwner = require('../../utils/isBotOwner');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nuke')
    .setDescription('Recreate and completely wipe the current channel (Bot Owner only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    const isOwner = await isBotOwner(interaction.client, interaction.user.id);
    if (!isOwner) {
      return interaction.reply({
        embeds: [EmbedGenerator.error('Permission Denied', '❌ The `/nuke` command can only be accessed by the **Bot Owner**.')],
        ephemeral: true
      });
    }

    const channel = interaction.channel;
    const position = channel.position;
    const topic = channel.topic;
    const parent = channel.parent;

    await interaction.reply({ content: '💣 Nuking channel in 3 seconds...', ephemeral: true }).catch(() => null);

    setTimeout(async () => {
      try {
        const newChannel = await channel.clone({
          name: channel.name,
          reason: `Channel nuked by ${interaction.user.tag}`
        });

        await channel.delete(`Nuked by ${interaction.user.tag}`).catch(() => null);
        await newChannel.setPosition(position).catch(() => null);

        const embed = EmbedGenerator.security(
          'Channel Nuked',
          `💣 This channel has been completely recreated and wiped by ${interaction.user}.\n\n*⏳ This message will disappear in 5 seconds...*`
        );

        const nukeMsg = await newChannel.send({ embeds: [embed] }).catch(() => null);
        if (nukeMsg) {
          setTimeout(() => {
            nukeMsg.delete().catch(() => null);
          }, 5000);
        }
      } catch (err) {
        interaction.followUp({ content: `Failed to nuke channel: ${err.message}`, ephemeral: true }).catch(() => null);
      }
    }, 3000);
  }
};
