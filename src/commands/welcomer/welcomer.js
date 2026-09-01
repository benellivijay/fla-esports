const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');
const featureManager = require('../../database/managers/FeatureManager');
const EmbedGenerator = require('../../utils/embed');

function parseTemplateText(text, guild, member) {
  if (!text) return '';
  const memberCount = guild.memberCount || 1;
  const user = member?.user || member;
  const userMention = member?.id ? `<@${member.id}>` : (user?.id ? `<@${user.id}>` : '@User');
  const username = user?.username || 'User';
  const tag = user?.tag || username;
  const serverName = guild?.name || 'Server';

  return String(text)
    .replace(/{user}/gi, userMention)
    .replace(/{username}/gi, username)
    .replace(/{tag}/gi, tag)
    .replace(/{server}/gi, serverName)
    .replace(/{membercount}/gi, memberCount.toString());
}

function parseImageUrl(url, guild, member) {
  if (!url) return null;
  const clean = url.trim();
  if (clean === '{avatar}') {
    const user = member?.user || member;
    return user?.displayAvatarURL?.({ dynamic: true, size: 512 }) || null;
  }
  if (clean === '{server_icon}') {
    return guild?.iconURL?.({ dynamic: true, size: 512 }) || null;
  }
  if (/^https?:\/\//i.test(clean)) {
    return clean;
  }
  return null;
}

function parseHexColor(colorStr, defaultColor = 0xED4245) {
  if (!colorStr) return defaultColor;
  const clean = colorStr.replace('#', '').trim();
  const hexVal = parseInt(clean, 16);
  return isNaN(hexVal) ? defaultColor : hexVal;
}

function formatWelcomePayload(guild, member, config) {
  const embedData = config?.embed_data || {};
  const user = member?.user || member;

  // 1. If custom embed is configured
  if (embedData && (embedData.title || embedData.description || embedData.content || embedData.image || embedData.author_name)) {
    const embed = new EmbedBuilder();

    // Color
    embed.setColor(parseHexColor(embedData.color));

    // Author
    if (embedData.author_name) {
      const authorName = parseTemplateText(embedData.author_name, guild, member);
      const authorIcon = parseImageUrl(embedData.author_icon, guild, member);
      const authorUrl = embedData.author_url && /^https?:\/\//i.test(embedData.author_url) ? embedData.author_url : null;
      embed.setAuthor({
        name: authorName,
        iconURL: authorIcon || undefined,
        url: authorUrl || undefined
      });
    }

    // Title & URL
    if (embedData.title) {
      embed.setTitle(parseTemplateText(embedData.title, guild, member));
      if (embedData.title_url && /^https?:\/\//i.test(embedData.title_url)) {
        embed.setURL(embedData.title_url);
      }
    }

    // Description
    if (embedData.description) {
      embed.setDescription(parseTemplateText(embedData.description, guild, member));
    }

    // Thumbnail
    if (embedData.thumbnail) {
      const thumb = parseImageUrl(embedData.thumbnail, guild, member);
      if (thumb) embed.setThumbnail(thumb);
    } else {
      // Default to member avatar if not explicitly empty
      if (embedData.thumbnail !== '') {
        const defaultAvatar = user?.displayAvatarURL?.({ dynamic: true, size: 512 });
        if (defaultAvatar) embed.setThumbnail(defaultAvatar);
      }
    }

    // Large Banner Image
    if (embedData.image) {
      const banner = parseImageUrl(embedData.image, guild, member);
      if (banner) embed.setImage(banner);
    }

    // Footer
    if (embedData.footer_text) {
      const footerText = parseTemplateText(embedData.footer_text, guild, member);
      const footerIcon = parseImageUrl(embedData.footer_icon, guild, member);
      embed.setFooter({
        text: footerText,
        iconURL: footerIcon || undefined
      });
    }

    const contentText = embedData.content ? parseTemplateText(embedData.content, guild, member) : undefined;

    return {
      content: contentText || null,
      embeds: [embed]
    };
  }

  // 2. Fallback: Standard Clean Embed
  const rawMsg = config?.message || 'Welcome {user} to **{server}**! We now have {membercount} members.';
  const parsedMsg = parseTemplateText(rawMsg, guild, member);

  const embed = EmbedGenerator.base()
    .setTitle(`🎉 Welcome to ${guild.name}!`)
    .setDescription(parsedMsg);

  if (user?.displayAvatarURL) {
    embed.setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }));
  }

  return {
    content: null,
    embeds: [embed]
  };
}

function buildWelcomerEditorComponents(guild) {
  const config = featureManager.getWelcomerConfig(guild.id);

  // Row 1: Basic Info Button (Full Width)
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('welcomer_edit_basic')
      .setLabel('edit basic information (color / title / description)')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('✏️')
  );

  // Row 2: Author, Footer, Images
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('welcomer_edit_author')
      .setLabel('edit author')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('👤'),
    new ButtonBuilder()
      .setCustomId('welcomer_edit_footer')
      .setLabel('edit footer')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📑'),
    new ButtonBuilder()
      .setCustomId('welcomer_edit_images')
      .setLabel('edit images')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🖼️')
  );

  // Row 3: Actions & Support
  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('welcomer_toggle_btn')
      .setLabel(config.enabled ? 'Enabled 🟢' : 'Disabled 🔴')
      .setStyle(config.enabled ? ButtonStyle.Success : ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('welcomer_test_btn')
      .setLabel('Test Greeting')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🧪'),
    new ButtonBuilder()
      .setLabel('need help? join the support server!')
      .setStyle(ButtonStyle.Link)
      .setURL('https://discord.gg/mia')
  );

  return [row1, row2, row3];
}

function buildWelcomerConfigEmbed(guild) {
  const config = featureManager.getWelcomerConfig(guild.id);
  const statusEmoji = config.enabled ? '🟢' : '🔴';

  return EmbedGenerator.base()
    .setTitle(`🚪 Welcomer Dashboard — ${guild.name}`)
    .setDescription(
      `Customize your server's welcome messages, interactive embeds, channels, and auto-roles.\n\n` +
      `**Status:** ${statusEmoji} **${config.enabled ? 'Enabled' : 'Disabled'}**\n` +
      `**Welcome Channel:** ${config.channel_id ? `<#${config.channel_id}>` : '*Not Set*'}\n` +
      `**Human Auto-Role:** ${config.auto_role_id ? `<@&${config.auto_role_id}>` : '*None*'}\n` +
      `**Bot Auto-Role:** ${config.bot_auto_role_id ? `<@&${config.bot_auto_role_id}>` : '*None*'}\n\n` +
      `Use the buttons below to open the **Embed Editor**, edit variables, test greetings, or toggle the system.`
    );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('welcomer')
    .setDescription('Configure interactive welcome embeds, greeting messages, and auto-roles')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('editor')
        .setDescription('Open the visual Welcome Embed Editor')
    )
    .addSubcommand(sub =>
      sub.setName('config')
        .setDescription('View current welcomer configuration dashboard')
    )
    .addSubcommand(sub =>
      sub.setName('channel')
        .setDescription('Set the welcome message channel')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Text channel for welcome messages')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('message')
        .setDescription('Open Welcome Message Editor or set custom template')
        .addStringOption(opt =>
          opt.setName('content')
            .setDescription('Optional: Template with {user}, {server}, {membercount}')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('autorole')
        .setDescription('Set automatic role given to new members or bots on join')
        .addRoleOption(opt => opt.setName('role').setDescription('Role to assign').setRequired(true))
        .addStringOption(opt =>
          opt.setName('target_type')
            .setDescription('Target: humans or bots')
            .setRequired(false)
            .addChoices(
              { name: 'Humans', value: 'human' },
              { name: 'Bots', value: 'bot' }
            )
        )
    )
    .addSubcommand(sub =>
      sub.setName('toggle')
        .setDescription('Enable or disable the welcomer system')
        .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable/Disable').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('test')
        .setDescription('Send a test welcome message in the current channel')
    ),

  parseTemplateText,
  parseImageUrl,
  parseHexColor,
  formatWelcomePayload,
  buildWelcomerEditorComponents,
  buildWelcomerConfigEmbed,

  async execute(interaction) {
    const { guild, member, options } = interaction;
    const sub = options.getSubcommand();
    const config = featureManager.getWelcomerConfig(guild.id);

    if (sub === 'editor' || sub === 'config' || sub === 'message') {
      const msg = options.getString('content');
      if (msg) {
        featureManager.setWelcomerMessage(guild.id, msg);
        const embedData = config.embed_data || {};
        embedData.description = msg;
        featureManager.setWelcomerEmbedData(guild.id, embedData);
      }

      const updatedConfig = featureManager.getWelcomerConfig(guild.id);
      const payload = formatWelcomePayload(guild, member, updatedConfig);
      const components = buildWelcomerEditorComponents(guild);

      return interaction.reply({
        content: payload.content || null,
        embeds: payload.embeds,
        components
      });
    }

    if (sub === 'channel') {
      const channel = options.getChannel('channel');
      featureManager.setWelcomerChannel(guild.id, channel.id);
      return interaction.reply({
        embeds: [EmbedGenerator.success('Welcome Channel Set', `Welcome greetings will be sent to ${channel}.`)]
      });
    }

    if (sub === 'autorole') {
      const role = options.getRole('role');
      const isBot = options.getString('target_type') === 'bot';
      featureManager.setWelcomerAutoRole(guild.id, role.id, isBot);

      return interaction.reply({
        embeds: [
          EmbedGenerator.success(
            'Auto-Role Configured',
            `New ${isBot ? 'bots' : 'human members'} will automatically receive <@&${role.id}> upon joining.`
          )
        ]
      });
    }

    if (sub === 'toggle') {
      const enabled = options.getBoolean('enabled');
      featureManager.setWelcomerEnabled(guild.id, enabled ? 1 : 0);
      return interaction.reply({
        embeds: [EmbedGenerator.success('Welcomer Updated', `Welcomer system is now **${enabled ? 'ENABLED 🟢' : 'DISABLED 🔴'}**.`)]
      });
    }

    if (sub === 'test') {
      const targetChannelId = config.channel_id;
      if (!targetChannelId) {
        return interaction.reply({
          embeds: [EmbedGenerator.error('No Channel Set', 'No welcome channel is configured. Use `/welcomer channel` to set one first.')],
          ephemeral: true
        });
      }

      const targetChannel = guild.channels.cache.get(targetChannelId);
      if (!targetChannel) {
        return interaction.reply({
          embeds: [EmbedGenerator.error('Channel Not Found', `The configured welcome channel <#${targetChannelId}> no longer exists. Please set a new one with \`/welcomer channel\`.`)],
          ephemeral: true
        });
      }

      await interaction.deferReply({ ephemeral: true });
      const payload = formatWelcomePayload(guild, member, config);
      await targetChannel.send({
        content: payload.content || null,
        embeds: payload.embeds
      });

      return interaction.editReply({
        embeds: [EmbedGenerator.success('Test Sent!', `Test welcome message sent to ${targetChannel}.`)]
      });
    }
  }
};
