const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  AutoModerationRuleEventType,
  AutoModerationRuleTriggerType,
  AutoModerationActionType,
  AutoModerationRuleKeywordPresetType
} = require('discord.js');
const moderationManager = require('../../database/managers/ModerationManager');
const EmbedGenerator = require('../../utils/embed');
const Logger = require('../../utils/logger');

function buildAutomodSetupEmbed(guild) {
  const config = moderationManager.getAutomodConfig(guild.id);

  const getStatus = enabled => (enabled ? '✅' : '❌');

  const description = [
    `${getStatus(config.antispam)} : Anti spam`,
    `${getStatus(config.anticaps)} : Anti caps`,
    `${getStatus(config.antilink)} : Anti link`,
    `${getStatus(config.antiinvite)} : Anti invites`,
    `${getStatus(config.antimention)} : Anti mass mention`,
    `${getStatus(config.antiemojispam)} : Anti emoji spam`,
    `${getStatus(config.antinsfw)} : Anti NSFW link`
  ].join('\n');

  const embed = EmbedGenerator.base()
    .setAuthor({ name: `${guild.name}'s`, iconURL: guild.iconURL({ dynamic: true }) || undefined })
    .setTitle('Automod Setup')
    .setDescription(description);

  if (guild.iconURL({ dynamic: true })) {
    embed.setThumbnail(guild.iconURL({ dynamic: true, size: 256 }));
  }

  return embed;
}

function buildAutomodSetupComponents() {
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('automod_select_events')
    .setPlaceholder('Select events to enable')
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      { label: 'Anti spam', value: 'antispam', description: 'Toggle message flood & rapid chat spam' },
      { label: 'Anti caps', value: 'anticaps', description: 'Toggle excessive capitalization detection' },
      { label: 'Anti link', value: 'antilink', description: 'Toggle unauthorized website links' },
      { label: 'Anti invites', value: 'antiinvite', description: 'Toggle Discord server invite links' },
      { label: 'Anti mass mention', value: 'antimention', description: 'Toggle mass user & role mentions' },
      { label: 'Anti emoji spam', value: 'antiemojispam', description: 'Toggle excessive emoji spam' },
      { label: 'Anti NSFW link', value: 'antinsfw', description: 'Toggle adult & explicit link filtering' }
    );

  const row1 = new ActionRowBuilder().addComponents(selectMenu);

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('automod_enable_all')
      .setLabel('Enable for All Events')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('automod_cancel')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Danger)
  );

  return [row1, row2];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('automod')
    .setDescription('Configure automod filters, interactive setup, and Discord native rules')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('setup')
        .setDescription('Open the interactive visual Automod Setup dashboard')
    )
    .addSubcommand(sub =>
      sub.setName('config')
        .setDescription('View current automod configuration and interactive panel')
    )
    .addSubcommand(sub =>
      sub.setName('anti-spam')
        .setDescription('Toggle message spam rate-limit filter')
        .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable or disable anti-spam').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('anti-caps')
        .setDescription('Toggle excessive capitalization filter')
        .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable or disable anti-caps').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('anti-links')
        .setDescription('Toggle unauthorized link filter')
        .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable or disable anti-links').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('anti-invites')
        .setDescription('Toggle Discord server invite link filter')
        .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable or disable anti-invites').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('anti-mention')
        .setDescription('Toggle mass mention protection')
        .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable or disable anti-mention').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('anti-emoji')
        .setDescription('Toggle emoji spam protection')
        .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable or disable anti-emoji').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('anti-nsfw')
        .setDescription('Toggle NSFW link filtering')
        .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable or disable anti-nsfw').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('badwords')
        .setDescription('Manage blacklisted word filters')
        .addStringOption(opt =>
          opt.setName('action')
            .setDescription('Action to perform')
            .setRequired(true)
            .addChoices(
              { name: 'Add Word', value: 'add' },
              { name: 'Remove Word', value: 'remove' },
              { name: 'List Words', value: 'list' },
              { name: 'Clear All', value: 'clear' }
            )
        )
        .addStringOption(opt => opt.setName('word').setDescription('Word or phrase (required for add/remove)').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('action')
        .setDescription('Set the penalty when automod filter is triggered')
        .addStringOption(opt =>
          opt.setName('penalty')
            .setDescription('Action to take')
            .setRequired(true)
            .addChoices(
              { name: 'Warn User & Delete Message', value: 'warn' },
              { name: 'Timeout User (10 mins)', value: 'timeout' },
              { name: 'Kick User', value: 'kick' }
            )
        )
    )
    .addSubcommand(sub =>
      sub.setName('rule-create')
        .setDescription('Create a native Discord AutoMod rule')
        .addStringOption(opt =>
          opt.setName('name')
            .setDescription('Name for the AutoMod rule')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('type')
            .setDescription('Rule trigger type')
            .setRequired(true)
            .addChoices(
              { name: 'Keyword Filter (Custom Words)', value: 'keyword' },
              { name: 'Suspected Spam Filter', value: 'spam' },
              { name: 'Mention Spam (Anti-Mention Limit)', value: 'mention' },
              { name: 'Harmful Content (Profanity & Slurs Preset)', value: 'preset' }
            )
        )
        .addStringOption(opt =>
          opt.setName('action')
            .setDescription('Action to take on trigger')
            .setRequired(true)
            .addChoices(
              { name: 'Block Message', value: 'block' },
              { name: 'Timeout User (10 minutes)', value: 'timeout' },
              { name: 'Send Alert Message', value: 'alert' }
            )
        )
        .addStringOption(opt =>
          opt.setName('keywords')
            .setDescription('Comma-separated words or wildcards (e.g. *bad*, curse) for Keyword rules')
            .setRequired(false)
        )
        .addIntegerOption(opt =>
          opt.setName('mention_limit')
            .setDescription('Max mentions allowed per message (for Mention Spam)')
            .setMinValue(1)
            .setMaxValue(50)
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('rule-list')
        .setDescription('List all active Discord native AutoMod rules in this server')
    )
    .addSubcommand(sub =>
      sub.setName('rule-delete')
        .setDescription('Delete a native Discord AutoMod rule')
        .addStringOption(opt =>
          opt.setName('rule_id')
            .setDescription('ID or exact name of the AutoMod rule to delete')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('rule-sync')
        .setDescription('Migrate and sync bot blacklisted words into a native Discord AutoMod rule')
    ),

  buildAutomodSetupEmbed,
  buildAutomodSetupComponents,

  async execute(interaction) {
    const { guild, options } = interaction;
    if (!guild) {
      return interaction.reply({
        embeds: [EmbedGenerator.error('Server Only', 'This command can only be used in a server.')],
        ephemeral: true
      });
    }

    const sub = options.getSubcommand();
    const config = moderationManager.getAutomodConfig(guild.id);

    if (sub === 'setup' || sub === 'config') {
      const embed = buildAutomodSetupEmbed(guild);
      const components = buildAutomodSetupComponents();
      return interaction.reply({ embeds: [embed], components });
    }

    if (sub === 'anti-spam') {
      const enabled = options.getBoolean('enabled');
      moderationManager.setAutomodFeature(guild.id, 'antispam', enabled ? 1 : 0);
      return interaction.reply({
        embeds: [EmbedGenerator.success('Automod Updated', `Anti-Spam filter is now **${enabled ? 'ENABLED' : 'DISABLED'}**.`)]
      });
    }

    if (sub === 'anti-caps') {
      const enabled = options.getBoolean('enabled');
      moderationManager.setAutomodFeature(guild.id, 'anticaps', enabled ? 1 : 0);
      return interaction.reply({
        embeds: [EmbedGenerator.success('Automod Updated', `Anti-Caps filter is now **${enabled ? 'ENABLED' : 'DISABLED'}**.`)]
      });
    }

    if (sub === 'anti-links') {
      const enabled = options.getBoolean('enabled');
      moderationManager.setAutomodFeature(guild.id, 'antilink', enabled ? 1 : 0);
      return interaction.reply({
        embeds: [EmbedGenerator.success('Automod Updated', `Anti-Links filter is now **${enabled ? 'ENABLED' : 'DISABLED'}**.`)]
      });
    }

    if (sub === 'anti-invites') {
      const enabled = options.getBoolean('enabled');
      moderationManager.setAutomodFeature(guild.id, 'antiinvite', enabled ? 1 : 0);
      return interaction.reply({
        embeds: [EmbedGenerator.success('Automod Updated', `Anti-Invites filter is now **${enabled ? 'ENABLED' : 'DISABLED'}**.`)]
      });
    }

    if (sub === 'anti-mention') {
      const enabled = options.getBoolean('enabled');
      moderationManager.setAutomodFeature(guild.id, 'antimention', enabled ? 1 : 0);
      return interaction.reply({
        embeds: [EmbedGenerator.success('Automod Updated', `Anti-Mass Mention filter is now **${enabled ? 'ENABLED' : 'DISABLED'}**.`)]
      });
    }

    if (sub === 'anti-emoji') {
      const enabled = options.getBoolean('enabled');
      moderationManager.setAutomodFeature(guild.id, 'antiemojispam', enabled ? 1 : 0);
      return interaction.reply({
        embeds: [EmbedGenerator.success('Automod Updated', `Anti-Emoji Spam filter is now **${enabled ? 'ENABLED' : 'DISABLED'}**.`)]
      });
    }

    if (sub === 'anti-nsfw') {
      const enabled = options.getBoolean('enabled');
      moderationManager.setAutomodFeature(guild.id, 'antinsfw', enabled ? 1 : 0);
      return interaction.reply({
        embeds: [EmbedGenerator.success('Automod Updated', `Anti-NSFW Link filter is now **${enabled ? 'ENABLED' : 'DISABLED'}**.`)]
      });
    }

    if (sub === 'action') {
      const penalty = options.getString('penalty');
      moderationManager.setAutomodAction(guild.id, penalty);
      return interaction.reply({
        embeds: [EmbedGenerator.success('Automod Penalty Set', `Automod violation action set to: \`${penalty.toUpperCase()}\``)]
      });
    }

    if (sub === 'badwords') {
      const action = options.getString('action');
      const word = options.getString('word')?.toLowerCase().trim();

      if (action === 'add') {
        if (!word) {
          return interaction.reply({ embeds: [EmbedGenerator.error('Invalid Input', 'Please provide a word to blacklist.')], ephemeral: true });
        }
        if (config.badwords_list.includes(word)) {
          return interaction.reply({ embeds: [EmbedGenerator.warn('Notice', `\`${word}\` is already in the blacklist.`)], ephemeral: true });
        }
        moderationManager.addBadword(guild.id, word);
        return interaction.reply({ embeds: [EmbedGenerator.success('Word Blacklisted', `Added \`${word}\` to blacklisted words filter.`)] });
      }

      if (action === 'remove') {
        if (!word) {
          return interaction.reply({ embeds: [EmbedGenerator.error('Invalid Input', 'Please provide a word to remove.')], ephemeral: true });
        }
        if (!config.badwords_list.includes(word)) {
          return interaction.reply({ embeds: [EmbedGenerator.warn('Notice', `\`${word}\` was not found in the blacklist.`)], ephemeral: true });
        }
        moderationManager.removeBadword(guild.id, word);
        return interaction.reply({ embeds: [EmbedGenerator.success('Word Removed', `Removed \`${word}\` from blacklisted words filter.`)] });
      }

      if (action === 'clear') {
        moderationManager.clearBadwords(guild.id);
        return interaction.reply({ embeds: [EmbedGenerator.success('Blacklist Cleared', 'All custom blacklisted words have been cleared.')] });
      }

      if (action === 'list') {
        const words = config.badwords_list;
        if (words.length === 0) {
          return interaction.reply({ embeds: [EmbedGenerator.base().setTitle('🚫 Blacklisted Words').setDescription('No words are currently blacklisted.')] });
        }
        const description = words.map((w, idx) => `${idx + 1}. \`${w}\``).join('\n');
        return interaction.reply({
          embeds: [
            EmbedGenerator.base()
              .setTitle('🚫 Blacklisted Words')
              .setDescription(description.length > 2000 ? description.slice(0, 1990) + '...' : description)
          ]
        });
      }
    }

    if (sub === 'rule-create') {
      await interaction.deferReply();
      const name = options.getString('name');
      const type = options.getString('type');
      const actionChoice = options.getString('action');
      const rawKeywords = options.getString('keywords');
      const mentionLimit = options.getInteger('mention_limit') || 5;

      try {
        let triggerType;
        let triggerMetadata = {};

        if (type === 'keyword') {
          triggerType = AutoModerationRuleTriggerType.Keyword;
          const keywords = rawKeywords ? rawKeywords.split(',').map(k => k.trim()).filter(Boolean) : [];
          if (keywords.length === 0) {
            return interaction.editReply({ embeds: [EmbedGenerator.error('Missing Keywords', 'You must provide comma-separated `keywords` for a Keyword rule.')] });
          }
          triggerMetadata.keywordFilter = keywords;
        } else if (type === 'spam') {
          triggerType = AutoModerationRuleTriggerType.Spam;
        } else if (type === 'mention') {
          triggerType = AutoModerationRuleTriggerType.MentionSpam;
          triggerMetadata.mentionTotalLimit = mentionLimit;
        } else if (type === 'preset') {
          triggerType = AutoModerationRuleTriggerType.KeywordPreset;
          triggerMetadata.presets = [
            AutoModerationRuleKeywordPresetType.Profanity,
            AutoModerationRuleKeywordPresetType.SexualContent,
            AutoModerationRuleKeywordPresetType.Slurs
          ];
        }

        const actions = [];
        if (actionChoice === 'block') {
          actions.push({
            type: AutoModerationActionType.BlockMessage,
            metadata: { customMessage: `Blocked by ${guild.name} AutoMod Protection.` }
          });
        } else if (actionChoice === 'timeout') {
          actions.push({
            type: AutoModerationActionType.Timeout,
            metadata: { durationSeconds: 600 }
          });
          actions.push({
            type: AutoModerationActionType.BlockMessage
          });
        } else if (actionChoice === 'alert') {
          actions.push({
            type: AutoModerationActionType.SendAlertMessage,
            metadata: { channel: interaction.channelId }
          });
        }

        const rule = await guild.autoModerationRules.create({
          name,
          eventType: AutoModerationRuleEventType.MessageSend,
          triggerType,
          triggerMetadata,
          actions,
          enabled: true,
          reason: `Created via Mia Discord AutoMod Integration by ${interaction.user.tag}`
        });

        return interaction.editReply({
          embeds: [
            EmbedGenerator.success(
              'Discord AutoMod Rule Created',
              `Successfully created native rule **${rule.name}** (\`${rule.id}\`) on Discord!\n• **Trigger:** \`${type.toUpperCase()}\`\n• **Action:** \`${actionChoice.toUpperCase()}\``
            )
          ]
        });
      } catch (err) {
        Logger.error(`Failed to create Discord AutoMod rule: ${err.message}`);
        return interaction.editReply({
          embeds: [EmbedGenerator.error('Discord AutoMod Error', `Failed to create rule: ${err.message}`)]
        });
      }
    }

    if (sub === 'rule-list') {
      await interaction.deferReply();
      try {
        const rules = await guild.autoModerationRules.fetch();
        if (rules.size === 0) {
          return interaction.editReply({
            embeds: [EmbedGenerator.base().setTitle('🛡️ Discord AutoMod Rules').setDescription('No native Discord AutoMod rules found in this server.')]
          });
        }

        const list = Array.from(rules.values()).map(r => {
          const status = r.enabled ? '🟢 Enabled' : '🔴 Disabled';
          return `• **${r.name}** (\`${r.id}\`)\n  Status: ${status} | Trigger: \`${r.triggerType}\``;
        }).join('\n\n');

        return interaction.editReply({
          embeds: [EmbedGenerator.base().setTitle(`🛡️ Discord AutoMod Rules (${rules.size})`).setDescription(list)]
        });
      } catch (err) {
        return interaction.editReply({ embeds: [EmbedGenerator.error('Error', `Failed to fetch rules: ${err.message}`)] });
      }
    }

    if (sub === 'rule-delete') {
      await interaction.deferReply();
      const identifier = options.getString('rule_id').trim();
      try {
        const rules = await guild.autoModerationRules.fetch();
        const rule = rules.get(identifier) || rules.find(r => r.name.toLowerCase() === identifier.toLowerCase());

        if (!rule) {
          return interaction.editReply({ embeds: [EmbedGenerator.warn('Not Found', `No Discord AutoMod rule found matching \`${identifier}\`.`)] });
        }

        const name = rule.name;
        await rule.delete(`Deleted via Mia by ${interaction.user.tag}`);
        return interaction.editReply({
          embeds: [EmbedGenerator.success('Rule Deleted', `Successfully deleted Discord AutoMod rule **${name}**.`)]
        });
      } catch (err) {
        return interaction.editReply({ embeds: [EmbedGenerator.error('Error', `Failed to delete rule: ${err.message}`)] });
      }
    }

    if (sub === 'rule-sync') {
      await interaction.deferReply();
      try {
        const words = config.badwords_list;
        if (words.length === 0) {
          return interaction.editReply({
            embeds: [EmbedGenerator.warn('No Words Found', 'No custom blacklisted words configured in bot database to sync.')]
          });
        }

        const ruleName = 'Mia Badwords Filter';
        const rules = await guild.autoModerationRules.fetch();
        let existingRule = rules.find(r => r.name === ruleName);

        if (existingRule) {
          await existingRule.edit({
            triggerMetadata: { keywordFilter: words.slice(0, 1000) },
            reason: `Synced badwords by ${interaction.user.tag}`
          });
        } else {
          existingRule = await guild.autoModerationRules.create({
            name: ruleName,
            eventType: AutoModerationRuleEventType.MessageSend,
            triggerType: AutoModerationRuleTriggerType.Keyword,
            triggerMetadata: { keywordFilter: words.slice(0, 1000) },
            actions: [
              {
                type: AutoModerationActionType.BlockMessage,
                metadata: { customMessage: 'Message blocked by Mia Word Blacklist Filter.' }
              }
            ],
            enabled: true,
            reason: `AutoMod Word Blacklist created by ${interaction.user.tag}`
          });
        }

        return interaction.editReply({
          embeds: [
            EmbedGenerator.success(
              'Badwords Synced to Discord AutoMod',
              `Successfully synced **${words.length}** blacklisted words to native Discord AutoMod rule **${existingRule.name}** (\`${existingRule.id}\`)!`
            )
          ]
        });
      } catch (err) {
        Logger.error(`Failed to sync badwords to Discord AutoMod: ${err.message}`);
        return interaction.editReply({ embeds: [EmbedGenerator.error('Sync Error', `Failed to sync words: ${err.message}`)] });
      }
    }
  }
};
