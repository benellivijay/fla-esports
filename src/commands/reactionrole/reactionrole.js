const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  parseEmoji
} = require('discord.js');
const featureManager = require('../../database/managers/FeatureManager');
const EmbedGenerator = require('../../utils/embed');
const reactionRoleEditor = require('./ReactionRoleEditor');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reactionrole')
    .setDescription('Create and manage button reaction role panels')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(sub =>
      sub.setName('editor')
        .setDescription('Open the visual Reaction Role Embed & Button Editor')
    )
    .addSubcommand(sub =>
      sub.setName('panel')
        .setDescription('Open visual Reaction Role Panel Editor or send quick panel')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Optional: Channel to send panel in immediately')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
        .addStringOption(opt => opt.setName('title').setDescription('Optional: Panel title').setRequired(false))
        .addStringOption(opt => opt.setName('description').setDescription('Optional: Panel description').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Add a role button to an existing reaction role panel message')
        .addStringOption(opt => opt.setName('message_id').setDescription('Message ID of the panel').setRequired(true))
        .addRoleOption(opt => opt.setName('role').setDescription('Role to assign').setRequired(true))
        .addStringOption(opt => opt.setName('label').setDescription('Button text label').setRequired(true))
        .addStringOption(opt => opt.setName('emoji').setDescription('Button emoji (e.g. 🎮 or <:emoji:id>)').setRequired(false))
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Channel where the panel is located (optional)')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    ),

  async execute(interaction) {
    const { guild, options } = interaction;
    const sub = options.getSubcommand();
    const botMember = guild.members.me;

    // 1. Interactive Visual Editor
    if (sub === 'editor' || (sub === 'panel' && !options.getChannel('channel') && !options.getString('title'))) {
      const draft = reactionRoleEditor.getDraft(guild.id);
      const previewEmbed = reactionRoleEditor.formatPreview(guild, draft);
      const components = reactionRoleEditor.buildEditorComponents(guild.id);

      return interaction.reply({
        embeds: [previewEmbed],
        components,
        ephemeral: true
      });
    }

    // 2. Quick Panel creation
    if (sub === 'panel') {
      await interaction.deferReply({ ephemeral: true }).catch(() => null);

      const targetChannel = options.getChannel('channel') || interaction.channel;
      const title = options.getString('title') || 'Roles Menu';
      const description = options.getString('description') || 'Click the buttons below to receive or remove roles!';

      try {
        const embed = EmbedGenerator.base()
          .setTitle(title)
          .setDescription(description)
          .setFooter({ text: 'Click the buttons below to claim or remove roles' });

        const msg = await targetChannel.send({ embeds: [embed] });

        return interaction.editReply({
          embeds: [
            EmbedGenerator.success(
              'Reaction Role Panel Created',
              `✅ Panel successfully sent to ${targetChannel}!\n\n` +
              `📋 **Panel Message ID:** \`${msg.id}\`\n\n` +
              `👉 **Next Step:** Add buttons using:\n` +
              `\`/reactionrole add message_id:${msg.id} role:@Role label:RoleName\`\n` +
              `Or use \`/reactionrole editor\` to build panels with the visual editor!`
            )
          ]
        });
      } catch (err) {
        return interaction.editReply({
          embeds: [EmbedGenerator.error('Failed to Create Panel', `Could not send message to ${targetChannel}: ${err.message}`)]
        });
      }
    }

    // 3. Direct Add Subcommand
    if (sub === 'add') {
      await interaction.deferReply({ ephemeral: true }).catch(() => null);

      const messageId = options.getString('message_id').trim();
      const role = options.getRole('role');
      const label = options.getString('label');
      const emojiInput = options.getString('emoji')?.trim();
      const specifiedChannel = options.getChannel('channel');

      // Check Bot Hierarchy
      if (role.position >= botMember.roles.highest.position) {
        return interaction.editReply({
          embeds: [
            EmbedGenerator.error(
              'Hierarchy Error',
              `The role <@&${role.id}> is higher than or equal to my highest role (<@&${botMember.roles.highest.id}>). Please move my role higher in Server Settings → Roles.`
            )
          ]
        });
      }

      let targetMessage = null;
      let targetChannel = null;

      if (specifiedChannel) {
        targetMessage = await specifiedChannel.messages.fetch(messageId).catch(() => null);
        if (targetMessage) targetChannel = specifiedChannel;
      }

      if (!targetMessage && interaction.channel?.isTextBased()) {
        targetMessage = await interaction.channel.messages.fetch(messageId).catch(() => null);
        if (targetMessage) targetChannel = interaction.channel;
      }

      if (!targetMessage) {
        const existingRRs = featureManager.getReactionRoles(guild.id, messageId);
        if (existingRRs && existingRRs.length > 0 && existingRRs[0].channel_id) {
          const dbChannel = guild.channels.cache.get(existingRRs[0].channel_id);
          if (dbChannel?.isTextBased()) {
            targetMessage = await dbChannel.messages.fetch(messageId).catch(() => null);
            if (targetMessage) targetChannel = dbChannel;
          }
        }
      }

      if (!targetMessage) {
        const otherChannels = Array.from(guild.channels.cache.values())
          .filter(c => c.isTextBased() && c.id !== interaction.channelId && c.id !== specifiedChannel?.id);

        for (let i = 0; i < otherChannels.length; i += 10) {
          const chunk = otherChannels.slice(i, i + 10);
          const results = await Promise.all(
            chunk.map(async ch => {
              const m = await ch.messages.fetch(messageId).catch(() => null);
              return m ? { msg: m, channel: ch } : null;
            })
          );

          const found = results.find(r => r !== null);
          if (found) {
            targetMessage = found.msg;
            targetChannel = found.channel;
            break;
          }
        }
      }

      if (!targetMessage || !targetChannel) {
        return interaction.editReply({
          embeds: [
            EmbedGenerator.error(
              'Message Not Found',
              `Could not find message ID \`${messageId}\` in this server.\n\n` +
              `💡 **Tip:** Make sure you copied the correct Message ID, or specify the \`channel\` option in \`/reactionrole add\`.`
            )
          ]
        });
      }

      const customId = `rr_${role.id}`;
      featureManager.addReactionRole(guild.id, targetChannel.id, messageId, customId, role.id);

      let rows = targetMessage.components.map(c => ActionRowBuilder.from(c));
      if (rows.length === 0) {
        rows = [new ActionRowBuilder()];
      }

      const existingBtn = rows.some(r => r.components.some(b => b.data?.custom_id === customId));
      if (existingBtn) {
        return interaction.editReply({
          embeds: [
            EmbedGenerator.warn(
              'Button Already Exists',
              `A reaction button for <@&${role.id}> is already attached to this message.`
            )
          ]
        });
      }

      const newBtn = new ButtonBuilder()
        .setCustomId(customId)
        .setLabel(label)
        .setStyle(ButtonStyle.Secondary);

      if (emojiInput) {
        try {
          const parsed = parseEmoji(emojiInput);
          if (parsed && parsed.id) {
            newBtn.setEmoji(parsed.id);
          } else if (parsed && parsed.name) {
            newBtn.setEmoji(parsed.name);
          } else {
            newBtn.setEmoji(emojiInput);
          }
        } catch (emojiErr) {
          try { newBtn.setEmoji(emojiInput); } catch (_) {}
        }
      }

      let lastRow = rows[rows.length - 1];
      if (lastRow.components.length < 5) {
        lastRow.addComponents(newBtn);
      } else if (rows.length < 5) {
        const newRow = new ActionRowBuilder().addComponents(newBtn);
        rows.push(newRow);
      } else {
        return interaction.editReply({
          embeds: [EmbedGenerator.error('Button Limit Reached', 'This message already has the maximum of 25 buttons (5 rows of 5).')]
        });
      }

      try {
        await targetMessage.edit({ components: rows });
      } catch (editErr) {
        return interaction.editReply({
          embeds: [
            EmbedGenerator.error(
              'Failed to Update Message',
              `Could not add button to the message: ${editErr.message}\n` +
              `Make sure the bot has permission to edit the message.`
            )
          ]
        });
      }

      return interaction.editReply({
        embeds: [
          EmbedGenerator.success(
            'Role Button Added',
            `✅ Successfully attached button for <@&${role.id}> (\`${label}\`) to [Panel Message](${targetMessage.url}) in ${targetChannel}!`
          )
        ]
      });
    }
  }
};
