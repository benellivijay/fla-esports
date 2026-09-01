const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const extraFeaturesManager = require('../../database/managers/ExtraFeaturesManager');
const EmbedGenerator = require('../../utils/embed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autoresponder')
    .setDescription('Create automated keyword reply triggers')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Add a new autoresponder keyword trigger')
        .addStringOption(opt => opt.setName('trigger').setDescription('Trigger keyword or phrase').setRequired(true))
        .addStringOption(opt => opt.setName('reply').setDescription('Automated response text').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove an autoresponder keyword trigger')
        .addStringOption(opt => opt.setName('trigger').setDescription('Trigger keyword to remove').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List all active autoresponder triggers for this server')
    ),

  async execute(interaction) {
    const { guild, options } = interaction;
    const sub = options.getSubcommand();

    if (sub === 'add') {
      const trigger = options.getString('trigger');
      const reply = options.getString('reply');

      extraFeaturesManager.addAutoresponder(guild.id, trigger, reply);

      return interaction.reply({
        embeds: [
          EmbedGenerator.success(
            'Autoresponder Added',
            `Created trigger for \`${trigger}\`.\n**Reply:**\n${reply}`
          )
        ]
      });
    }

    if (sub === 'remove') {
      const trigger = options.getString('trigger');
      extraFeaturesManager.removeAutoresponder(guild.id, trigger);

      return interaction.reply({
        embeds: [
          EmbedGenerator.success('Autoresponder Removed', `Removed trigger \`${trigger}\`.`)
        ]
      });
    }

    if (sub === 'list') {
      const list = extraFeaturesManager.getAutoresponders(guild.id);
      if (list.length === 0) {
        return interaction.reply({
          embeds: [EmbedGenerator.base().setTitle('🖤 Autoresponders').setDescription('No custom autoresponders configured.')]
        });
      }

      const formatted = list.map((a, i) => `**${i + 1}. \`${a.trigger}\`**\n  ↪ ${a.reply}`).join('\n\n');
      const embed = EmbedGenerator.base()
        .setTitle(`🖤 Server Autoresponders (${list.length})`)
        .setDescription(formatted);

      return interaction.reply({ embeds: [embed] });
    }
  }
};
