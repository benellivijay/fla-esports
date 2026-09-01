const { AuditLogEvent, PermissionFlagsBits } = require('discord.js');
const AuditLogResolver = require('../../antinuke/AuditLogResolver');
const SafetyChecker = require('../../antinuke/SafetyChecker');
const antinukeEngine = require('../../antinuke/AntinukeEngine');
const punishmentExecutor = require('../../antinuke/PunishmentExecutor');
const LogRouter = require('../../utils/LogRouter');
const EmbedGenerator = require('../../utils/embed');
const { ANTINUKE_CATEGORIES } = require('../../config/constants');

module.exports = {
  name: 'guildMemberUpdate',
  async execute(oldMember, newMember) {
    const { guild } = newMember;

    // 1. Check if roles were added or removed
    const addedRoles = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
    const removedRoles = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));

    if (addedRoles.size > 0 || removedRoles.size > 0) {
      const resolved = await AuditLogResolver.resolveExecutor(guild, AuditLogEvent.MemberRoleUpdate, newMember.id);
      const executor = resolved?.executor;

      if (executor) {
        const exemption = await SafetyChecker.checkExemption(guild, executor);
        if (!exemption.exempt && addedRoles.size > 0) {
          const hasDangerousPerms = addedRoles.some(r =>
            r.permissions.has(PermissionFlagsBits.Administrator) ||
            r.permissions.has(PermissionFlagsBits.BanMembers) ||
            r.permissions.has(PermissionFlagsBits.ManageGuild)
          );

          const category = hasDangerousPerms ? ANTINUKE_CATEGORIES.INVITE_ROLE_GRANT : ANTINUKE_CATEGORIES.MEMBER_UPDATE;
          const result = antinukeEngine.recordAction(guild.id, executor.id, category);

          if (result.triggered) {
            await newMember.roles.remove(addedRoles, 'Mia Antinuke: Unauthorized role grant').catch(() => null);

            await punishmentExecutor.execute({
              guild,
              executor,
              category,
              threshold: result.limitCount,
              windowSeconds: result.timeWindowSeconds,
              punishment: result.punishment,
              target: `${newMember.user.tag} (\`${newMember.id}\`)`,
              details: `Unauthorized role grant detected: ${addedRoles.map(r => `@${r.name}`).join(', ')}`
            });
            return;
          }
        }
      }

      // Member Role Changes Log
      const roleEmbed = EmbedGenerator.base()
        .setTitle('🎭 Member Roles Updated')
        .setColor(0x5865F2)
        .addFields(
          { name: 'Member', value: `${newMember.user.tag} (${newMember})`, inline: true },
          { name: 'Updated By', value: executor ? `${executor.tag} (\`${executor.id}\`)` : '*Self / Bot*', inline: true }
        );

      if (addedRoles.size > 0) {
        roleEmbed.addFields({ name: '➕ Roles Added', value: addedRoles.map(r => `${r}`).join(', ') });
      }
      if (removedRoles.size > 0) {
        roleEmbed.addFields({ name: '➖ Roles Removed', value: removedRoles.map(r => `${r}`).join(', ') });
      }
      roleEmbed.setTimestamp();

      await LogRouter.log(guild, 'member', 'member_update', roleEmbed);
    }

    // 2. Nickname Changes
    if (oldMember.nickname !== newMember.nickname) {
      const resolved = await AuditLogResolver.resolveExecutor(guild, AuditLogEvent.MemberUpdate, newMember.id);
      const executor = resolved?.executor;

      if (executor) {
        const exemption = await SafetyChecker.checkExemption(guild, executor);
        if (!exemption.exempt) {
          const result = antinukeEngine.recordAction(guild.id, executor.id, ANTINUKE_CATEGORIES.MEMBER_UPDATE);
          if (result.triggered) {
            await punishmentExecutor.execute({
              guild,
              executor,
              category: ANTINUKE_CATEGORIES.MEMBER_UPDATE,
              threshold: result.limitCount,
              windowSeconds: result.timeWindowSeconds,
              punishment: result.punishment,
              target: `${newMember.user.tag} (\`${newMember.id}\`)`,
              details: `Exceeded member modifications limit (${result.limitCount} updates in ${result.timeWindowSeconds}s)`
            });
            return;
          }
        }
      }

      const nickEmbed = EmbedGenerator.base()
        .setTitle('✏️ Member Nickname Changed')
        .setColor(0xFEE75C)
        .addFields(
          { name: 'Member', value: `${newMember.user.tag} (${newMember})`, inline: true },
          { name: 'Updated By', value: executor ? `${executor.tag} (\`${executor.id}\`)` : '*Self*', inline: true },
          { name: 'Before', value: oldMember.nickname || oldMember.user.username, inline: true },
          { name: 'After', value: newMember.nickname || newMember.user.username, inline: true }
        )
        .setTimestamp();

      await LogRouter.log(guild, 'member', 'member_update', nickEmbed);
    }

    // 3. Timeout Updates
    if (oldMember.communicationDisabledUntilTimestamp !== newMember.communicationDisabledUntilTimestamp) {
      const isTimedOut = newMember.isCommunicationDisabled();
      const timeoutEmbed = EmbedGenerator.base()
        .setTitle(isTimedOut ? '🔇 Member Timed Out' : '🔊 Member Timeout Removed')
        .setColor(isTimedOut ? 0xED4245 : 0x57F287)
        .addFields(
          { name: 'Target', value: `${newMember.user.tag} (${newMember})`, inline: true },
          {
            name: isTimedOut ? 'Timeout Expires' : 'Status',
            value: isTimedOut ? `<t:${Math.floor(newMember.communicationDisabledUntilTimestamp / 1000)}:R>` : 'Timeout ended',
            inline: true
          }
        )
        .setTimestamp();

      await LogRouter.log(guild, 'mod', 'mod', timeoutEmbed);
    }

    // 4. Server Avatar (Guild Avatar) Changed
    if (oldMember.avatar !== newMember.avatar) {
      const avatarEmbed = EmbedGenerator.base()
        .setTitle('🖼️ Server Avatar Changed')
        .setColor(0x5865F2)
        .setThumbnail(newMember.displayAvatarURL({ dynamic: true, size: 256 }))
        .addFields(
          { name: 'Member', value: `${newMember.user.tag} (${newMember})`, inline: true }
        )
        .setTimestamp();

      await LogRouter.log(guild, 'member', 'member_update', avatarEmbed);
    }

    // 5. Server Boost Added / Removed
    if (!oldMember.premiumSince && newMember.premiumSince) {
      const boostEmbed = EmbedGenerator.base()
        .setTitle('🚀 Server Boost Added')
        .setColor(0xF47FFF)
        .setDescription(`${newMember} just boosted **${guild.name}**! 🎉`)
        .addFields(
          { name: 'Total Server Boosts', value: `**${guild.premiumSubscriptionCount || 1}** Boosts`, inline: true },
          { name: 'Server Tier', value: `Level ${guild.premiumTier}`, inline: true }
        )
        .setTimestamp();

      await LogRouter.log(guild, 'server', 'boost', boostEmbed);
    } else if (oldMember.premiumSince && !newMember.premiumSince) {
      const unboostEmbed = EmbedGenerator.base()
        .setTitle('💔 Server Boost Removed')
        .setColor(0xED4245)
        .setDescription(`${newMember}'s server boost has ended or expired.`)
        .addFields(
          { name: 'Total Server Boosts', value: `**${guild.premiumSubscriptionCount || 0}** Boosts`, inline: true }
        )
        .setTimestamp();

      await LogRouter.log(guild, 'server', 'boost', unboostEmbed);
    }
  }
};
