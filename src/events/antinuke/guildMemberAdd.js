const { AuditLogEvent } = require('discord.js');
const AuditLogResolver = require('../../antinuke/AuditLogResolver');
const SafetyChecker = require('../../antinuke/SafetyChecker');
const antinukeEngine = require('../../antinuke/AntinukeEngine');
const punishmentExecutor = require('../../antinuke/PunishmentExecutor');
const AntiraidEngine = require('../../antiraid/AntiraidEngine');
const featureManager = require('../../database/managers/FeatureManager');
const { formatWelcomePayload } = require('../../commands/welcomer/welcomer');
const LogRouter = require('../../utils/LogRouter');
const EmbedGenerator = require('../../utils/embed');
const { ANTINUKE_CATEGORIES } = require('../../config/constants');
const Logger = require('../../utils/logger');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    const { guild, user } = member;

    // 1. Antinuke: Unauthorized Bot Addition Protection
    if (user.bot) {
      const botAddLog = await AuditLogResolver.resolveExecutor(guild, AuditLogEvent.BotAdd, user.id, 8000);
      if (botAddLog && botAddLog.executor) {
        const executor = botAddLog.executor;
        const exemption = await SafetyChecker.checkExemption(guild, executor);
        if (!exemption.exempt) {
          const result = antinukeEngine.recordAction(guild.id, executor.id, ANTINUKE_CATEGORIES.BOT_ADD);
          if (result.triggered) {
            await member.kick('Mia Antinuke: Unauthorized bot addition').catch(() => null);

            await punishmentExecutor.execute({
              guild,
              executor,
              category: ANTINUKE_CATEGORIES.BOT_ADD,
              threshold: result.limitCount,
              windowSeconds: result.timeWindowSeconds,
              punishment: result.punishment,
              target: `${user.tag} (\`${user.id}\`)`,
              details: `Unauthorized bot was added to the server and immediately removed.`
            });
            return;
          }
        }
      }
    }

    // 2. Score-Based Anti-Raid Defense Evaluation (Human users)
    if (!user.bot) {
      const raidResult = await AntiraidEngine.evaluateMember(member);
      if (raidResult.isRaid) {
        // Raid was intercepted and raiders suppressed by AntiraidEngine
        return;
      }
    }

    // 3. Auto-Role Assignment
    const welcomerConfig = featureManager.getWelcomerConfig(guild.id);
    if (user.bot && welcomerConfig?.bot_auto_role_id) {
      const botRole = guild.roles.cache.get(welcomerConfig.bot_auto_role_id);
      if (botRole && member.manageable) {
        await member.roles.add(botRole, 'Auto-Role for bot').catch(() => null);
      }
    } else if (!user.bot && welcomerConfig?.auto_role_id) {
      const memberRole = guild.roles.cache.get(welcomerConfig.auto_role_id);
      if (memberRole && member.manageable) {
        await member.roles.add(memberRole, 'Auto-Role for member').catch(() => null);
      }
    }

    // 3. Welcomer Greeting
    if (welcomerConfig?.enabled && welcomerConfig?.channel_id) {
      const welcomeChannel = guild.channels.cache.get(welcomerConfig.channel_id);
      if (welcomeChannel && welcomeChannel.isTextBased()) {
        const payload = formatWelcomePayload(guild, member, welcomerConfig);
        await welcomeChannel.send({
          content: payload.content || undefined,
          embeds: payload.embeds
        }).catch(() => null);
      }
    }

    // 4. Member Actions Audit Logging for Joins
    const logEmbed = EmbedGenerator.base()
      .setTitle('📥 Member Joined Server')
      .setColor(0x57F287)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: 'User', value: `${user.tag} (\`${user.id}\`)`, inline: true },
        { name: 'Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
        { name: 'Member Count', value: `**#${guild.memberCount}**`, inline: true }
      )
      .setTimestamp();

    await LogRouter.log(guild, 'member', 'joins', logEmbed);
  }
};
