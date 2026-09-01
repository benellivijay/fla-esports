const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  parseEmoji
} = require('discord.js');
const featureManager = require('../../database/managers/FeatureManager');
const EmbedGenerator = require('../../utils/embed');

class ReactionRoleEditor {
  constructor() {
    // guildId -> draft state
    this.drafts = new Map();
  }

  getDraft(guildId) {
    if (!this.drafts.has(guildId)) {
      this.drafts.set(guildId, {
        title: 'Roles Menu',
        description: 'Click the buttons below to receive or remove roles!',
        color: '#5865F2',
        author_name: '',
        author_icon: '',
        author_url: '',
        footer_text: 'Mia Reaction Role System',
        footer_icon: '',
        thumbnail: '',
        image: '',
        buttons: [] // Array of { roleId, label, emoji, style }
      });
    }
    return this.drafts.get(guildId);
  }

  parseHexColor(colorStr, defaultColor = 0x5865F2) {
    if (!colorStr) return defaultColor;
    const clean = colorStr.replace('#', '').trim();
    const hexVal = parseInt(clean, 16);
    return isNaN(hexVal) ? defaultColor : hexVal;
  }

  formatPreview(guild, draft) {
    const embed = new EmbedBuilder();

    // Color
    embed.setColor(this.parseHexColor(draft.color));

    // Author
    if (draft.author_name) {
      embed.setAuthor({
        name: draft.author_name,
        iconURL: draft.author_icon && /^https?:\/\//i.test(draft.author_icon) ? draft.author_icon : (draft.author_icon === '{server_icon}' ? guild?.iconURL({ dynamic: true }) : undefined),
        url: draft.author_url && /^https?:\/\//i.test(draft.author_url) ? draft.author_url : undefined
      });
    }

    // Title
    if (draft.title) {
      embed.setTitle(draft.title);
    }

    // Description
    if (draft.description) {
      embed.setDescription(draft.description);
    }

    // Thumbnail
    if (draft.thumbnail) {
      const thumb = draft.thumbnail === '{server_icon}' ? guild?.iconURL({ dynamic: true }) : draft.thumbnail;
      if (thumb && /^https?:\/\//i.test(thumb)) embed.setThumbnail(thumb);
    }

    // Banner Image
    if (draft.image && /^https?:\/\//i.test(draft.image)) {
      embed.setImage(draft.image);
    }

    // Footer
    if (draft.footer_text) {
      embed.setFooter({
        text: draft.footer_text,
        iconURL: draft.footer_icon && /^https?:\/\//i.test(draft.footer_icon) ? draft.footer_icon : (draft.footer_icon === '{server_icon}' ? guild?.iconURL({ dynamic: true }) : undefined)
      });
    }

    return embed;
  }

  buildRoleButtonRows(draft) {
    const rows = [];
    const buttons = draft.buttons || [];

    for (let i = 0; i < buttons.length; i += 5) {
      const chunk = buttons.slice(i, i + 5);
      const row = new ActionRowBuilder();

      for (const btn of chunk) {
        const b = new ButtonBuilder()
          .setCustomId(`rr_${btn.roleId}`)
          .setLabel(btn.label || 'Role')
          .setStyle(btn.style || ButtonStyle.Secondary);

        if (btn.emoji) {
          try {
            const parsed = parseEmoji(btn.emoji);
            if (parsed && parsed.id) {
              b.setEmoji(parsed.id);
            } else if (parsed && parsed.name) {
              b.setEmoji(parsed.name);
            } else {
              b.setEmoji(btn.emoji);
            }
          } catch (e) {
            try { b.setEmoji(btn.emoji); } catch (_) {}
          }
        }
        row.addComponents(b);
      }
      rows.push(row);
    }

    return rows;
  }


  buildEditorComponents(guildId) {
    const draft = this.getDraft(guildId);
    const buttonCount = draft.buttons?.length || 0;

    // Row 1: Edit Basic Info (Full Width)
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('rr_edit_basic')
        .setLabel('edit basic information (color / title / description)')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('✏️')
    );

    // Row 2: Author, Footer, Images
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('rr_edit_author')
        .setLabel('edit author')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('👤'),
      new ButtonBuilder()
        .setCustomId('rr_edit_footer')
        .setLabel('edit footer')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📑'),
      new ButtonBuilder()
        .setCustomId('rr_edit_images')
        .setLabel('edit images')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🖼️')
    );

    // Row 3: Add Button, Clear Buttons, Send Panel
    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('rr_add_button_modal')
        .setLabel(`add role button (${buttonCount}/25)`)
        .setStyle(ButtonStyle.Primary)
        .setEmoji('➕')
        .setDisabled(buttonCount >= 25),
      new ButtonBuilder()
        .setCustomId('rr_clear_buttons')
        .setLabel('clear buttons')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🗑️')
        .setDisabled(buttonCount === 0),
      new ButtonBuilder()
        .setCustomId('rr_publish_panel')
        .setLabel('send panel to channel')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🚀')
    );

    return [row1, row2, row3];
  }
}

module.exports = new ReactionRoleEditor();
