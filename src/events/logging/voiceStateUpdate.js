const { ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const extraFeaturesManager = require('../../database/managers/ExtraFeaturesManager');
const voicemasterCommand = require('../../commands/utility/voicemaster');
const LogRouter = require('../../utils/LogRouter');
const Logger = require('../../utils/logger');
const micGuardEngine = require('../../antimic/MicGuardEngine');

function createVoiceEmbed(title, member, channelContent, color = 0x5865F2) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
    .setDescription(
      `**User:** <@${member.id}>\n( ${member.id} )\n${channelContent}`
    )
    .setTimestamp();
}

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState) {
    const guild = newState.guild || oldState.guild;
    const member = newState.member || oldState.member;
    if (!guild || member?.user.bot) return;

    // Clean up MicGuard active streams when leaving or moving
    if (oldState.channelId && (!newState.channelId || oldState.channelId !== newState.channelId)) {
      micGuardEngine.cleanupUser(member.id);
    }

    // Auto-subscribe member if joining a guarded voice channel
    if (newState.channelId) {
      try {
        const { getVoiceConnection } = require('@discordjs/voice');
        const conn = getVoiceConnection(guild.id);
        if (conn && conn.joinConfig.channelId === newState.channelId && conn.receiver) {
          micGuardEngine.subscribeUser(conn.receiver, guild, member.id);
        }
      } catch {}
    }

    // 1. VoiceMaster: Dynamic Join-to-Create Temporary Voice Channels
    const vmConfig = extraFeaturesManager.getVoiceMasterConfig(guild.id);
    if (vmConfig && vmConfig.enabled && vmConfig.channel_id) {
      // User joined the VoiceMaster trigger channel
      if (newState.channelId === vmConfig.channel_id) {
        try {
          const tempChannel = await guild.channels.create({
            name: `${member.displayName || member.user.username}'s Room`,
            type: ChannelType.GuildVoice,
            parent: vmConfig.category_id,
            permissionOverwrites: [
              {
                id: member.id,
                allow: [
                  PermissionFlagsBits.ManageChannels,
                  PermissionFlagsBits.MuteMembers,
                  PermissionFlagsBits.DeafenMembers,
                  PermissionFlagsBits.MoveMembers,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.Connect
                ]
              }
            ],
            reason: `VoiceMaster temporary voice channel for ${member.user.tag}`
          });

          extraFeaturesManager.addTempVoice(tempChannel.id, guild.id, member.id);
          await member.voice.setChannel(tempChannel);

          let enabledButtons = ['all'];
          if (vmConfig.enabled_buttons) {
            try {
              enabledButtons = JSON.parse(vmConfig.enabled_buttons);
            } catch {
              enabledButtons = ['all'];
            }
          }
          const embed = voicemasterCommand.buildVoiceMasterInterfaceEmbed(enabledButtons);
          const components = voicemasterCommand.buildVoiceMasterInterfaceComponents(enabledButtons);
          await tempChannel.send({ embeds: [embed], components }).catch(err => {
            Logger.warn(`Failed to send VoiceMaster interface to voice room: ${err.message}`);
          });
        } catch (err) {
          Logger.error(`VoiceMaster channel creation failed: ${err.message}`);
        }
      }

      // Check if user left a temporary voice channel and it is now empty
      if (oldState.channelId && oldState.channelId !== vmConfig.channel_id) {
        const tempVoice = extraFeaturesManager.getTempVoice(oldState.channelId);
        if (tempVoice) {
          const oldChannel = guild.channels.cache.get(oldState.channelId);
          if (oldChannel && oldChannel.members.size === 0) {
            extraFeaturesManager.removeTempVoice(oldState.channelId);
            await oldChannel.delete('VoiceMaster temporary channel empty').catch(() => null);
          }
        }
      }
    }

    // 2. Voice Logging
    const logs = [];

    // Case A: User Joined Voice Channel (was not in any VC before)
    if (!oldState.channelId && newState.channelId) {
      logs.push(
        createVoiceEmbed(
          'Joined Voice Channel',
          member,
          `**Channel:** <#${newState.channelId}>`,
          0x57F287
        )
      );
    }
    // Case B: User Left Voice Channel (disconnected completely)
    else if (oldState.channelId && !newState.channelId) {
      logs.push(
        createVoiceEmbed(
          'Left Voice Channel',
          member,
          `**Channel:** <#${oldState.channelId}>`,
          0xED4245
        )
      );
    }
    // Case C: User Switched from one Voice Channel to another
    else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      logs.push(
        createVoiceEmbed(
          'Switched Voice Channel',
          member,
          `**From:** <#${oldState.channelId}>\n**To:** <#${newState.channelId}>`,
          0x5865F2
        )
      );
    }
    // Case D: User is staying in the SAME voice channel — check for active state changes
    else if (oldState.channelId && newState.channelId && oldState.channelId === newState.channelId) {
      // Self Mute / Unmute
      if (Boolean(oldState.selfMute) !== Boolean(newState.selfMute)) {
        logs.push(
          createVoiceEmbed(
            newState.selfMute ? 'Self Muted' : 'Self Unmuted',
            member,
            `**Channel:** <#${newState.channelId}>`,
            newState.selfMute ? 0xED4245 : 0x57F287
          )
        );
      }

      // Self Deafen / Undeafen
      if (Boolean(oldState.selfDeaf) !== Boolean(newState.selfDeaf)) {
        logs.push(
          createVoiceEmbed(
            newState.selfDeaf ? 'Self Deafened' : 'Self Undeafened',
            member,
            `**Channel:** <#${newState.channelId}>`,
            newState.selfDeaf ? 0xED4245 : 0x57F287
          )
        );
      }

      // Server Mute / Unmute
      if (Boolean(oldState.serverMute) !== Boolean(newState.serverMute)) {
        logs.push(
          createVoiceEmbed(
            newState.serverMute ? 'Server Muted' : 'Server Unmuted',
            member,
            `**Channel:** <#${newState.channelId}>`,
            newState.serverMute ? 0xED4245 : 0x57F287
          )
        );
      }

      // Server Deafen / Undeafen
      if (Boolean(oldState.serverDeaf) !== Boolean(newState.serverDeaf)) {
        logs.push(
          createVoiceEmbed(
            newState.serverDeaf ? 'Server Deafened' : 'Server Undeafened',
            member,
            `**Channel:** <#${newState.channelId}>`,
            newState.serverDeaf ? 0xED4245 : 0x57F287
          )
        );
      }

      // Screen Share / Streaming
      if (Boolean(oldState.streaming) !== Boolean(newState.streaming)) {
        logs.push(
          createVoiceEmbed(
            newState.streaming ? 'Started Screen Share' : 'Stopped Screen Share',
            member,
            `**Channel:** <#${newState.channelId}>`,
            newState.streaming ? 0x57F287 : 0xED4245
          )
        );
      }

      // Camera / Video
      if (Boolean(oldState.selfVideo) !== Boolean(newState.selfVideo)) {
        logs.push(
          createVoiceEmbed(
            newState.selfVideo ? 'Started Video' : 'Stopped Video',
            member,
            `**Channel:** <#${newState.channelId}>`,
            newState.selfVideo ? 0x57F287 : 0xED4245
          )
        );
      }
    }

    // Send all generated voice event embeds through LogRouter
    for (const embed of logs) {
      await LogRouter.log(guild, 'voice', 'voice', embed);
    }
  }
};
