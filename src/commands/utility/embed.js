const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');
const EmbedGenerator = require('../../utils/embed');

// ── In-memory draft store ──────────────────────────────────────
// Map<guildId, { title, description, color, author_name, author_icon, author_url,
//                footer_text, footer_icon, thumbnail, image, content }>
const drafts = new Map();

function getDraft(guildId) {
  if (!drafts.has(guildId)) {
    drafts.set(guildId, {
      title: '',
      description: '',
      color: '#5865F2',
      author_name: '',
      author_icon: '',
      author_url: '',
      footer_text: '',
      footer_icon: '',
      thumbnail: '',
      image: '',
      content: ''
    });
  }
  return drafts.get(guildId);
}

function parseHexColor(colorStr, defaultColor = 0x5865F2) {
  if (!colorStr) return defaultColor;
  const clean = colorStr.replace('#', '').trim();
  const val = parseInt(clean, 16);
  return isNaN(val) ? defaultColor : val;
}

function parseImageUrl(url, guild) {
  if (!url) return null;
  const clean = url.trim();
  if (clean === '{server_icon}') return guild?.iconURL?.({ dynamic: true, size: 512 }) || null;
  if (/^https?:\/\//i.test(clean)) return clean;
  return null;
}

function buildPreviewEmbed(guild, draft) {
  const embed = new EmbedBuilder().setColor(parseHexColor(draft.color));

  if (draft.author_name) {
    embed.setAuthor({
      name: draft.author_name,
      iconURL: parseImageUrl(draft.author_icon, guild) || undefined,
      url: draft.author_url && /^https?:\/\//i.test(draft.author_url) ? draft.author_url : undefined
    });
  }

  if (draft.title) embed.setTitle(draft.title);
  if (draft.description) embed.setDescription(draft.description);

  const thumb = parseImageUrl(draft.thumbnail, guild);
  if (thumb) embed.setThumbnail(thumb);

  const img = parseImageUrl(draft.image, guild);
  if (img) embed.setImage(img);

  if (draft.footer_text) {
    embed.setFooter({
      text: draft.footer_text,
      iconURL: parseImageUrl(draft.footer_icon, guild) || undefined
    });
  }

  if (!draft.title && !draft.description && !draft.author_name) {
    embed.setDescription('*Your embed preview will appear here.*\nUse the buttons below to build your embed.');
  }

  return embed;
}

function buildEditorComponents() {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('embed_edit_basic')
      .setLabel('edit basic information (color / title / description)')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('✏️')
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('embed_edit_author')
      .setLabel('edit author')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('👤'),
    new ButtonBuilder()
      .setCustomId('embed_edit_footer')
      .setLabel('edit footer')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📑'),
    new ButtonBuilder()
      .setCustomId('embed_edit_images')
      .setLabel('edit images')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🖼️')
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('embed_send_modal')
      .setLabel('Send Embed')
      .setStyle(ButtonStyle.Success)
      .setEmoji('📨'),
    new ButtonBuilder()
      .setCustomId('embed_reset')
      .setLabel('Reset')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🗑️'),
    new ButtonBuilder()
      .setLabel('need help? join the support server!')
      .setStyle(ButtonStyle.Link)
      .setURL('https://discord.gg/mia')
  );

  return [row1, row2, row3];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Create and send a custom formatted embed')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  getDraft,
  buildPreviewEmbed,
  buildEditorComponents,

  async execute(interaction) {
    const { guild, member } = interaction;
    const draft = getDraft(guild.id);

    const preview = buildPreviewEmbed(guild, draft);
    const components = buildEditorComponents();

    return interaction.reply({
      embeds: [preview],
      components,
      ephemeral: false
    });
  }
};
