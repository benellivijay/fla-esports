const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');
const antiraidManager = require('../../database/managers/AntiraidManager');
const AntiraidEngine = require('../../antiraid/AntiraidEngine');
const EmbedGenerator = require('../../utils/embed');
const Logger = require('../../utils/logger');

function buildAntiraidConfigEmbed(guild) {
  const config = antiraidManager.getConfig(guild.id);
  const liveStatus = AntiraidEngine.getLiveStatus(guild.id);

  const embed = new EmbedBuilder()
    .setColor(config.enabled ? (config.lockdown_active ? 0xED4245 : 0x06B6D4) : 0x747F8D)
    .setTitle('🛡️ Anti-Raid Defense System')
    .setDescription(
      `Protects **${guild.name}** against mass join attacks and bot token raids using a sliding-window risk score algorithm.\n\n` +
      `• **Status:** ${config.enabled ? '🟢 `ENABLED`' : '🔴 `DISABLED`'}\n` +
      `• **Active Preset:** \`${config.active_preset.toUpperCase()}\`\n` +
      `• **Score Limit (Threshold):** \`${config.score_limit} points\` (Window: \`${config.window_seconds}s\`)\n` +
      `• **Raider Punishment:** \`${config.punishment.toUpperCase()}\`\n` +
      `• **Server Lockdown:** ${config.lockdown_active ? '🔴 `ACTIVE LOCKDOWN`' : '🟢 `NORMAL (UNLOCKED)`'}\n` +
      `• **Live Risk Score (Current Window):** \`${liveStatus.currentScore}/${config.score_limit} pts\` (${liveStatus.activeJoinsCount} recent joins)`
    )
    .addFields(
      {
        name: '📊 Risk Scoring Weights',
        value:
          `• **Base Join Score:** \`+${config.base_score} pt\`\n` +
          `• **Account Age < ${config.min_account_age_days}d:** \`+${config.age_score} pts\`\n` +
          `• **Default / No Avatar:** \`+${config.no_avatar_score} pts\`\n` +
          `• **Rapid Join (< 5s from prev):** \`+${config.rapid_join_score} pts\``,
        inline: true
      },
      {
        name: '🛡️ Defenses & Bypass',
        value:
          `• **Auto Server Lockdown:** ${config.auto_lockdown_enabled ? '`ENABLED`' : '`DISABLED`'}\n` +
          `• **Badge Bypass (Nitro/Devs):** ${config.badge_bypass_enabled ? '`ENABLED`' : '`DISABLED`'}\n` +
          `• **Whitelist Exemption:** \`ACTIVE\` (Server staff/exempt)`,
        inline: true
      }
    )
    .setFooter({ text: 'Mia Anti-Raid • Inspired by docs.securitybot.gg/other-modules/anti-raid' })
    .setTimestamp();

  return embed;
}

function buildAntiraidComponents(guild) {
  const config = antiraidManager.getConfig(guild.id);

  const presetSelect = new StringSelectMenuBuilder()
    .setCustomId('antiraid_preset_select')
    .setPlaceholder('Select a Security Preset...')
    .addOptions([
      {
        label: 'High Security',
        description: 'Score Limit: 15 | Punishment: BAN | Strict 7-day account age check',
        value: 'high',
        emoji: '🔴'
      },
      {
        label: 'Standard (Recommended)',
        description: 'Score Limit: 25 | Punishment: KICK | 3-day account age check',
        value: 'standard',
        emoji: '🟢'
      },
      {
        label: 'Lenient',
        description: 'Score Limit: 45 | Punishment: TIMEOUT | 24h account age check',
        value: 'lenient',
        emoji: '🟡'
      }
    ]);

  const row1 = new ActionRowBuilder().addComponents(presetSelect);

  const toggleBtn = new ButtonBuilder()
    .setCustomId('antiraid_toggle')
    .setLabel(config.enabled ? 'Disable Anti-Raid' : 'Enable Anti-Raid')
    .setStyle(config.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
    .setEmoji(config.enabled ? '🔴' : '🟢');

  const lockdownBtn = new ButtonBuilder()
    .setCustomId(config.lockdown_active ? 'antiraid_unlock' : 'antiraid_lockdown')
    .setLabel(config.lockdown_active ? 'Unlock Server (Calm Down)' : 'Emergency Lockdown')
    .setStyle(config.lockdown_active ? ButtonStyle.Success : ButtonStyle.Danger)
    .setEmoji(config.lockdown_active ? '🔓' : '🔒');

  const resetBtn = new ButtonBuilder()
    .setCustomId('antiraid_reset')
    .setLabel('Reset Config')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('🔄');

  const closeBtn = new ButtonBuilder()
    .setCustomId('antiraid_close')
    .setLabel('Close')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('❌');

  const row2 = new ActionRowBuilder().addComponents(toggleBtn, lockdownBtn, resetBtn, closeBtn);

  return [row1, row2];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('antiraid')
    .setDescription('Score-based Anti-Raid mass join defense and emergency lockdown system')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('setup')
        .setDescription('Open the interactive Anti-Raid control dashboard')
    )
    .addSubcommand(sub =>
      sub.setName('config')
        .setDescription('View current Anti-Raid settings, live risk scores, and raid status')
    )
    .addSubcommand(sub =>
      sub.setName('preset')
        .setDescription('Apply a recommended security preset')
        .addStringOption(opt =>
          opt.setName('level')
            .setDescription('Security preset level')
            .setRequired(true)
            .addChoices(
              { name: '🔴 High Security (15 pts limit, BAN raiders)', value: 'high' },
              { name: '🟢 Standard Recommended (25 pts limit, KICK raiders)', value: 'standard' },
              { name: '🟡 Lenient (45 pts limit, TIMEOUT raiders)', value: 'lenient' }
            )
        )
    )
    .addSubcommand(sub =>
      sub.setName('punish')
        .setDescription('Set punishment action applied to detected raiders')
        .addStringOption(opt =>
          opt.setName('action')
            .setDescription('Action to take')
            .setRequired(true)
            .addChoices(
              { name: '🔨 Ban Raiders', value: 'ban' },
              { name: '👢 Kick Raiders', value: 'kick' },
              { name: '⏳ Timeout / Quarantine Raiders', value: 'timeout' }
            )
        )
    )
    .addSubcommand(sub =>
      sub.setName('score')
        .setDescription('Set the cumulative score threshold that triggers raid defense')
        .addIntegerOption(opt =>
          opt.setName('limit')
            .setDescription('Cumulative risk score limit (e.g. 15, 25, 50)')
            .setMinValue(5)
            .setMaxValue(200)
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('lockdown')
        .setDescription('Emergency lockdown: instantly lock all public text channels')
    )
    .addSubcommand(sub =>
      sub.setName('unlock')
        .setDescription('Lift server lockdown and restore normal chat permissions')
    )
    .addSubcommand(sub =>
      sub.setName('enable')
        .setDescription('Enable Anti-Raid protection')
    )
    .addSubcommand(sub =>
      sub.setName('disable')
        .setDescription('Disable Anti-Raid protection')
    ),

  buildAntiraidConfigEmbed,
  buildAntiraidComponents,

  async execute(interaction) {
    const { guild, options, member } = interaction;
    const sub = options.getSubcommand();

    if (sub === 'setup') {
      const embed = buildAntiraidConfigEmbed(guild);
      const components = buildAntiraidComponents(guild);
      return interaction.reply({ embeds: [embed], components });
    }

    if (sub === 'config') {
      const embed = buildAntiraidConfigEmbed(guild);
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'preset') {
      const level = options.getString('level');
      antiraidManager.applyPreset(guild.id, level);
      const embed = buildAntiraidConfigEmbed(guild);
      return interaction.reply({
        embeds: [
          EmbedGenerator.success(
            'Preset Applied',
            `Successfully applied the **${level.toUpperCase()}** Anti-Raid preset!`
          ),
          embed
        ]
      });
    }

    if (sub === 'punish') {
      const action = options.getString('action');
      antiraidManager.setPunishment(guild.id, action);
      return interaction.reply({
        embeds: [EmbedGenerator.success('Punishment Updated', `Anti-Raid raider punishment set to **${action.toUpperCase()}**.`)]
      });
    }

    if (sub === 'score') {
      const limit = options.getInteger('limit');
      antiraidManager.setScoreLimit(guild.id, limit);
      return interaction.reply({
        embeds: [EmbedGenerator.success('Score Limit Updated', `Anti-Raid cumulative threshold set to **${limit} points**.`)]
      });
    }

    if (sub === 'lockdown') {
      await interaction.deferReply();
      const count = await AntiraidEngine.lockdownGuild(guild, member);
      return interaction.editReply({
        embeds: [EmbedGenerator.success('Server Locked Down', `🔒 Locked **${count}** public text channels. Regular members cannot send messages.`)]
      });
    }

    if (sub === 'unlock') {
      await interaction.deferReply();
      const count = await AntiraidEngine.unlockGuild(guild, member);
      return interaction.editReply({
        embeds: [EmbedGenerator.success('Server Unlocked', `🔓 Restored normal permissions across **${count}** channels. Peace restored.`)]
      });
    }

    if (sub === 'enable') {
      antiraidManager.setEnabled(guild.id, true);
      return interaction.reply({
        embeds: [EmbedGenerator.success('Anti-Raid Enabled', 'Anti-Raid protection is now **ON 🟢**.')]
      });
    }

    if (sub === 'disable') {
      antiraidManager.setEnabled(guild.id, false);
      return interaction.reply({
        embeds: [EmbedGenerator.success('Anti-Raid Disabled', 'Anti-Raid protection is now **OFF 🔴**.')]
      });
    }
  }
};
