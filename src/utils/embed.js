const { EmbedBuilder } = require('discord.js');
const { COLORS, EMOJIS } = require('../config/constants');
const brandingManager = require('../database/managers/BrandingManager');

class EmbedGenerator {
  static base(guildOrId = null) {
    const guildId = typeof guildOrId === 'string' ? guildOrId : guildOrId?.id;
    const branding = brandingManager.getServerBranding(guildId);

    const embed = new EmbedBuilder()
      .setColor(branding?.embed_color || COLORS.PRIMARY)
      .setTimestamp()
      .setFooter({
        text: branding?.footer_text || '𝐌𝐢𝐚 ⚚ • Security & Operations',
        iconURL: branding?.footer_icon || undefined
      });

    return embed;
  }

  static success(title, description, guildOrId = null) {
    return this.base(guildOrId)
      .setTitle(`${EMOJIS.CHECK} ${title}`)
      .setDescription(description);
  }

  static error(title, description, guildOrId = null) {
    return this.base(guildOrId)
      .setColor(COLORS.DANGER)
      .setTitle(`${EMOJIS.CROSS} ${title}`)
      .setDescription(description);
  }

  static warn(title, description, guildOrId = null) {
    return this.base(guildOrId)
      .setColor(COLORS.WARNING)
      .setTitle(`${EMOJIS.WARN} ${title}`)
      .setDescription(description);
  }

  static security(title, description, guildOrId = null) {
    return this.base(guildOrId)
      .setColor(COLORS.SECURITY)
      .setTitle(`${EMOJIS.SHIELD} ${title}`)
      .setDescription(description);
  }

  static securityAlert({ executor, action, category, threshold, windowSeconds, punishment, target, details, guildId }) {
    const embed = this.base(guildId)
      .setColor(COLORS.DANGER)
      .setTitle(`${EMOJIS.ALERT} Antinuke Security Triggered!`)
      .setDescription(`An unauthorized or rapid high-risk action was intercepted and mitigated.`)
      .addFields(
        { name: '👤 Executor', value: `${executor?.tag || 'Unknown'} (\`${executor?.id || 'N/A'}\`)`, inline: true },
        { name: '⚡ Category', value: `\`${category}\``, inline: true },
        { name: '🔨 Punishment', value: `\`${punishment.toUpperCase()}\``, inline: true },
        { name: '📊 Trigger Limit', value: `${threshold} actions in ${windowSeconds}s`, inline: true },
        { name: '🎯 Target', value: target || 'Server Settings/Resource', inline: true },
        { name: '🛡️ Status', value: 'Mitigated & Executed', inline: true }
      );

    if (details) {
      embed.addFields({ name: '📝 Details', value: details, inline: false });
    }

    return embed;
  }
}

module.exports = EmbedGenerator;
