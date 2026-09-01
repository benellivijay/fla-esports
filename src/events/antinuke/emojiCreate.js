const { AuditLogEvent } = require('discord.js');
const AuditLogResolver = require('../../antinuke/AuditLogResolver');
const SafetyChecker = require('../../antinuke/SafetyChecker');
const antinukeEngine = require('../../antinuke/AntinukeEngine');
const punishmentExecutor = require('../../antinuke/PunishmentExecutor');
const LogRouter = require('../../utils/LogRouter');
const EmbedGenerator = require('../../utils/embed');
const { ANTINUKE_CATEGORIES } = require('../../config/constants');

module.exports = {
  name: 'emojiCreate',
  async execute(emoji) {
    const { guild } = emoji;
    if (!guild) return;

    const resolved = await AuditLogResolver.resolveExecutor(guild, AuditLogEvent.EmojiCreate);
    const executor = resolved?.executor;

    if (executor) {
      const exemption = await SafetyChecker.checkExemption(guild, executor);
      if (!exemption.exempt) {
        const result = antinukeEngine.recordAction(guild.id, executor.id, ANTINUKE_CATEGORIES.EMOJI_STICKER_CREATE);
        if (result.triggered) {
          await punishmentExecutor.execute({
            guild,
            executor,
            category: ANTINUKE_CATEGORIES.EMOJI_STICKER_CREATE,
            threshold: result.limitCount,
            windowSeconds: result.timeWindowSeconds,
            punishment: result.punishment,
            target: `Emoji :${emoji.name}:`,
            details: 'Exceeded emoji creation rate limit'
          });
          return;
        }
      }
    }

    // Server Actions: Emoji Create Log
    const embed = EmbedGenerator.base()
      .setTitle('😀 Emoji Added')
      .setColor(0x57F287)
      .setThumbnail(emoji.url)
      .addFields(
        { name: 'Emoji', value: `${emoji} (\`:${emoji.name}:\`)`, inline: true },
        { name: 'Added By', value: executor ? `${executor.tag} (\`${executor.id}\`)` : '*Unknown*', inline: true },
        { name: 'Animated', value: emoji.animated ? 'Yes 🟢' : 'No ⚪', inline: true }
      )
      .setTimestamp();

    await LogRouter.log(guild, 'server', 'emoji_update', embed);
  }
};
