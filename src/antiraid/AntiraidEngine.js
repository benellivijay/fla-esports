const antiraidManager = require('../database/managers/AntiraidManager');
const antinukeManager = require('../database/managers/AntinukeManager');
const isBotOwner = require('../utils/isBotOwner');
const LogRouter = require('../utils/LogRouter');
const EmbedGenerator = require('../utils/embed');
const Logger = require('../utils/logger');
const {
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType
} = require('discord.js');

// In-memory sliding window join tracking: guildId -> [ { memberId, tag, score, timestamp, reasons } ]
const guildJoinWindows = new Map();

// In-memory record of channels locked by anti-raid: guildId -> Set<channelId>
const lockedChannelsMap = new Map();

// In-memory auto-calm timeouts: guildId -> timeoutHandle
const autoCalmTimeouts = new Map();

// In-memory message flood/spam tracking: `${guildId}:${authorId}` -> Array<{ timestamp, content, mentionsCount, hasEveryone }>`
const authorMessageHistories = new Map();

// In-memory guild chat raid attack score: guildId -> Array<{ timestamp, score }>
const guildChatRaidWindows = new Map();

const CHAT_RAID_KEYWORDS = [
  'oombu', 'punda', 'mavane', 'punde', 'otha', 'thevidiya', 'sunni', 'baadu', 'mayiru',
  'nuke', 'nuked', 'raided', 'raid', 'discord.gg/', 'hacked by', 'crashed by'
];

class AntiraidEngine {
  /**
   * Evaluates an incoming member against anti-raid risk metrics
   * @param {import('discord.js').GuildMember} member
   */
  static async evaluateMember(member) {
    const { guild, user } = member;
    if (!guild || user.bot) return { isRaid: false, score: 0 };

    const config = antiraidManager.getConfig(guild.id);
    if (!config || !config.enabled) return { isRaid: false, score: 0 };

    // 1. Check Owner / Whitelist Exemption
    if (guild.ownerId === user.id) return { isRaid: false, score: 0, exempt: true };
    if (antinukeManager.isWhitelisted(guild.id, user.id) || antinukeManager.isExtraOwner(guild.id, user.id)) {
      return { isRaid: false, score: 0, exempt: true };
    }
    if (await isBotOwner(guild.client, user.id)) {
      return { isRaid: false, score: 0, exempt: true };
    }

    // 2. Check Discord Badge Bypass (if enabled)
    if (config.badge_bypass_enabled) {
      const flags = user.flags?.toArray() || [];
      const trustedFlags = [
        'PremiumEarlySupporter',
        'HypeSquadOnlineHouse1',
        'HypeSquadOnlineHouse2',
        'HypeSquadOnlineHouse3',
        'ActiveDeveloper',
        'VerifiedBotDeveloper',
        'Staff',
        'Partner',
        'BugHunterLevel1',
        'BugHunterLevel2'
      ];
      if (flags.some(f => trustedFlags.includes(f))) {
        Logger.info(`[Anti-Raid Bypass] ${user.tag} bypassed anti-raid via Discord badge(s): ${flags.join(', ')}`);
        return { isRaid: false, score: 0, exempt: true, badgeBypass: true };
      }
    }

    const now = Date.now();
    let memberScore = config.base_score || 1;
    const reasons = [];

    // 3. Account Age Risk
    const accountAgeMs = now - user.createdTimestamp;
    const accountAgeDays = accountAgeMs / (1000 * 60 * 60 * 24);
    if (accountAgeDays < config.min_account_age_days) {
      memberScore += config.age_score;
      reasons.push(`Account Age < ${config.min_account_age_days}d (${accountAgeDays.toFixed(1)}d old)`);
    }

    // 4. Default / Missing Avatar Risk
    if (!user.avatar) {
      memberScore += config.no_avatar_score;
      reasons.push('Default Avatar (No Custom PFP)');
    }

    // 5. Rapid Join Velocity Risk
    let guildWindow = guildJoinWindows.get(guild.id) || [];
    const windowCutoff = now - (config.window_seconds * 1000);
    guildWindow = guildWindow.filter(r => r.timestamp > windowCutoff);

    const lastJoin = guildWindow[guildWindow.length - 1];
    if (lastJoin && (now - lastJoin.timestamp) <= 5000) {
      memberScore += config.rapid_join_score;
      reasons.push('Rapid Join (< 5s from previous)');
    }

    // Record join in sliding window
    const joinRecord = {
      memberId: user.id,
      tag: user.tag,
      score: memberScore,
      timestamp: now,
      reasons
    };
    guildWindow.push(joinRecord);
    guildJoinWindows.set(guild.id, guildWindow);

    // 6. Calculate Cumulative Window Score
    const cumulativeScore = guildWindow.reduce((sum, r) => sum + r.score, 0);

    Logger.info(
      `[Anti-Raid Score] Guild: "${guild.name}" | User: ${user.tag} | +${memberScore} pts | Window Total: ${cumulativeScore}/${config.score_limit}`
    );

    // 7. Check if Raid Threshold Exceeded
    if (cumulativeScore >= config.score_limit) {
      await this.triggerRaidDefense(guild, config, guildWindow, cumulativeScore);
      return { isRaid: true, score: cumulativeScore };
    }

    return { isRaid: false, score: cumulativeScore };
  }

  /**
   * Evaluates incoming chat messages for Mass Mentions, Rogue Bots, Raid Floods, and Malicious Apps
   * @param {import('discord.js').Message} message
   * @returns {Promise<boolean>} true if message was intercepted as a raid action
   */
  static async evaluateMessage(message) {
    const { guild, author, channel } = message;
    if (!guild || !author || author.id === message.client.user.id) return false;

    const config = antiraidManager.getConfig(guild.id);
    if (!config || !config.enabled) return false;

    // Exemption Checks
    if (guild.ownerId === author.id) return false;
    if (antinukeManager.isWhitelisted(guild.id, author.id) || antinukeManager.isExtraOwner(guild.id, author.id)) {
      return false;
    }
    if (await isBotOwner(message.client, author.id)) {
      return false;
    }

    const member = message.member || (await guild.members.fetch(author.id).catch(() => null));
    if (member?.permissions.has(PermissionFlagsBits.Administrator) && !author.bot) {
      return false;
    }

    const now = Date.now();
    const content = message.content || '';
    const lowerContent = content.toLowerCase();
    const hasEveryone = message.mentions.everyone || lowerContent.includes('@everyone') || lowerContent.includes('@here');
    const totalMentions = message.mentions.users.size + message.mentions.roles.size;

    // Track user message history
    const historyKey = `${guild.id}:${author.id}`;
    let history = authorMessageHistories.get(historyKey) || [];
    history = history.filter(h => now - h.timestamp < 10000); // keep last 10s
    history.push({
      timestamp: now,
      content: lowerContent,
      hasEveryone,
      mentionsCount: totalMentions,
      id: message.id
    });
    authorMessageHistories.set(historyKey, history);

    let isRaidViolation = false;
    let raidReason = null;

    // Check 1: Rogue Bot / Unwhitelisted App Mass Mention or Profanity Spam
    if (author.bot) {
      if (hasEveryone || totalMentions >= 2) {
        isRaidViolation = true;
        raidReason = `Rogue Bot / App Mass Mention Raid (@everyone / @here / mass pings)`;
      } else if (CHAT_RAID_KEYWORDS.some(k => lowerContent.includes(k))) {
        isRaidViolation = true;
        raidReason = `Rogue Bot Profanity / Raid Spamming`;
      } else if (history.length >= 3) {
        isRaidViolation = true;
        raidReason = `Rogue Bot Message Flood Attack`;
      }
    }

    // Check 2: Human User Mass Ping (@everyone, @here, or 4+ pings)
    if (!isRaidViolation && (hasEveryone || totalMentions >= 4)) {
      isRaidViolation = true;
      raidReason = `Mass Mention Ping Attack (${hasEveryone ? '@everyone/@here' : `${totalMentions} mentions`})`;
    }

    // Check 3: Rapid Message Flood (4 messages in < 3.5s)
    if (!isRaidViolation) {
      const recent4 = history.filter(h => now - h.timestamp < 3500);
      if (recent4.length >= 4) {
        isRaidViolation = true;
        raidReason = `Rapid Chat Flood Raid (4+ msgs in 3.5s)`;
      }
    }

    // Check 4: Duplicate Message Spam (3 identical messages in < 8s)
    if (!isRaidViolation && history.length >= 3) {
      const identicalCount = history.filter(h => h.content === lowerContent && (now - h.timestamp < 8000)).length;
      if (identicalCount >= 3) {
        isRaidViolation = true;
        raidReason = `Repeated Duplicate Message Raid Spam`;
      }
    }

    if (isRaidViolation) {
      Logger.warn(`🚨 [CHAT RAID INTERCEPTED] Guild: "${guild.name}" | Author: ${author.tag} (${author.id}) [Bot: ${author.bot}] | Reason: ${raidReason}`);

      // 1. Instantly Delete Offending Message
      await message.delete().catch(() => null);

      // 2. Fetch and Purge Recent Offending Messages from this author in channel
      try {
        const recentMsgs = await channel.messages.fetch({ limit: 25 }).catch(() => null);
        if (recentMsgs) {
          const toDelete = recentMsgs.filter(m => m.author.id === author.id && (now - m.createdTimestamp < 30000));
          if (toDelete.size > 0) {
            await channel.bulkDelete(toDelete, true).catch(() => null);
          }
        }
      } catch {}

      // 3. Execute Punishment
      const punishment = author.bot ? 'ban' : (config.punishment?.toLowerCase() || 'ban');
      let punishmentApplied = 'None';

      try {
        if (punishment === 'ban' || author.bot) {
          await guild.members.ban(author.id, {
            deleteMessageSeconds: 86400,
            reason: `Mia Anti-Raid: Chat raid attack intercepted (${raidReason})`
          });
          punishmentApplied = 'Banned from Server';
        } else if (punishment === 'kick') {
          if (member && member.kickable) {
            await member.kick(`Mia Anti-Raid: Chat raid attack intercepted (${raidReason})`);
            punishmentApplied = 'Kicked from Server';
          }
        } else if (punishment === 'timeout') {
          if (member && member.moderatable) {
            await member.timeout(
              config.timeout_duration_minutes * 60 * 1000,
              `Mia Anti-Raid: Chat raid attack quarantine (${raidReason})`
            );
            punishmentApplied = `Timed out for ${config.timeout_duration_minutes}m`;
          }
        }
      } catch (err) {
        Logger.error(`Failed to execute anti-raid punishment on ${author.tag}: ${err.message}`);
      }

      // 4. Update Guild Chat Raid Velocity Score
      let guildChatWindow = guildChatRaidWindows.get(guild.id) || [];
      guildChatWindow = guildChatWindow.filter(e => now - e.timestamp < 15000);
      guildChatWindow.push({ timestamp: now, score: 5 });
      guildChatRaidWindows.set(guild.id, guildChatWindow);

      const cumulativeChatScore = guildChatWindow.reduce((s, e) => s + e.score, 0);

      // 5. Trigger Emergency Lockdown if rapid multi-account spam detected
      if (config.auto_lockdown_enabled && cumulativeChatScore >= 10 && !config.lockdown_active) {
        await this.lockdownGuild(guild, null, true);
      }

      // 6. Send Rich Security Raid Intercept Alert
      const alertEmbed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('🚨 RAID SPAM INTERCEPTED & SUPPRESSED')
        .setDescription(
          `**Mia Anti-Raid** instantly neutralized a malicious raid attack in ${channel}!\n\n` +
          `• **Attacker:** ${author} (\`${author.tag}\` | \`${author.id}\`)\n` +
          `• **Account Type:** ${author.bot ? '🤖 **Rogue Bot / App**' : '👤 User Account'}\n` +
          `• **Violation:** \`${raidReason}\`\n` +
          `• **Punishment Taken:** \`${punishmentApplied}\`\n` +
          `• **Spam Cleanup:** Offending messages automatically purged\n` +
          `• **Server Status:** ${config.lockdown_active ? '🔒 **Lockdown Active**' : '🟢 Monitored & Secure'}`
        )
        .addFields({
          name: 'Intercepted Content Snippet',
          value: `\`\`\`${content.slice(0, 500) || '[No Text]'}\`\`\``
        })
        .setFooter({ text: 'Anti-Raid Active Protection • Mia Security' })
        .setTimestamp();

      const unlockBtn = new ButtonBuilder()
        .setCustomId('antiraid_unlock')
        .setLabel('Unlock Server')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🔓');

      const configBtn = new ButtonBuilder()
        .setCustomId('antiraid_view_config')
        .setLabel('Anti-Raid Settings')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⚙️');

      const row = new ActionRowBuilder().addComponents(unlockBtn, configBtn);

      await LogRouter.log(guild, 'mod', 'automod', alertEmbed);
      return true;
    }

    return false;
  }

  /**
   * Executes raid defense actions (punishments, auto-lockdown, logging)
   */
  static async triggerRaidDefense(guild, config, raiders, cumulativeScore) {
    Logger.warn(`🚨 [RAID DETECTED] Guild: "${guild.name}" | Score: ${cumulativeScore}/${config.score_limit} | Raiders: ${raiders.length}`);

    antiraidManager.setLockdownState(guild.id, true);

    const punishedCount = { success: 0, failed: 0 };
    const punishment = config.punishment?.toLowerCase() || 'kick';

    // 1. Punish Flagged Raiders
    for (const raider of raiders) {
      try {
        if (punishment === 'ban') {
          await guild.members.ban(raider.memberId, {
            deleteMessageSeconds: 86400,
            reason: `Mia Anti-Raid: Mass join raid protection (${raider.reasons.join(', ') || 'High Risk Score'})`
          });
          punishedCount.success++;
        } else if (punishment === 'kick') {
          const targetMember = await guild.members.fetch(raider.memberId).catch(() => null);
          if (targetMember && targetMember.kickable) {
            await targetMember.kick(`Mia Anti-Raid: Mass join raid protection`);
            punishedCount.success++;
          }
        } else if (punishment === 'timeout') {
          const targetMember = await guild.members.fetch(raider.memberId).catch(() => null);
          if (targetMember && targetMember.moderatable) {
            await targetMember.timeout(
              config.timeout_duration_minutes * 60 * 1000,
              `Mia Anti-Raid: Mass join raid quarantine`
            );
            punishedCount.success++;
          }
        }
      } catch (err) {
        punishedCount.failed++;
        Logger.error(`Failed to punish raider ${raider.memberId}: ${err.message}`);
      }
    }

    // 2. Automated Server Lockdown (if enabled)
    let lockedCount = 0;
    if (config.auto_lockdown_enabled) {
      lockedCount = await this.lockdownGuild(guild, null, false);
    }

    // 3. Clear the join window to avoid repeated trigger cascades
    guildJoinWindows.set(guild.id, []);

    // 4. Send Raid Alert to Mod & Server Logs
    const alertEmbed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('🚨 RAID DETECTED & INTERCEPTED')
      .setDescription(
        `A mass join raid attack was detected and automatically suppressed by **Mia Anti-Raid**!\n\n` +
        `• **Cumulative Risk Score:** \`${cumulativeScore}/${config.score_limit}\`\n` +
        `• **Raiders Identified:** \`${raiders.length}\` accounts\n` +
        `• **Punishment Applied:** \`${punishment.toUpperCase()}\` (${punishedCount.success} applied)\n` +
        `• **Server Lockdown:** ${config.auto_lockdown_enabled ? `\`ACTIVE\` (${lockedCount} channels locked)` : '`DISABLED`'}\n` +
        `• **Preset:** \`${config.active_preset.toUpperCase()}\``
      )
      .addFields({
        name: 'Flagged Accounts',
        value: raiders.slice(0, 10).map(r => `• **${r.tag}** (\`${r.memberId}\`) - +${r.score}pts`).join('\n') + (raiders.length > 10 ? `\n*...and ${raiders.length - 10} more*` : '')
      })
      .setFooter({ text: 'Security Defense Active • Auto-calm in 10 minutes' })
      .setTimestamp();

    const unlockBtn = new ButtonBuilder()
      .setCustomId('antiraid_unlock')
      .setLabel('Unlock Server / Calm Down')
      .setStyle(ButtonStyle.Success)
      .setEmoji('🔓');

    const configBtn = new ButtonBuilder()
      .setCustomId('antiraid_view_config')
      .setLabel('Anti-Raid Settings')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('⚙️');

    const row = new ActionRowBuilder().addComponents(unlockBtn, configBtn);

    await LogRouter.log(guild, 'mod', 'automod', alertEmbed);

    // 5. Schedule Auto-Calm Down (10 minutes)
    if (autoCalmTimeouts.has(guild.id)) {
      clearTimeout(autoCalmTimeouts.get(guild.id));
    }

    const timer = setTimeout(async () => {
      await this.unlockGuild(guild, null, true);
    }, 10 * 60 * 1000);
    autoCalmTimeouts.set(guild.id, timer);
  }

  /**
   * Locks all public text channels in the guild
   */
  static async lockdownGuild(guild, moderator = null, notify = true) {
    const lockedChannels = new Set();
    const everyoneRole = guild.roles.everyone;

    const channels = guild.channels.cache.filter(
      ch => (ch.type === ChannelType.GuildText || ch.type === ChannelType.GuildAnnouncement) && ch.permissionsFor(everyoneRole)?.has(PermissionFlagsBits.SendMessages)
    );

    for (const [id, channel] of channels) {
      try {
        await channel.permissionOverwrites.edit(everyoneRole, {
          SendMessages: false,
          SendMessagesInThreads: false,
          CreatePublicThreads: false,
          CreatePrivateThreads: false
        }, { reason: `Mia Anti-Raid: Server Lockdown initiated ${moderator ? `by ${moderator.tag}` : 'automatically'}` });
        lockedChannels.add(id);
      } catch (err) {
        Logger.error(`Failed to lock channel #${channel.name}: ${err.message}`);
      }
    }

    lockedChannelsMap.set(guild.id, lockedChannels);
    antiraidManager.setLockdownState(guild.id, true);

    if (notify) {
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('🔒 Server Lockdown Activated')
        .setDescription(
          `**${lockedChannels.size}** text channels have been locked.\n` +
          `Regular members cannot send messages until the lockdown is lifted.`
        )
        .addFields(
          { name: 'Initiated By', value: moderator ? `${moderator} (\`${moderator.id}\`)` : '*Automated Anti-Raid Engine*', inline: true },
          { name: 'Status', value: '🔴 Active Lockdown', inline: true }
        )
        .setTimestamp();

      const unlockBtn = new ButtonBuilder()
        .setCustomId('antiraid_unlock')
        .setLabel('Unlock Server')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🔓');

      const row = new ActionRowBuilder().addComponents(unlockBtn);
      await LogRouter.log(guild, 'mod', 'automod', embed);
    }

    return lockedChannels.size;
  }

  /**
   * Unlocks all previously locked channels and restores peace
   */
  static async unlockGuild(guild, moderator = null, isAuto = false) {
    if (autoCalmTimeouts.has(guild.id)) {
      clearTimeout(autoCalmTimeouts.get(guild.id));
      autoCalmTimeouts.delete(guild.id);
    }

    const lockedChannels = lockedChannelsMap.get(guild.id) || new Set();
    const everyoneRole = guild.roles.everyone;
    let unlockedCount = 0;

    for (const channelId of lockedChannels) {
      const channel = guild.channels.cache.get(channelId);
      if (channel) {
        try {
          await channel.permissionOverwrites.edit(everyoneRole, {
            SendMessages: null,
            SendMessagesInThreads: null,
            CreatePublicThreads: null,
            CreatePrivateThreads: null
          }, { reason: `Mia Anti-Raid: Server Lockdown lifted ${moderator ? `by ${moderator.tag}` : isAuto ? 'automatically (calm down)' : ''}` });
          unlockedCount++;
        } catch (err) {
          Logger.error(`Failed to unlock channel #${channel.name}: ${err.message}`);
        }
      }
    }

    lockedChannelsMap.delete(guild.id);
    guildJoinWindows.set(guild.id, []);
    antiraidManager.setLockdownState(guild.id, false);

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('🔓 Server Lockdown Lifted')
      .setDescription(
        `Normal chat permissions have been restored across **${unlockedCount}** channels.\n` +
        `The server has calmed down and is now safe.`
      )
      .addFields(
        { name: 'Resolved By', value: moderator ? `${moderator} (\`${moderator.id}\`)` : isAuto ? '*Automatic Calm Down (Timer)*' : '*Staff Action*', inline: true },
        { name: 'Status', value: '🟢 Peace Restored', inline: true }
      )
      .setTimestamp();

    await LogRouter.log(guild, 'mod', 'automod', embed);
    return unlockedCount;
  }

  /**
   * Get current live join window status
   */
  static getLiveStatus(guildId) {
    const config = antiraidManager.getConfig(guildId);
    const window = guildJoinWindows.get(guildId) || [];
    const now = Date.now();
    const windowCutoff = now - (config.window_seconds * 1000);
    const activeJoins = window.filter(r => r.timestamp > windowCutoff);
    const currentScore = activeJoins.reduce((sum, r) => sum + r.score, 0);

    return {
      currentScore,
      scoreLimit: config.score_limit,
      activeJoinsCount: activeJoins.length,
      lockdownActive: config.lockdown_active,
      isRaidImminent: currentScore >= (config.score_limit * 0.7)
    };
  }
}

module.exports = AntiraidEngine;
