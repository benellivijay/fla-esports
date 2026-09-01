const AutomodEngine = require('../../automod/AutomodEngine');
const extraFeaturesManager = require('../../database/managers/ExtraFeaturesManager');
const guildManager = require('../../database/managers/GuildManager');
const musicManager = require('../../music/MusicManager');
const helpCommand = require('../../commands/utility/help');
const loggingCommand = require('../../commands/utility/logging');
const loggingManager = require('../../database/managers/LoggingManager');
const antiraidCommand = require('../../commands/security/antiraid');
const antiraidManager = require('../../database/managers/AntiraidManager');
const AntiraidEngine = require('../../antiraid/AntiraidEngine');
const voicemasterCommand = require('../../commands/utility/voicemaster');
const spamCommand = require('../../commands/utility/spam');
const welcomerCommand = require('../../commands/welcomer/welcomer');
const featureManager = require('../../database/managers/FeatureManager');
const antimicCommand = require('../../commands/security/antimic');
const micGuardManager = require('../../database/managers/MicGuardManager');
const micGuardEngine = require('../../antimic/MicGuardEngine');
const vcStatManager = require('../../database/managers/VcStatManager');
const vcStatUpdater = require('../../utils/VcStatUpdater');
const isBotOwner = require('../../utils/isBotOwner');
const brandingManager = require('../../database/managers/BrandingManager');
const brandingCommand = require('../../commands/utility/branding');
const reactionRoleEditor = require('../../commands/reactionrole/ReactionRoleEditor');
const { joinVoiceChannel, getVoiceConnection, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const EmbedGenerator = require('../../utils/embed');
const PermissionHelper = require('../../utils/permissions');
const Logger = require('../../utils/logger');
const { EMOJIS } = require('../../config/constants');
const { PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    if (!message.guild || message.author.id === client.user.id) return;

    // 1. Run Anti-Raid Chat Defense (Mass Mentions, Rogue Bot Attacks, Flood Raids)
    const raidActionTaken = await AntiraidEngine.evaluateMessage(message);
    if (raidActionTaken) return;

    // 2. Run Automod scanning (Bad words, links, invites, spam)
    const automodActionTaken = await AutomodEngine.handleMessage(message);
    if (automodActionTaken) return;

    // Stop bot accounts from triggering prefix commands or autoresponders
    if (message.author.bot) return;

    // 3. Check Custom Autoresponders
    const autoresponder = extraFeaturesManager.getAutoresponder(message.guild.id, message.content.trim());
    if (autoresponder) {
      await message.channel.send(autoresponder.reply).catch(() => null);
      return;
    }

    // 3. Prefix Command Support (Supports custom server prefix, ?, !, and ,)
    const guildSettings = guildManager.getGuild(message.guild.id);
    const customPrefix = guildSettings?.prefix || '?';
    
    let matchedPrefix = null;
    const prefixes = [customPrefix, '?', '!', ','];
    for (const p of prefixes) {
      if (message.content.startsWith(p)) {
        matchedPrefix = p;
        break;
      }
    }

    if (matchedPrefix) {
      Logger.info(`[PREFIX] Command detected: "${message.content}" by ${message.author.tag}`);
      const args = message.content.slice(matchedPrefix.length).trim().split(/ +/);
      const commandName = args.shift().toLowerCase();

      // ─── MASTER OWNER GATEKEEPER ───────────────────────────────
      // All prefix commands can ONLY be run by Server Owner, Extra Owner, or Bot Owner
      const isAuthorized = await PermissionHelper.isCommandAuthorized(message.guild, message.author, client);
      if (!isAuthorized) {
        return message.reply({
          embeds: [
            EmbedGenerator.error(
              'Permission Denied',
              '❌ You are not authorized to run commands on this bot.\n\n' +
              '🔒 Commands can only be executed by:\n' +
              '• 👑 **Server Owner**\n' +
              '• 🛡️ **Extra Owners**\n' +
              '• 🤖 **Bot Owner**'
            )
          ]
        });
      }

      // ─── ?vc / !!vc — Voice Channel Status Tracker ───────────────────────────────
      if (commandName === 'vc' || commandName === '!vc') {
        if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
          return message.reply('❌ You need **Manage Server** permission to use this command.');
        }

        const sub = (args[0] || '').toLowerCase();

        if (sub === 'add') {
          // Accept both #mention and raw channel ID
          const channelIdArg = args[1]; // second arg after 'add'
          let channel = message.mentions.channels.first()
            || (channelIdArg && message.guild.channels.cache.get(channelIdArg));

          if (!channel) {
            return message.reply('❌ Please provide a voice channel (mention or ID).\n**Example:** `?vc add #Voice-Channel {totalusers} Members`\n**Or:** `?vc add 1539983322392961144 {totalusers} Members`');
          }
          if (!channel.isVoiceBased()) {
            return message.reply('❌ That channel must be a **voice channel**, not a text channel.');
          }

          // Extract template: everything after the channel mention or ID
          let template;
          const mentionStr = `<#${channel.id}>`;
          if (message.content.includes(mentionStr)) {
            template = message.content.slice(message.content.indexOf(mentionStr) + mentionStr.length).trim();
          } else {
            // Channel was provided as raw ID — skip 'vc add <id>' then take rest
            const afterId = message.content.slice(message.content.indexOf(channelIdArg) + channelIdArg.length).trim();
            template = afterId;
          }

          if (!template) {
            return message.reply(
              '❌ Please provide a status template after the channel.\n' +
              '**Placeholders:** `{totalusers}` `{onlineusers}` `{activevc}` `{vcusers}`\n' +
              '**Example:** `?vc add #General-VC {totalusers} Members`'
            );
          }

          vcStatManager.add(message.guild.id, channel.id, template);
          // Set voice channel status immediately
          await vcStatUpdater.updateSingle(message.guild.id, channel.id);

          const previewStatus = vcStatUpdater.buildStatus(template, message.guild);

          return message.reply({
            embeds: [
              EmbedGenerator.success(
                '✅ Voice Channel Status Configured',
                `**Channel:** <#${channel.id}>\n` +
                `**Template:** \`${template}\`\n` +
                `**Current Status:** \`${previewStatus}\`\n\n` +
                `*The channel name will remain unchanged — only the Voice Channel Status text is updated automatically every 2 minutes.*\n\n` +
                `📌 **Available Placeholders:**\n` +
                `\`{totalusers}\` — Total server members\n` +
                `\`{onlineusers}\` — Online members\n` +
                `\`{activevc}\` — Active voice channels\n` +
                `\`{vcusers}\` — Users in voice channels`
              )
            ]
          });
        }

        if (sub === 'remove') {
          const channelIdArg = args[1];
          const channel = message.mentions.channels.first()
            || (channelIdArg && message.guild.channels.cache.get(channelIdArg));
          if (!channel) {
            return message.reply('❌ Please provide the channel to remove (mention or ID).\n**Example:** `?vc remove #channel` or `?vc remove 1539983322392961144`');
          }
          vcStatManager.remove(message.guild.id, channel.id);
          await vcStatUpdater.clearStatus(channel.id);
          return message.reply({
            embeds: [EmbedGenerator.success('✅ Status Cleared', `Removed status tracking and cleared status for <#${channel.id}>.`)]
          });
        }

        if (sub === 'list') {
          const trackers = vcStatManager.getAll(message.guild.id);
          if (!trackers.length) {
            return message.reply('❌ No VC status trackers configured in this server. Use `?vc add #channel <status>` to add one.');
          }
          const lines = trackers.map(t => {
            const current = vcStatUpdater.buildStatus(t.template, message.guild);
            return `• <#${t.channel_id}> → \`${t.template}\` *(Current: "${current}")*`;
          }).join('\n');
          return message.reply({
            embeds: [
              EmbedGenerator.base()
                .setTitle('📊 Active Voice Channel Status Trackers')
                .setDescription(lines)
                .setColor(0x5865F2)
                .setFooter({ text: 'Updates voice channel status every 2 minutes' })
            ]
          });
        }

        // Default — show help
        return message.reply({
          embeds: [
            EmbedGenerator.base()
              .setTitle('🌸 Voice Channel Status Tracker')
              .setColor(0x5865F2)
              .setDescription(
                '**Display live server stats as the Voice Channel Status without renaming your channel.**\n\n' +
                '**Available Commands:**\n' +
                '`?vc add #channel <status>` (or `!!vc add #channel <status>`) — Set up VC status tracking\n' +
                '`?vc remove #channel` — Remove VC status tracking & clear status\n' +
                '`?vc list` — View all active VC status trackers\n\n' +
                '**Placeholders for status:**\n' +
                '`{totalusers}` — Total server members\n' +
                '`{onlineusers}` — Online members (online/idle/dnd)\n' +
                '`{activevc}` — Active voice channels (with users)\n' +
                '`{vcusers}` — Total users connected to voice\n\n' +
                '**Examples:**\n' +
                '`?vc add #General-VC {totalusers} Members`\n' +
                '`?vc add 1539983322392961144 {onlineusers} Online • {vcusers} in VC`'
              )
          ]
        });
      }

      // Logging Prefix Commands (,logging setup | ,logging auto setup | ,logging config | ,logging enable | ,logging disable | ,logging reset)
      if (commandName === 'logging' || commandName === 'logs') {
        const member = message.member || (await message.guild.members.fetch(message.author.id).catch(() => null));
        if (!member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
          return message.reply({ embeds: [EmbedGenerator.error('Permission Denied', 'You need `Manage Server` permissions to configure logging.')] });
        }


        const action = (args[0] || '').toLowerCase();
        const subAction = (args[1] || '').toLowerCase();

        if (action === 'auto' || (action === 'auto' && subAction === 'setup')) {
          const statusMsg = await message.reply('⏳ Creating dedicated logging category and 7 specialized channels...');
          try {
            const { category, createdChannels } = await loggingCommand.executeAutoSetup(message.guild);
            const embed = new EmbedBuilder()
              .setColor(0x06B6D4)
              .setTitle('✨ Logging Auto Setup Complete')
              .setDescription(
                `Successfully created category **${category.name}** and 7 specialized logging channels:\n\n` +
                `• 👥 **Member Logs:** <#${createdChannels.memberChannelId}>\n` +
                `• 💬 **Message Logs:** <#${createdChannels.messageChannelId}>\n` +
                `• 🔊 **Voice Logs:** <#${createdChannels.voiceChannelId}>\n` +
                `• 🌐 **Server Logs:** <#${createdChannels.serverChannelId}>\n` +
                `• 📁 **Channel Logs:** <#${createdChannels.channelChannelId}>\n` +
                `• 🎭 **Role Logs:** <#${createdChannels.roleChannelId}>\n` +
                `• 🛡️ **Mod Logs:** <#${createdChannels.modChannelId}>\n\n` +
                `*All audit events are now actively monitored and routed!*`
              )
              .setTimestamp();
            return statusMsg.edit({ content: null, embeds: [embed] });
          } catch (err) {
            return statusMsg.edit({ content: null, embeds: [EmbedGenerator.error('Setup Failed', `Failed to create channels: ${err.message}`)] });
          }
        }

        if (action === 'enable') {
          loggingManager.setEnabled(message.guild.id, true);
          return message.reply({ embeds: [EmbedGenerator.success('Logging Enabled', 'The server logging module has been turned **ON 🟢**.')] });
        }

        if (action === 'disable') {
          loggingManager.setEnabled(message.guild.id, false);
          return message.reply({ embeds: [EmbedGenerator.success('Logging Disabled', 'The server logging module has been turned **OFF 🔴**.')] });
        }

        if (action === 'reset') {
          loggingManager.resetConfig(message.guild.id);
          return message.reply({ embeds: [EmbedGenerator.success('Logging Reset', 'All logging configurations have been wiped and reset.')] });
        }

        if (action === 'config' || action === 'status') {
          const embed = loggingCommand.buildLoggingSetupEmbed(message.guild);
          return message.reply({ embeds: [embed] });
        }

        // Default or "setup": Show interactive dashboard
        const embed = loggingCommand.buildLoggingSetupEmbed(message.guild);
        const components = loggingCommand.buildLoggingComponents(message.guild);
        return message.reply({ embeds: [embed], components });
      }

      // Anti-Raid Prefix Commands (,antiraid setup | ,antiraid config | ,antiraid preset | ,antiraid lockdown | ,antiraid unlock)
      if (commandName === 'antiraid' || commandName === 'raid') {
        const member = message.member || (await message.guild.members.fetch(message.author.id).catch(() => null));
        if (!member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
          return message.reply({ embeds: [EmbedGenerator.error('Permission Denied', 'You need `Manage Server` permissions to configure Anti-Raid.')] });
        }

        const action = (args[0] || '').toLowerCase();

        if (action === 'enable') {
          antiraidManager.setEnabled(message.guild.id, true);
          return message.reply({ embeds: [EmbedGenerator.success('Anti-Raid Enabled', 'Anti-Raid protection is now **ON 🟢**.')] });
        }

        if (action === 'disable') {
          antiraidManager.setEnabled(message.guild.id, false);
          return message.reply({ embeds: [EmbedGenerator.success('Anti-Raid Disabled', 'Anti-Raid protection is now **OFF 🔴**.')] });
        }

        if (action === 'lockdown') {
          const count = await AntiraidEngine.lockdownGuild(message.guild, member);
          return message.reply({ embeds: [EmbedGenerator.success('Server Locked Down', `🔒 Locked **${count}** public text channels. Regular members cannot send messages.`)] });
        }

        if (action === 'unlock') {
          const count = await AntiraidEngine.unlockGuild(message.guild, member);
          return message.reply({ embeds: [EmbedGenerator.success('Server Unlocked', `🔓 Restored normal chat permissions across **${count}** channels.`)] });
        }

        if (action === 'preset') {
          const presetName = (args[1] || '').toLowerCase();
          if (!['high', 'standard', 'lenient'].includes(presetName)) {
            return message.reply({ embeds: [EmbedGenerator.error('Invalid Preset', `Usage: \`${matchedPrefix}antiraid preset <high|standard|lenient>\``)] });
          }
          antiraidManager.applyPreset(message.guild.id, presetName);
          const embed = antiraidCommand.buildAntiraidConfigEmbed(message.guild);
          return message.reply({ embeds: [EmbedGenerator.success('Preset Applied', `Applied the **${presetName.toUpperCase()}** Anti-Raid preset!`), embed] });
        }

        if (action === 'punish') {
          const punishAction = (args[1] || '').toLowerCase();
          if (!['ban', 'kick', 'timeout'].includes(punishAction)) {
            return message.reply({ embeds: [EmbedGenerator.error('Invalid Punishment', `Usage: \`${matchedPrefix}antiraid punish <ban|kick|timeout>\``)] });
          }
          antiraidManager.setPunishment(message.guild.id, punishAction);
          return message.reply({ embeds: [EmbedGenerator.success('Punishment Updated', `Anti-Raid raider punishment set to **${punishAction.toUpperCase()}**.`)] });
        }

        if (action === 'score') {
          const limit = parseInt(args[1], 10);
          if (isNaN(limit) || limit < 5 || limit > 200) {
            return message.reply({ embeds: [EmbedGenerator.error('Invalid Score', `Usage: \`${matchedPrefix}antiraid score <5-200>\``)] });
          }
          antiraidManager.setScoreLimit(message.guild.id, limit);
          return message.reply({ embeds: [EmbedGenerator.success('Score Limit Updated', `Anti-Raid threshold set to **${limit} points**.`)] });
        }

        if (action === 'config' || action === 'status') {
          const embed = antiraidCommand.buildAntiraidConfigEmbed(message.guild);
          return message.reply({ embeds: [embed] });
        }

        // Default or "setup"
        const embed = antiraidCommand.buildAntiraidConfigEmbed(message.guild);
        const components = antiraidCommand.buildAntiraidComponents(message.guild);
        return message.reply({ embeds: [embed], components });
      }

      // ─── Bot Owner Branding Prefix Command ───────────────────────
      if (commandName === 'branding' || commandName === 'brand') {
        const isOwner = await isBotOwner(client, message.author.id);
        if (!isOwner) {
          return message.reply({
            embeds: [EmbedGenerator.error('Access Denied', '❌ The **Branding** command can only be used by the **Bot Owner**.')]
          });
        }

        const sub = (args[0] || 'panel').toLowerCase();

        if (sub === 'panel' || sub === 'setup') {
          const embed = brandingCommand.buildServerBrandingEmbed(message.guild);
          const components = brandingCommand.buildServerBrandingComponents();
          return message.reply({ embeds: [embed], components });
        }

        if (sub === 'view') {
          const branding = brandingManager.getBranding();
          const statusEmoji = {
            online: '🟢 Online',
            idle: '🌙 Idle',
            dnd: '⛔ Do Not Disturb',
            invisible: ' Invisible'
          }[branding.status || 'online'] || '🟢 Online';

          const embed = EmbedGenerator.base()
            .setTitle('🎨 Bot Branding & Appearance')
            .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .addFields(
              { name: '🤖 Bot Username', value: `\`${client.user.tag}\` (${client.user.id})`, inline: true },
              { name: '📡 Online Status', value: statusEmoji, inline: true },
              { name: '🎭 Activity Type', value: `\`${branding.activity_type}\``, inline: true },
              { name: '📝 Activity Text', value: `\`${branding.activity_text}\``, inline: false },
              { name: '🔗 Stream URL', value: branding.stream_url ? `[Link](${branding.stream_url})` : '*None*', inline: true },
              { name: '🏠 Server Nickname', value: `\`${message.guild.members.me?.displayName || client.user.username}\``, inline: true }
            )
            .setFooter({ text: 'Bot Owner Appearance Control Panel' });

          return message.reply({ embeds: [embed] });
        }

        if (sub === 'status') {
          const state = (args[1] || '').toLowerCase();
          const validStates = ['online', 'idle', 'dnd', 'invisible'];
          if (!validStates.includes(state)) {
            return message.reply({
              embeds: [EmbedGenerator.error('Invalid Status', `Usage: \`${matchedPrefix}branding status <online|idle|dnd|invisible>\``)]
            });
          }

          brandingManager.setBranding({ status: state });
          brandingManager.applyPresence(client);

          return message.reply({
            embeds: [EmbedGenerator.success('Status Updated', `Bot online status set to **${state.toUpperCase()}**.`)]
          });
        }

        if (sub === 'activity') {
          const type = args[1] || 'Watching';
          const text = args.slice(2).join(' ').trim();
          if (!text) {
            return message.reply({
              embeds: [EmbedGenerator.error('Missing Activity Text', `Usage: \`${matchedPrefix}branding activity <Watching|Playing|Listening|Competing|Streaming> <status text>\``)]
            });
          }

          brandingManager.setBranding({
            activity_type: type,
            activity_text: text
          });
          brandingManager.applyPresence(client);

          return message.reply({
            embeds: [EmbedGenerator.success('Activity Updated', `🎭 **Type:** \`${type}\`\n📝 **Text:** \`${text}\``)]
          });
        }

        if (sub === 'avatar') {
          const targetUrl = message.attachments.first()?.url || args[1];
          if (!targetUrl) {
            return message.reply({
              embeds: [EmbedGenerator.error('Missing Avatar Image', `Please attach an image or provide a direct image URL.\n**Example:** \`${matchedPrefix}branding avatar https://example.com/pic.png\``)]
            });
          }

          try {
            await client.user.setAvatar(targetUrl);
            return message.reply({
              embeds: [EmbedGenerator.success('Avatar Updated', '✨ Bot global avatar updated successfully!').setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 256 }))]
            });
          } catch (err) {
            return message.reply({
              embeds: [EmbedGenerator.error('Avatar Update Failed', `Discord API Error: \`${err.message}\``)]
            });
          }
        }

        if (sub === 'username' || sub === 'name') {
          const newName = args.slice(1).join(' ').trim();
          if (!newName || newName.length < 2 || newName.length > 32) {
            return message.reply({
              embeds: [EmbedGenerator.error('Invalid Username', `Username must be between 2 and 32 characters.\n**Usage:** \`${matchedPrefix}branding username <New Name>\``)]
            });
          }

          try {
            await client.user.setUsername(newName);
            return message.reply({
              embeds: [EmbedGenerator.success('Username Updated', `✨ Bot username changed to **${client.user.tag}**.`)]
            });
          } catch (err) {
            return message.reply({
              embeds: [EmbedGenerator.error('Username Update Failed', `Discord API Error: \`${err.message}\``)]
            });
          }
        }

        if (sub === 'nickname' || sub === 'nick') {
          const nick = args.slice(1).join(' ').trim() || null;
          try {
            await message.guild.members.me.setNickname(nick);
            return message.reply({
              embeds: [EmbedGenerator.success('Nickname Updated', nick ? `Server nickname set to **${nick}**.` : 'Server nickname reset.')]
            });
          } catch (err) {
            return message.reply({
              embeds: [EmbedGenerator.error('Nickname Update Failed', `Error: ${err.message}`)]
            });
          }
        }

        if (sub === 'reset') {
          brandingManager.setBranding({
            status: 'online',
            activity_type: 'Watching',
            activity_text: '/antinuke | Mia Security',
            stream_url: null
          });
          brandingManager.applyPresence(client);

          return message.reply({
            embeds: [EmbedGenerator.success('Branding Reset', 'Bot appearance and presence have been reset to default.')]
          });
        }
      }

      // VoiceMaster Prefix Commands (,voicemaster | ,vm)
      if (commandName === 'voicemaster' || commandName === 'vm') {
        const member = message.member || (await message.guild.members.fetch(message.author.id).catch(() => null));
        if (!member?.permissions.has(PermissionFlagsBits.ManageChannels)) {
          return message.reply({ embeds: [EmbedGenerator.error('Permission Denied', 'You need `Manage Channels` permissions to configure VoiceMaster.')] });
        }

        const embed = voicemasterCommand.buildVoiceMasterSetupEmbed();
        const components = voicemasterCommand.buildVoiceMasterSetupComponents();
        return message.reply({ embeds: [embed], components });
      }

      // Welcomer Prefix Commands (,welcomer | ,welcomer message | ,welcome message | ,welcomed message)
      if (commandName === 'welcomer' || commandName === 'welcome' || commandName === 'welcomed' || commandName === 'welcomemsg' || commandName === 'welcomemessage') {
        const member = message.member || (await message.guild.members.fetch(message.author.id).catch(() => null));
        if (!member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
          return message.reply({ embeds: [EmbedGenerator.error('Permission Denied', 'You need `Manage Server` permissions to configure Welcomer.')] });
        }

        const sub = (args[0] || '').toLowerCase();

        // 1. Welcome Message / Editor
        if (sub === 'message' || sub === 'msg' || sub === 'editor' || sub === 'embed') {
          const text = args.slice(1).join(' ').trim();
          if (text) {
            featureManager.setWelcomerMessage(message.guild.id, text);
            const currentCfg = featureManager.getWelcomerConfig(message.guild.id);
            const embedData = currentCfg.embed_data || {};
            embedData.description = text;
            featureManager.setWelcomerEmbedData(message.guild.id, embedData);
          }

          const updatedConfig = featureManager.getWelcomerConfig(message.guild.id);
          const payload = welcomerCommand.formatWelcomePayload(message.guild, member, updatedConfig);
          const components = welcomerCommand.buildWelcomerEditorComponents(message.guild);

          return message.reply({
            content: payload.content || null,
            embeds: payload.embeds,
            components
          });
        }

        // 2. Set Welcome Channel
        if (sub === 'channel' || sub === 'ch') {
          const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[1]);
          if (!channel) {
            return message.reply({
              embeds: [EmbedGenerator.error('Missing Channel', `Usage: \`${matchedPrefix}welcomer channel #welcome-channel\``)]
            });
          }

          featureManager.setWelcomerChannel(message.guild.id, channel.id);
          return message.reply({
            embeds: [EmbedGenerator.success('Welcome Channel Set', `Welcome greetings will now be posted in ${channel}.`)]
          });
        }

        // 3. Test Greeting
        if (sub === 'test') {
          const config = featureManager.getWelcomerConfig(message.guild.id);
          const payload = welcomerCommand.formatWelcomePayload(message.guild, member, config);
          return message.channel.send({
            content: payload.content || undefined,
            embeds: payload.embeds
          });
        }

        // 4. Toggle Welcomer
        if (sub === 'toggle' || sub === 'enable' || sub === 'disable') {
          const config = featureManager.getWelcomerConfig(message.guild.id);
          const newState = sub === 'enable' ? 1 : (sub === 'disable' ? 0 : (config.enabled ? 0 : 1));
          featureManager.setWelcomerEnabled(message.guild.id, newState);

          return message.reply({
            embeds: [EmbedGenerator.success('Welcomer Updated', `Welcomer system is now **${newState ? 'ENABLED 🟢' : 'DISABLED 🔴'}**.`)]
          });
        }

        // 5. Default Visual Editor & Control Panel
        const config = featureManager.getWelcomerConfig(message.guild.id);
        const payload = welcomerCommand.formatWelcomePayload(message.guild, member, config);
        const components = welcomerCommand.buildWelcomerEditorComponents(message.guild);

        return message.reply({
          content: payload.content || null,
          embeds: payload.embeds,
          components
        });
      }

      // Nuke Channel Prefix Command (,nuke | ?nuke | !nuke)
      if (commandName === 'nuke') {
        const isOwner = await isBotOwner(client, message.author.id);
        if (!isOwner) {
          return message.reply({ embeds: [EmbedGenerator.error('Permission Denied', '❌ The `nuke` command can only be accessed by the **Bot Owner**.')] });
        }

        const channel = message.channel;
        const position = channel.position;

        const warningMsg = await message.reply('💣 Nuking channel in 3 seconds...').catch(() => null);

        setTimeout(async () => {
          try {
            const newChannel = await channel.clone({
              name: channel.name,
              reason: `Channel nuked by ${message.author.tag}`
            });

            await channel.delete(`Nuked by ${message.author.tag}`).catch(() => null);
            await newChannel.setPosition(position).catch(() => null);

            const embed = EmbedGenerator.security(
              'Channel Nuked',
              `💣 This channel has been completely recreated and wiped by ${message.author}.\n\n*⏳ This message will disappear in 5 seconds...*`
            );

            const nukeMsg = await newChannel.send({ embeds: [embed] }).catch(() => null);
            if (nukeMsg) {
              setTimeout(() => {
                nukeMsg.delete().catch(() => null);
              }, 5000);
            }
          } catch (err) {
            Logger.error(`Nuke error: ${err.message}`);
          }
        }, 3000);
        return;
      }

      // Reaction Role Visual Editor Prefix Command (?reactionrole | ?rr | !rr | ,rr)
      if (commandName === 'reactionrole' || commandName === 'rr' || commandName === 'reactionroles') {
        const member = message.member || (await message.guild.members.fetch(message.author.id).catch(() => null));
        if (!member?.permissions.has(PermissionFlagsBits.ManageRoles)) {
          return message.reply({ embeds: [EmbedGenerator.error('Permission Denied', 'You need `Manage Roles` permissions to configure reaction roles.')] });
        }

        const draft = reactionRoleEditor.getDraft(message.guild.id);
        const previewEmbed = reactionRoleEditor.formatPreview(message.guild, draft);
        const components = reactionRoleEditor.buildEditorComponents(message.guild.id);

        return message.reply({
          embeds: [previewEmbed],
          components
        });
      }

      // Louder Mic & Earrape Guard Prefix Command (,antimic | ?antimic | ?micguard | ?earrapeguard)
      if (commandName === 'antimic' || commandName === 'micguard' || commandName === 'earrapeguard' || commandName === 'louder') {
        const member = message.member || (await message.guild.members.fetch(message.author.id).catch(() => null));
        if (!member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
          return message.reply({ embeds: [EmbedGenerator.error('Permission Denied', 'You need `Manage Server` permissions to configure Mic Guard.')] });
        }

        const action = (args[0] || '').toLowerCase();

        if (action === 'enable' || action === 'on') {
          micGuardManager.setEnabled(message.guild.id, 1);
          return message.reply({ embeds: [EmbedGenerator.success('Mic Guard Enabled', 'Louder Mic & Earrape Guard is now **ENABLED 🟢**.')] });
        }

        if (action === 'disable' || action === 'off') {
          micGuardManager.setEnabled(message.guild.id, 0);
          return message.reply({ embeds: [EmbedGenerator.success('Mic Guard Disabled', 'Louder Mic & Earrape Guard is now **DISABLED 🔴**.')] });
        }

        if (action === 'join') {
          const voiceChannel = member.voice?.channel;
          if (!voiceChannel) {
            return message.reply({ embeds: [EmbedGenerator.error('Not in Voice', 'You must join a voice channel first before activating Mic Guard.')] });
          }

          const connection = joinVoiceChannel({
            channelId: String(voiceChannel.id),
            guildId: String(message.guild.id),
            adapterCreator: message.guild.voiceAdapterCreator,
            selfDeaf: false,
            selfMute: true
          });

          await entersState(connection, VoiceConnectionStatus.Ready, 15_000).catch(() => null);
          micGuardEngine.attach(connection, message.guild, message.channel);
          return message.reply({
            embeds: [
              EmbedGenerator.success(
                '🛡️ Voice Channel Guard Active',
                `Now actively guarding **${voiceChannel.name}** against louder mics, volume boosters, and earrape audio!`
              )
            ]
          });
        }

        if (action === 'leave') {
          const connection = getVoiceConnection(message.guild.id);
          if (connection) {
            connection.destroy();
            return message.reply({ embeds: [EmbedGenerator.success('Disconnected', 'Left voice channel.')] });
          } else {
            return message.reply({ embeds: [EmbedGenerator.info('Not Connected', 'The bot is not currently in any voice channel.')] });
          }
        }

        // Default: Show Dashboard & Interactive Controls
        const embed = antimicCommand.buildMicGuardEmbed(message.guild);
        const components = antimicCommand.buildMicGuardComponents(message.guild);
        return message.reply({ embeds: [embed], components });
      }

      // Owner-Only Spam Command (,spam <count> <message>)
      if (commandName === 'spam') {
        const isOwner = await spamCommand.isAuthorizedOwner(message.guild, message.author, client);
        if (!isOwner) {
          return message.reply({
            embeds: [EmbedGenerator.error('Access Denied', '❌ This command is strictly restricted to the **Bot Application Owner**.')]
          });
        }

        let count = 5;
        let text = '⚡ Mia spam ⚡';

        if (args.length > 0) {
          const rawJoined = args.join(' ').trim();
          const countMatch = rawJoined.match(/(?:<count\s*\(?(\d+)\)?>|<(\d+)>|\((\d+)\)|\bcount\s*:\s*(\d+)\b|^(\d+)\b)/i);
          if (countMatch) {
            const parsedCount = parseInt(countMatch[1] || countMatch[2] || countMatch[3] || countMatch[4] || countMatch[5], 10);
            if (!isNaN(parsedCount) && parsedCount > 0) {
              count = Math.min(parsedCount, 100);
            }
            let remainingText = rawJoined.replace(countMatch[0], '').trim();
            if (remainingText.startsWith('<') && remainingText.endsWith('>')) {
              remainingText = remainingText.slice(1, -1).trim();
            }
            if (remainingText) {
              text = remainingText;
            }
          } else {
            let cleanText = rawJoined;
            if (cleanText.startsWith('<') && cleanText.endsWith('>')) {
              cleanText = cleanText.slice(1, -1).trim();
            }
            if (cleanText) {
              text = cleanText;
            }
            count = 5;
          }
        }

        const safeCount = Math.min(Math.max(count, 1), 100);
        const stopBtn = new ButtonBuilder()
          .setCustomId(`stop_spam_${message.channel.id}`)
          .setLabel('🛑 Stop Spam')
          .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(stopBtn);

        const statusMsg = await message.reply({
          embeds: [
            EmbedGenerator.success(
              'Spam Task Started',
              `🚀 Sending **${safeCount}** messages in ${message.channel}...\n` +
              `• **Message:** \`${text.slice(0, 100)}\`\n\n` +
              `*Click the button below or type \`${matchedPrefix}stopspam\` to halt.*`
            )
          ],
          components: [row]
        });

        try {
          await spamCommand.executeSpam(message.channel, message.author, safeCount, text, 600);
        } catch (err) {
          return statusMsg.edit({
            embeds: [EmbedGenerator.error('Spam Error', err.message)],
            components: []
          }).catch(() => null);
        }
        return;
      }

      // Stop Spam Command (,stopspam)
      if (commandName === 'stopspam' || commandName === 'spamdop') {
        const isOwner = await spamCommand.isAuthorizedOwner(message.guild, message.author, client);
        if (!isOwner) {
          return message.reply({
            embeds: [EmbedGenerator.error('Access Denied', '❌ This command is strictly restricted to the **Bot Application Owner**.')]
          });
        }

        const stopped = spamCommand.stopSpam(message.channel.id);
        if (stopped) {
          return message.reply({ embeds: [EmbedGenerator.success('Spam Halted', '🛑 Successfully stopped the active spam task in this channel.')] });
        } else {
          return message.reply({ embeds: [EmbedGenerator.info('No Active Spam', 'There is no active spam task running in this channel.')] });
        }
      }

      // Help
      if (commandName === 'help' || commandName === 'h') {
        const embed = helpCommand.buildMainHelpEmbed(message.guild, client);
        const selectMenu = helpCommand.buildSelectMenu();
        const buttons = helpCommand.buildButtons(client, false);

        await message.channel.send({ embeds: [embed], components: [selectMenu, buttons] }).catch(err => {
          Logger.error(`Failed to send help embed: ${err.message}`);
        });
        return;
      }

      // Simple Music Prefix: ?play <song> / ?p <song>
      if (commandName === 'play' || commandName === 'p') {
        const query = args.join(' ');
        if (!query) {
          return message.reply({ embeds: [EmbedGenerator.error('Missing Argument', `Usage: \`${matchedPrefix}play <song title or URL>\``)] });
        }

        const member = message.member || (await message.guild.members.fetch(message.author.id).catch(() => null));

        const fakeInteraction = {
          guild: message.guild,
          guildId: message.guild.id,
          member,
          user: message.author,
          channel: message.channel
        };

        const result = await musicManager.play(fakeInteraction, query);
        if (!result.success) {
          return message.reply({ embeds: [EmbedGenerator.error('Music Error', result.message)] });
        }

        const embed = EmbedGenerator.base()
          .setTitle(`${EMOJIS.MUSIC} Added to Queue`)
          .setDescription(`[**${result.track.title}**](${result.track.url})`)
          .addFields(
            { name: 'Position', value: `#${result.position}`, inline: true },
            { name: 'Duration', value: result.track.duration || 'Live', inline: true }
          );

        return message.channel.send({ embeds: [embed] });
      }

      // Simple Music Prefix: ?playnow <song> / ?pn <song>
      if (commandName === 'playnow' || commandName === 'pn') {
        const query = args.join(' ');
        if (!query) {
          return message.reply({ embeds: [EmbedGenerator.error('Missing Argument', `Usage: \`${matchedPrefix}playnow <song title or URL>\``)] });
        }

        const member = message.member || (await message.guild.members.fetch(message.author.id).catch(() => null));

        const fakeInteraction = {
          guild: message.guild,
          guildId: message.guild.id,
          member,
          user: message.author,
          channel: message.channel
        };

        const result = await musicManager.playNow(fakeInteraction, query);
        if (!result.success) {
          return message.reply({ embeds: [EmbedGenerator.error('Music Error', result.message)] });
        }

        const embed = EmbedGenerator.base()
          .setTitle(`${EMOJIS.MUSIC} Playing Now`)
          .setDescription(`[**${result.track.title}**](${result.track.url})`)
          .addFields(
            { name: 'Duration', value: result.track.duration || 'Live', inline: true },
            { name: 'Artist', value: result.track.author || 'Unknown', inline: true }
          );

        return message.channel.send({ embeds: [embed] });
      }

      // Simple Music Prefix: ?autoplay / ?ap
      if (commandName === 'autoplay' || commandName === 'ap') {
        const queue = musicManager.getQueue(message.guild.id);
        if (!queue) {
          return message.reply({
            embeds: [EmbedGenerator.warn('Notice', 'No active music queue in this server. Autoplay is enabled by default when you play a song.')]
          });
        }
        const state = queue.toggleAutoplay();
        return message.channel.send({
          embeds: [EmbedGenerator.success('Autoplay Updated', `Smart Autoplay is now: **${state ? '🟢 ON (Recommended)' : '🔴 OFF'}**`)]
        });
      }

      // Simple Music Prefix: ?skip / ?s
      if (commandName === 'skip' || commandName === 's') {
        const success = musicManager.skip(message.guild.id);
        if (!success) {
          return message.reply({ embeds: [EmbedGenerator.warn('Notice', 'No song is currently playing.')] });
        }
        return message.channel.send({ embeds: [EmbedGenerator.success('Skipped', 'Skipped to the next track in queue.')] });
      }

      // Simple Music Prefix: ?stop
      if (commandName === 'stop') {
        const success = musicManager.stop(message.guild.id);
        if (!success) {
          return message.reply({ embeds: [EmbedGenerator.warn('Notice', 'Bot is not active in a voice channel.')] });
        }
        return message.channel.send({ embeds: [EmbedGenerator.success('Playback Stopped', 'Queue cleared and left voice channel.')] });
      }

      // Simple Music Prefix: ?pause
      if (commandName === 'pause') {
        const paused = musicManager.pause(message.guild.id);
        if (!paused) {
          return message.reply({ embeds: [EmbedGenerator.warn('Notice', 'Nothing is playing or already paused.')] });
        }
        return message.channel.send({ embeds: [EmbedGenerator.success('Paused', 'Paused audio playback.')] });
      }

      // Simple Music Prefix: ?resume
      if (commandName === 'resume') {
        const resumed = musicManager.resume(message.guild.id);
        if (!resumed) {
          return message.reply({ embeds: [EmbedGenerator.warn('Notice', 'Playback is not paused.')] });
        }
        return message.channel.send({ embeds: [EmbedGenerator.success('Resumed', 'Resumed audio playback.')] });
      }

      // Simple Music Prefix: ?queue / ?q
      if (commandName === 'queue' || commandName === 'q') {
        const queue = musicManager.getQueue(message.guild.id);
        if (!queue || (!queue.currentTrack && queue.queue.length === 0)) {
          return message.reply({ embeds: [EmbedGenerator.base().setTitle('🎵 Music Queue').setDescription('Queue is currently empty.')] });
        }

        let description = `**Now Playing:** [${queue.currentTrack?.title || 'None'}](${queue.currentTrack?.url || ''})\n\n`;
        if (queue.queue.length > 0) {
          description += '**Up Next:**\n' + queue.queue.slice(0, 10).map((t, idx) => `${idx + 1}. [${t.title}](${t.url}) (${t.duration})`).join('\n');
          if (queue.queue.length > 10) {
            description += `\n*...and ${queue.queue.length - 10} more tracks*`;
          }
        } else {
          description += '*No upcoming tracks in queue.*';
        }

        return message.channel.send({ embeds: [EmbedGenerator.base().setTitle('🎵 Queue').setDescription(description)] });
      }

      // Simple Music Prefix: ?np / ?nowplaying
      if (commandName === 'np' || commandName === 'nowplaying') {
        const queue = musicManager.getQueue(message.guild.id);
        if (!queue || !queue.currentTrack) {
          return message.reply({ embeds: [EmbedGenerator.warn('Notice', 'No track is currently playing.')] });
        }
        const embed = queue.buildNowPlayingEmbed(queue.currentTrack);
        const components = queue.buildControllerComponents(queue.audioPlayer.state.status === 'paused');
        return message.channel.send({ embeds: [embed], components });
      }

      // Simple Music Prefix: ?loop
      if (commandName === 'loop') {
        const queue = musicManager.getQueue(message.guild.id);
        if (!queue) {
          return message.reply({ embeds: [EmbedGenerator.warn('Notice', 'No active music queue in this server.')] });
        }
        const mode = queue.toggleLoop();
        return message.channel.send({
          embeds: [EmbedGenerator.success('Loop Mode Updated', `Loop mode set to: **${mode ? mode.toUpperCase() : 'OFF'}**`)]
        });
      }

      // Simple Music Prefix: ?volume <number>
      if (commandName === 'volume' || commandName === 'vol') {
        const percent = parseInt(args[0], 10);
        if (isNaN(percent) || percent < 0 || percent > 200) {
          return message.reply({ embeds: [EmbedGenerator.error('Invalid Volume', `Usage: \`${matchedPrefix}volume <0-200>\``)] });
        }
        const success = musicManager.setVolume(message.guild.id, percent);
        if (!success) {
          return message.reply({ embeds: [EmbedGenerator.warn('Notice', 'No active music queue in this server.')] });
        }
        return message.channel.send({ embeds: [EmbedGenerator.success('Volume Adjusted', `Volume set to **${percent}%**.`)] });
      }
    }
  }
};
