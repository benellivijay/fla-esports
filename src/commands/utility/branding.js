const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits
} = require('discord.js');
const brandingManager = require('../../database/managers/BrandingManager');
const isBotOwner = require('../../utils/isBotOwner');
const EmbedGenerator = require('../../utils/embed');
const Logger = require('../../utils/logger');

function buildServerBrandingEmbed(guild) {
  const branding = brandingManager.getServerBranding(guild?.id);
  const guildName = guild ? guild.name : 'Unknown Server';

  const embedColor = branding.embed_color || '#FF0000';
  const botThumb = branding.thumbnail_url ? `[Configured](${branding.thumbnail_url})` : '*Not configured*';
  const botBanner = branding.banner_url ? `[Configured](${branding.banner_url})` : '*Not configured*';
  const footerText = branding.footer_text || '𝐌𝐢𝐚 ⚚ • Security & Operations';
  const descText = branding.description_text ? `\`${branding.description_text}\`` : '*Not configured*';
  const authorName = branding.author_name || '𝐌𝐢𝐚 ⚚';

  const embed = new EmbedBuilder()
    .setColor(embedColor)
    .setTitle('🖤 𝐌𝐢𝐚 ⚚ // SERVER BRANDING')
    .setDescription(
      `🎨 Customize the appearance of 𝐌𝐢𝐚 ⚚ for **${guildName}**.\n\n` +
      `**Current Branding**\n` +
      `-------------------------\n\n` +
      `🏷️ **Server Name:** ${guildName}\n` +
      `🎨 **Embed Color:** \`${embedColor}\`\n` +
      `🖼️ **Bot Thumbnail:** ${botThumb}\n` +
      `🏙️ **Bot Banner:** ${botBanner}\n` +
      `📝 **Footer:** \`${footerText}\`\n` +
      `📝 **Description:** ${descText}\n` +
      `👤 **Author:** \`${authorName}\`\n\n` +
      `-------------------------\n\n` +
      `*Select an option below to open the interactive editor or preview appearance for this server.*`
    )
    .setFooter({ text: footerText, iconURL: branding.footer_icon || undefined })
    .setTimestamp();

  if (branding.thumbnail_url) {
    embed.setThumbnail(branding.thumbnail_url);
  }

  return embed;
}

function buildServerBrandingComponents() {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('branding_btn_color')
      .setLabel('Color')
      .setEmoji('🎨')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('branding_btn_description')
      .setLabel('Description')
      .setEmoji('🖌️')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('branding_btn_author')
      .setLabel('Author')
      .setEmoji('👤')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('branding_btn_images')
      .setLabel('Images')
      .setEmoji('🖼️')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('branding_btn_footer')
      .setLabel('Footer')
      .setEmoji('📝')
      .setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('branding_btn_preview')
      .setLabel('Preview')
      .setEmoji('👁️')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('branding_btn_reset')
      .setLabel('Reset')
      .setEmoji('🔄')
      .setStyle(ButtonStyle.Danger)
  );

  return [row1, row2];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('branding')
    .setDescription('Customize bot appearance and server branding dashboard (Bot Owner Only)')
    // Subcommand: panel (Interactive Visual Dashboard for this server)
    .addSubcommand(sub =>
      sub.setName('panel')
        .setDescription('Open the visual Server Branding editor panel')
    )
    // Subcommand: view
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('View current bot branding, status, activity, and specs')
    )
    // Subcommand: status
    .addSubcommand(sub =>
      sub.setName('status')
        .setDescription('Change the bot online status')
        .addStringOption(opt =>
          opt.setName('state')
            .setDescription('Online presence status')
            .setRequired(true)
            .addChoices(
              { name: '🟢 Online', value: 'online' },
              { name: '🌙 Idle', value: 'idle' },
              { name: '⛔ Do Not Disturb (DND)', value: 'dnd' },
              { name: ' Invisible / Offline', value: 'invisible' }
            )
        )
    )
    // Subcommand: activity
    .addSubcommand(sub =>
      sub.setName('activity')
        .setDescription('Change the bot rich presence activity')
        .addStringOption(opt =>
          opt.setName('type')
            .setDescription('Activity type')
            .setRequired(true)
            .addChoices(
              { name: 'Watching', value: 'Watching' },
              { name: 'Playing', value: 'Playing' },
              { name: 'Listening', value: 'Listening' },
              { name: 'Competing', value: 'Competing' },
              { name: 'Streaming', value: 'Streaming' }
            )
        )
        .addStringOption(opt =>
          opt.setName('text')
            .setDescription('Activity status text (e.g. /antinuke | Mia Security)')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('stream_url')
            .setDescription('Twitch or YouTube streaming URL (Required if type is Streaming)')
            .setRequired(false)
        )
    )
    // Subcommand: avatar
    .addSubcommand(sub =>
      sub.setName('avatar')
        .setDescription('Change the bot global avatar / profile picture')
        .addAttachmentOption(opt =>
          opt.setName('image')
            .setDescription('Upload an image file (PNG/JPG/GIF)')
            .setRequired(false)
        )
        .addStringOption(opt =>
          opt.setName('url')
            .setDescription('Direct image URL')
            .setRequired(false)
        )
    )
    // Subcommand: username
    .addSubcommand(sub =>
      sub.setName('username')
        .setDescription('Change the bot global username (Discord limits apply)')
        .addStringOption(opt =>
          opt.setName('name')
            .setDescription('New bot username')
            .setRequired(true)
        )
    )
    // Subcommand: nickname
    .addSubcommand(sub =>
      sub.setName('nickname')
        .setDescription('Change or reset the bot server nickname')
        .addStringOption(opt =>
          opt.setName('nick')
            .setDescription('New nickname (leave blank to reset)')
            .setRequired(false)
        )
    )
    // Subcommand: reset
    .addSubcommand(sub =>
      sub.setName('reset')
        .setDescription('Reset all bot branding for this server to default settings')
    ),

  buildServerBrandingEmbed,
  buildServerBrandingComponents,

  async execute(interaction) {
    const { client, user, guild, options } = interaction;

    // Strict Bot Owner Check
    const isOwner = await isBotOwner(client, user.id);
    if (!isOwner) {
      return interaction.reply({
        embeds: [
          EmbedGenerator.error(
            'Access Denied',
            '❌ The **Branding** system is strictly restricted to the **Bot Owner**.'
          )
        ],
        ephemeral: true
      });
    }

    const sub = options.getSubcommand(false) || 'panel';

    // 1. Interactive Server Branding Panel (Matches user design)
    if (sub === 'panel') {
      const embed = buildServerBrandingEmbed(guild);
      const components = buildServerBrandingComponents();
      return interaction.reply({ embeds: [embed], components });
    }

    // 2. View Branding
    if (sub === 'view') {
      const branding = brandingManager.getBranding();
      const sBranding = brandingManager.getServerBranding(guild?.id);

      const statusEmoji = {
        online: '🟢 Online',
        idle: '🌙 Idle',
        dnd: '⛔ Do Not Disturb',
        invisible: ' Invisible'
      }[branding.status || 'online'] || '🟢 Online';

      const embed = EmbedGenerator.base(guild?.id)
        .setTitle('🎨 Bot Branding & Appearance')
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 256 }))
        .addFields(
          { name: '🤖 Bot Username', value: `\`${client.user.tag}\` (${client.user.id})`, inline: true },
          { name: '📡 Online Status', value: statusEmoji, inline: true },
          { name: '🎭 Activity Type', value: `\`${branding.activity_type}\``, inline: true },
          { name: '📝 Activity Text', value: `\`${branding.activity_text}\``, inline: false },
          { name: '🔗 Stream URL', value: branding.stream_url ? `[Link](${branding.stream_url})` : '*None*', inline: true },
          { name: '🏠 Server Embed Color', value: `\`${sBranding.embed_color}\``, inline: true },
          { name: '📝 Server Footer', value: `\`${sBranding.footer_text}\``, inline: false }
        )
        .setFooter({ text: 'Bot Owner Appearance Control Panel' });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // 3. Change Status
    if (sub === 'status') {
      const state = options.getString('state');
      brandingManager.setBranding({ status: state });
      brandingManager.applyPresence(client);

      const statusName = {
        online: '🟢 Online',
        idle: '🌙 Idle',
        dnd: '⛔ Do Not Disturb',
        invisible: ' Invisible'
      }[state] || state;

      return interaction.reply({
        embeds: [EmbedGenerator.success('Status Updated', `Bot online presence status set to **${statusName}**.`)]
      });
    }

    // 4. Change Activity Presence
    if (sub === 'activity') {
      const type = options.getString('type');
      const text = options.getString('text');
      const streamUrl = options.getString('stream_url');

      if (type === 'Streaming' && !streamUrl) {
        return interaction.reply({
          embeds: [EmbedGenerator.error('Missing Stream URL', 'You must provide a valid Twitch or YouTube `stream_url` when using Streaming activity.')],
          ephemeral: true
        });
      }

      brandingManager.setBranding({
        activity_type: type,
        activity_text: text,
        stream_url: streamUrl || null
      });
      brandingManager.applyPresence(client);

      return interaction.reply({
        embeds: [
          EmbedGenerator.success(
            'Activity Presence Updated',
            `🎭 **Type:** \`${type}\`\n` +
            `📝 **Text:** \`${text}\`\n` +
            (streamUrl ? `🔗 **Stream:** [URL](${streamUrl})\n` : '')
          )
        ]
      });
    }

    // 5. Change Avatar
    if (sub === 'avatar') {
      const attachment = options.getAttachment('image');
      const url = options.getString('url');
      const targetUrl = attachment?.url || url;

      if (!targetUrl) {
        return interaction.reply({
          embeds: [EmbedGenerator.error('Missing Image', 'Please provide an image attachment or direct image URL.')],
          ephemeral: true
        });
      }

      await interaction.deferReply();
      try {
        await client.user.setAvatar(targetUrl);
        return interaction.editReply({
          embeds: [
            EmbedGenerator.success(
              'Avatar Updated Successfully',
              '✨ The bot avatar has been updated globally across Discord!'
            ).setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 256 }))
          ]
        });
      } catch (err) {
        Logger.error(`Failed to set avatar: ${err.message}`);
        return interaction.editReply({
          embeds: [
            EmbedGenerator.error(
              'Avatar Update Failed',
              `Discord API Error: \`${err.message}\`\n\n*Note: Discord enforces rate limits on bot avatar changes (maximum 2 changes per 10 minutes).*`
            )
          ]
        });
      }
    }

    // 6. Change Username
    if (sub === 'username') {
      const newName = options.getString('name').trim();
      if (!newName || newName.length < 2 || newName.length > 32) {
        return interaction.reply({
          embeds: [EmbedGenerator.error('Invalid Username', 'Username must be between 2 and 32 characters.')],
          ephemeral: true
        });
      }

      await interaction.deferReply();
      try {
        await client.user.setUsername(newName);
        return interaction.editReply({
          embeds: [EmbedGenerator.success('Username Updated', `✨ Bot username changed to **${client.user.tag}**.`)]
        });
      } catch (err) {
        Logger.error(`Failed to set username: ${err.message}`);
        return interaction.editReply({
          embeds: [
            EmbedGenerator.error(
              'Username Update Failed',
              `Discord API Error: \`${err.message}\`\n\n*Note: Discord limits bot username changes to twice per hour.*`
            )
          ]
        });
      }
    }

    // 7. Change Nickname in Guild
    if (sub === 'nickname') {
      if (!guild) {
        return interaction.reply({ embeds: [EmbedGenerator.error('Guild Required', 'This subcommand must be run inside a server.')], ephemeral: true });
      }

      const nick = options.getString('nick')?.trim() || null;
      try {
        await guild.members.me.setNickname(nick);
        return interaction.reply({
          embeds: [EmbedGenerator.success('Nickname Updated', nick ? `Bot nickname in this server set to **${nick}**.` : 'Bot nickname reset to default.')]
        });
      } catch (err) {
        return interaction.reply({
          embeds: [EmbedGenerator.error('Nickname Update Failed', `Failed to update nickname: ${err.message}`)],
          ephemeral: true
        });
      }
    }

    // 8. Reset Branding
    if (sub === 'reset') {
      if (guild) {
        brandingManager.resetServerBranding(guild.id);
        await guild.members.me?.setNickname(null).catch(() => null);
      }

      return interaction.reply({
        embeds: [EmbedGenerator.success('Branding Reset', `Bot branding for **${guild?.name || 'this server'}** has been reset to default.`)]
      });
    }
  }
};
