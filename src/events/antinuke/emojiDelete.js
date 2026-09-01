const { AuditLogEvent } = require('discord.js');
const AuditLogResolver = require('../../antinuke/AuditLogResolver');
const SafetyChecker = require('../../antinuke/SafetyChecker');
const antinukeEngine = require('../../antinuke/AntinukeEngine');
const punishmentExecutor = require('../../antinuke/PunishmentExecutor');
const LogRouter = require('../../utils/LogRouter');
const EmbedGenerator = require('../../utils/embed');
const { ANTINUKE_CATEGORIES } = require('../../config/constants');

module.exports = {
  name: 'emojiDelete',
  async execute(emoji) {
    const { guild } = emoji;
    if (!guild) return;

    const resolved = await AuditLogResolver.resolveExecutor(guild, AuditLogEvent.EmojiDelete);
    const executor = resolved?.executor;

    if (executor) {
      const exemption = await SafetyChecker.checkExemption(guild, executor);
      if (!exemption.exempt) {
        const result = antinukeEngine.recordAction(guild.id, executor.id, ANTINUKE_CATEGORIES.EMOJI_STICKER_DELETE);
        if (result.triggered) {
          await punishmentExecutor.execute({
            guild,
            executor,
            category: ANTINUKE_CATEGORIES.EMOJI_STICKER_DELETE,
            threshold: result.limitCount,
            windowSeconds: result.timeWindowSeconds,
            punishment: result.punishment,
            target: `Emoji :${emoji.name}:`,
            details: 'Exceeded emoji deletion rate limit'
          });
          return;
        }
      }
    }

    // Server Actions: Emoji Delete Log
    const embed = EmbedGenerator.base()
      .setTitle('🗑️ Emoji Removed')
      .setColor(0xED4245)
      .addFields(
        { name: 'Emoji Name', value: `\`:${emoji.name}:\` (\`${emoji.id}\`)`, inline: true },
        { name: 'Deleted By', value: executor ? `${executor.tag} (\`${executor.id}\`)` : '*Unknown*', inline: true }
      )
      .setTimestamp();

    await LogRouter.log(guild, 'server', 'emoji_update', embed);
  }
};
