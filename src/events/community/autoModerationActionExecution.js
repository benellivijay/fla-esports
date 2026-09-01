const featureManager = require('../../database/managers/FeatureManager');
const antinukeManager = require('../../database/managers/AntinukeManager');
const EmbedGenerator = require('../../utils/embed');
const Logger = require('../../utils/logger');
const { EMOJIS } = require('../../config/constants');

const TRIGGER_TYPE_NAMES = {
  1: 'Keyword Match',
  2: 'Harmful Content (Preset)',
  3: 'Suspected Spam',
  4: 'Keyword Preset',
  5: 'Mention Spam',
  6: 'Member Profile Content'
};

const ACTION_TYPE_NAMES = {
  1: 'Block Message',
  2: 'Send Alert Message',
  3: 'Timeout User',
  4: 'Block Member Interaction'
};

module.exports = {
  name: 'autoModerationActionExecution',
  async execute(actionExecution) {
    const { guild, channel, user, action, ruleTriggerType, matchedKeyword, matchedContent, ruleId } = actionExecution;
    if (!guild) return;

    Logger.info(`[DISCORD AUTOMOD] Rule ${ruleId} triggered by ${user?.tag || user?.id} in #${channel?.name || 'unknown'}: ${matchedKeyword || matchedContent}`);

    // Check Security / General log channels
    const logConfig = featureManager.getLoggingConfig(guild.id);
    const antinukeConfig = antinukeManager.getConfig(guild.id);
    const targetChannelId = antinukeConfig?.log_channel_id || logConfig?.antinuke_channel_id || logConfig?.general_channel_id;

    if (!targetChannelId) return;

    const targetChannel = guild.channels.cache.get(targetChannelId);
    if (!targetChannel || !targetChannel.isTextBased()) return;

    const triggerName = TRIGGER_TYPE_NAMES[ruleTriggerType] || `Trigger Type ${ruleTriggerType}`;
    const actionName = ACTION_TYPE_NAMES[action?.type] || `Action Type ${action?.type || 'Default'}`;

    const embed = EmbedGenerator.base()
      .setTitle(`${EMOJIS.SHIELD} Discord AutoMod Violation`)
      .setDescription(`Discord native AutoMod intercepted an action in **${guild.name}**.`)
      .addFields(
        { name: '👤 Offender', value: user ? `${user.tag} (\`${user.id}\`)` : '*Unknown User*', inline: true },
        { name: '📍 Channel', value: channel ? `${channel} (\`${channel.id}\`)` : '*N/A*', inline: true },
        { name: '⚡ Rule Trigger', value: `\`${triggerName}\``, inline: true },
        { name: '🔨 Action Taken', value: `\`${actionName}\``, inline: true },
        { name: '🆔 Rule ID', value: `\`${ruleId}\``, inline: true }
      );

    if (matchedKeyword) {
      embed.addFields({ name: '🔍 Matched Keyword', value: `\`${matchedKeyword}\``, inline: true });
    }

    if (matchedContent) {
      embed.addFields({ name: '📝 Message Snippet', value: `\`\`\`${matchedContent.slice(0, 1000)}\`\`\`` });
    }

    // Check if user is whitelisted/owner (to alert staff if false positive)
    if (user && (guild.ownerId === user.id || antinukeManager.isExtraOwner(guild.id, user.id) || antinukeManager.isWhitelisted(guild.id, user.id))) {
      embed.addFields({ name: '⚠️ Exemption Notice', value: 'This user is a server owner or whitelisted admin!' });
    }

    await targetChannel.send({ embeds: [embed] }).catch(err => {
      Logger.error(`Failed to send Discord AutoMod log: ${err.message}`);
    });
  }
};
