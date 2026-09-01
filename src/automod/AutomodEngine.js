const spamTracker = require('./SpamTracker');
const moderationManager = require('../database/managers/ModerationManager');
const antinukeManager = require('../database/managers/AntinukeManager');
const featureManager = require('../database/managers/FeatureManager');
const isBotOwner = require('../utils/isBotOwner');
const EmbedGenerator = require('../utils/embed');
const Logger = require('../utils/logger');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const path = require('node:path');
const fs = require('node:fs');

const INVITE_REGEX = /(https?:\/\/)?(www\.)?(discord\.(gg|io|me|li)|discordapp\.com\/invite|discord\.com\/invite)\/[a-zA-Z0-9_-]+/i;
const URL_REGEX = /https?:\/\/[^\s]+/i;
const CUSTOM_EMOJI_REGEX = /<a?:([a-zA-Z0-9_]+):[0-9]+>/g;
const UNICODE_EMOJI_REGEX = /(\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Emoji})/gu;

const NSFW_KEYWORDS = [
  'xhamster', 'pornhub', 'xvideos', 'xnxx', 'redtube', 'youporn', 'onlyfans',
  'chaturbate', 'rule34', 'e621', 'hentai', 'porn', 'xxx', 'nsfw', 'sex',
  'erotic', 'adult', 'nude', 'naked', 'cam4', 'stripchat', 'bongacams',
  'brazzers', 'bra', 'bikini', 'boob', 'boobs', 'tits', 'titties', 'ass',
  'pussy', 'dick', 'cock', 'vagina', 'penis', 'lewd', 'ecchi', 'nudes',
  'dildo', 'masturbat', 'orgasm', 'thong', 'lingerie'
];

const DEFAULT_BADWORDS = [
  // English Profanities
  'fuck', 'shit', 'bitch', 'slut', 'whore', 'bastard', 'cunt', 'dick', 'pussy',
  'asshole', 'motherfucker', 'cock', 'fucker', 'bullshit', 'nigger', 'faggot', 'retard',
  // Tamil Profanities
  'sunni', 'punda', 'punde', 'otha', 'othala', 'thevidiya', 'thevudya', 'thevadiya',
  'baadu', 'poolu', 'munda', 'kena', 'kenapunda', 'mayiru', 'mayire', 'savu',
  'potta', 'echa', 'gommala', 'omala', 'kundhi', 'soothu', 'soothula',
  'umbu', 'oombu', 'ombu', 'oombuda', 'umbuda', 'oombunga', 'umbunga', 'oomba', 'oombi', 'umbi', 'oombathaa',
  'loosu', 'lusu', 'loosuda', 'lusuda', 'loosunga', 'loosupunda', 'loosukena', 'loosupayale',
  'mavane', 'mavana', 'punda mavane', 'pundamavane', 'oombu da punda mavane', 'oombuda punda mavane', 'kundhi mavane', 'gomma', 'gommale',
  // Hindi & Indian Profanities
  'chutiya', 'chutiye', 'bhosdike', 'bhosadi', 'madarchod', 'behenchod', 'bhenchod',
  'harami', 'lavada', 'lauda', 'lodu', 'choot', 'gaand', 'gandu', 'randi', 'saala', 'kamina', 'tatte'
];

const ROAST_QUOTES = [
  '"Bro is speedrunning consequences. ⚡"',
  '"Bro is testing the bot\'s patience. 💀"',
  '"Bro thought he was safe. 🚨"',
  '"Bro is collecting warnings like Pokémon cards. 🎴"',
  '"Bro really woke up and chose chaos today. 🗿"',
  '"Bro is typing faster than their brain can process. 🧠"',
  '"Bro is on thin ice and wearing roller skates. 🧊"',
  '"Bro is one warning away from a vacation. 🏖️"',
  '"Bro thinks server rules are just suggestions. 📜"',
  '"Bro is about to discover what 5 minutes of silence feels like. ⏳"',
  '"Bro is challenging the bot\'s reflexes. 🏎️"',
  '"Bro forgot the bot is always watching. 👁️"',
  '"Bro is speedrunning a server mute. 🎙️"',
  '"Bro took a severe wrong turn in chat. 🛑"'
];

const MEME_FILES = [
  'monkey_side_eye.gif',
  'confused_nick_young.gif',
  'popcorn.gif',
  'crying_laughing.gif',
  'homer_disappear.gif',
  'shaq_wiggle.gif'
];

// Memory cache to prevent repeating same GIF for a user
const lastUserGifs = new Map();

class AutomodEngine {
  /**
   * Scans an incoming message for automod violations
   */
  static async handleMessage(message) {
    if (!message.guild || message.author.id === message.client.user.id) return;

    const guild = message.guild;
    const author = message.author;

    // ─── MASTER EXEMPTION: Server Owner, Extra Owner, Bot Owner, and Whitelisted Users ───
    // They are completely exempt from ALL automod filters (can send links, images, attachments, invites, etc.)
    if (guild.ownerId === author.id) return false;
    if (antinukeManager.isExtraOwner(guild.id, author.id) || antinukeManager.isWhitelisted(guild.id, author.id)) return false;
    if (await isBotOwner(message.client, author.id)) return false;

    const member = message.member || (await guild.members.fetch(author.id).catch(() => null));

    const config = moderationManager.getAutomodConfig(guild.id);
    if (!config) return false;

    let violation = null;
    const content = message.content || '';
    const lowerContent = content.toLowerCase();

    // 1. Anti-NSFW Check (Text, Links, Custom Emojis, Attachments, Stickers)
    if (config.antinsfw) {
      if (NSFW_KEYWORDS.some(k => lowerContent.includes(k))) {
        violation = { type: 'Anti NSFW Link', reason: 'Posting prohibited adult, explicit, or NSFW content' };
      }

      if (!violation) {
        const customEmojiMatches = [...content.matchAll(/<a?:([a-zA-Z0-9_]+):[0-9]+>/g)];
        for (const match of customEmojiMatches) {
          const emojiName = match[1].toLowerCase();
          if (NSFW_KEYWORDS.some(k => emojiName.includes(k))) {
            violation = { type: 'Anti NSFW Link', reason: `NSFW emoji detected: :${emojiName}:` };
            break;
          }
        }
      }

      if (!violation && message.attachments.size > 0) {
        for (const att of message.attachments.values()) {
          const attName = (att.name || '').toLowerCase();
          const attUrl = (att.url || '').toLowerCase();
          if (NSFW_KEYWORDS.some(k => attName.includes(k) || attUrl.includes(k))) {
            violation = { type: 'Anti NSFW Link', reason: 'NSFW image attachment detected' };
            break;
          }
        }
      }

      if (!violation && message.stickers && message.stickers.size > 0) {
        for (const sticker of message.stickers.values()) {
          const sName = (sticker.name || '').toLowerCase();
          const sTags = (sticker.tags || '').toLowerCase();
          if (NSFW_KEYWORDS.some(k => sName.includes(k) || sTags.includes(k))) {
            violation = { type: 'Anti NSFW Link', reason: `NSFW sticker detected: ${sticker.name}` };
            break;
          }
        }
      }
    }

    // 2. Badwords / Profanity Check (Default dictionary + server custom badwords)
    if (!violation) {
      const allBadwords = [...DEFAULT_BADWORDS, ...(config.badwords_list || [])];
      const matched = allBadwords.find(word => {
        const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        return regex.test(content) || lowerContent.includes(word.toLowerCase());
      });

      if (matched) {
        violation = { type: 'Badwords Filter', reason: `Message contained prohibited profanity: "${matched}"` };
      }
    }

    // 3. Anti-Invite Check
    if (!violation && config.antiinvite && INVITE_REGEX.test(content)) {
      violation = { type: 'Anti Invites', reason: 'Posting unauthorized Discord server invites' };
    }

    // 4. Anti-Link Check (General unauthorized links & attachments)
    if (!violation && config.antilink && (URL_REGEX.test(content) || message.attachments.size > 0)) {
      violation = { type: 'Anti Link', reason: 'Posting unauthorized website links or attachments' };
    }

    // 5. Anti-Emoji Spam Check (Custom Emojis, Unicode Emojis, Stickers)
    if (!violation && config.antiemojispam) {
      const customEmojis = content.match(CUSTOM_EMOJI_REGEX) || [];
      const unicodeEmojis = content.match(UNICODE_EMOJI_REGEX) || [];
      const stickerCount = message.stickers ? message.stickers.size : 0;
      const totalEmojis = customEmojis.length + unicodeEmojis.length + stickerCount;

      const textWithoutEmojis = content.replace(CUSTOM_EMOJI_REGEX, '').replace(UNICODE_EMOJI_REGEX, '').trim();
      const threshold = textWithoutEmojis.length === 0 ? 3 : 5;

      if (totalEmojis >= threshold) {
        violation = { type: 'Anti Emoji Spam', reason: `Excessive emoji spam (${totalEmojis} emojis)` };
      }
    }

    // 6. Anti-Caps Check (>= 6 chars and >= 70% uppercase)
    if (!violation && config.anticaps && content.length >= 6) {
      const letters = content.replace(/[^a-zA-Z]/g, '');
      if (letters.length >= 6) {
        const uppercaseCount = letters.replace(/[^A-Z]/g, '').length;
        if (uppercaseCount / letters.length >= 0.7) {
          violation = { type: 'Anti Caps', reason: 'Excessive uppercase characters in message' };
        }
      }
    }

    // 7. Anti-Mass Mention Check
    const mentionCount = message.mentions.users.size + message.mentions.roles.size + (message.mentions.everyone ? 10 : 0);
    if (!violation && config.antimention && (mentionCount >= 5 || message.mentions.everyone)) {
      violation = { type: 'Anti Mass Mention', reason: `Exceeded mention threshold (${mentionCount} mentions)` };
    }

    // 8. Anti-Spam Check
    if (!violation && config.antispam && spamTracker.isSpamming(guild.id, author.id, 5, 3000)) {
      violation = { type: 'Anti Spam', reason: 'Sending messages too rapidly (Message Flood)' };
    }

    // Handle Violation
    if (violation) {
      Logger.info(`[AUTOMOD INTERCEPT] Guild: ${guild.name} | User: ${author.tag} | Violation: ${violation.type} (${violation.reason})`);

      // 1. Delete violating message immediately
      await message.delete().catch(err => {
        Logger.warn(`Could not delete automod message: ${err.message}`);
      });

      // 2. Add warning and calculate current count (Limit: 2 warnings)
      moderationManager.addWarning(guild.id, author.id, guild.client.user.id, `Automod: ${violation.type} - ${violation.reason}`);
      const userWarnings = moderationManager.getWarnings(guild.id, author.id);
      const maxWarnings = 2; // Updated limit from 4 to 2
      const currentWarnings = Math.min(userWarnings.length, maxWarnings);
      const isMaxReached = currentWarnings >= maxWarnings;

      // 3. Execute 5-minute timeout when 2 warnings (2/2) are reached
      if (isMaxReached) {
        if (member && member.moderatable) {
          await member.timeout(5 * 60 * 1000, `Automod: Reached 2/2 warnings (${violation.type})`).catch(err => {
            Logger.warn(`Timeout failed: ${err.message}`);
          });
        }
        // Reset warnings counter after punishment so next cycle begins fresh
        moderationManager.clearWarnings(guild.id, author.id);
      }

      // 4. Select unique roast and local reaction GIF
      const botName = guild.client.user.username.toUpperCase();
      const roast = ROAST_QUOTES[Math.floor(Math.random() * ROAST_QUOTES.length)];

      let description = `<@${author.id}>\n\n${roast}\n\n----------------------------------------\n⚠️ **WARNING (${currentWarnings}/${maxWarnings})**\n*Keep it respectful.*`;

      if (isMaxReached) {
        if (member && member.moderatable) {
          description += `\n\n🔇 **TIMEOUT (5 MINUTES)**: <@${author.id}> reached **${maxWarnings}/${maxWarnings}** warnings and has been timed out for 5 minutes!`;
        } else {
          description += `\n\n🔇 **TIMEOUT (5 MINUTES)**: <@${author.id}> reached **${maxWarnings}/${maxWarnings}** warnings! *(Note: Discord protects Server Owners & Admins from being timed out, but regular members will be timed out for 5 minutes).*`;
        }
      }

      const warningEmbed = new EmbedBuilder()
        .setColor(isMaxReached ? 0xFF0000 : 0xE91E63) // Red on timeout, Pink on warnings
        .setAuthor({
          name: `⚠️ ${botName} // WARNING (${currentWarnings}/${maxWarnings}) 👀`,
          iconURL: guild.client.user.displayAvatarURL({ dynamic: true })
        })
        .setDescription(description);

      // Select distinct local meme GIF attachment (100% reliable direct Discord CDN attachment)
      const lastGif = lastUserGifs.get(author.id);
      const availableGifs = MEME_FILES.filter(g => g !== lastGif);
      const selectedFile = availableGifs[Math.floor(Math.random() * availableGifs.length)] || MEME_FILES[0];
      lastUserGifs.set(author.id, selectedFile);

      const localMemePath = path.join(__dirname, '..', '..', 'assets', 'memes', selectedFile);
      const attachments = [];

      if (fs.existsSync(localMemePath)) {
        const fileAttachment = new AttachmentBuilder(localMemePath, { name: selectedFile });
        warningEmbed.setImage(`attachment://${selectedFile}`);
        attachments.push(fileAttachment);
      }

      // Send the warning permanently with local attachment
      await message.channel.send({
        embeds: [warningEmbed],
        files: attachments
      }).catch(() => null);

      // 5. Send to Security Logging Channel
      const logConfig = featureManager.getLoggingConfig(guild.id);
      const targetChannelId = logConfig?.antinuke_channel_id || logConfig?.general_channel_id;
      if (targetChannelId) {
        const logChannel = guild.channels.cache.get(targetChannelId);
        if (logChannel && logChannel.isTextBased()) {
          const logEmbed = EmbedGenerator.base()
            .setTitle(`🅰️ Automod Interception: ${violation.type}`)
            .addFields(
              { name: 'User', value: `${author.tag} (\`${author.id}\`)`, inline: true },
              { name: 'Channel', value: `${message.channel} (\`${message.channel.id}\`)`, inline: true },
              { name: 'Warnings Count', value: `\`${currentWarnings}/${maxWarnings}\``, inline: true },
              { name: 'Action', value: isMaxReached ? '`TIMEOUT (5 MINUTES)`' : '`WARN`', inline: true },
              { name: 'Reason', value: violation.reason },
              { name: 'Content', value: `\`\`\`${(content || '*Attachment/Sticker*').slice(0, 500)}\`\`\`` }
            );
          await logChannel.send({ embeds: [logEmbed] }).catch(() => null);
        }
      }
    }
  }
}

module.exports = AutomodEngine;
