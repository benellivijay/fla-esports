const {
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  UserSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  ActivityType
} = require('discord.js');
const featureManager = require('../../database/managers/FeatureManager');
const moderationManager = require('../../database/managers/ModerationManager');
const extraFeaturesManager = require('../../database/managers/ExtraFeaturesManager');
const antinukeManager = require('../../database/managers/AntinukeManager');
const musicManager = require('../../music/MusicManager');
const EmbedGenerator = require('../../utils/embed');
const Logger = require('../../utils/logger');
const { EMOJIS } = require('../../config/constants');
const helpCommand = require('../../commands/utility/help');
const automodCommand = require('../../commands/moderation/automod');
const loggingCommand = require('../../commands/utility/logging');
const loggingManager = require('../../database/managers/LoggingManager');
const antiraidCommand = require('../../commands/security/antiraid');
const antiraidManager = require('../../database/managers/AntiraidManager');
const AntiraidEngine = require('../../antiraid/AntiraidEngine');
const voicemasterCommand = require('../../commands/utility/voicemaster');
const spamCommand = require('../../commands/utility/spam');
const welcomerCommand = require('../../commands/welcomer/welcomer');
const antimicCommand = require('../../commands/security/antimic');
const micGuardManager = require('../../database/managers/MicGuardManager');
const micGuardEngine = require('../../antimic/MicGuardEngine');
const reactionRoleEditor = require('../../commands/reactionrole/ReactionRoleEditor');
const embedCommand = require('../../commands/utility/embed');
const brandingCommand = require('../../commands/utility/branding');
const brandingManager = require('../../database/managers/BrandingManager');
const isBotOwner = require('../../utils/isBotOwner');
const PermissionHelper = require('../../utils/permissions');
const { joinVoiceChannel, getVoiceConnection, VoiceConnectionStatus, entersState } = require('@discordjs/voice');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    // 1. Handle Slash Commands
    if (interaction.isChatInputCommand()) {
      const guild = interaction.guild || (interaction.guildId ? client.guilds.cache.get(interaction.guildId) : null);
      const { user } = interaction;

      // ─── MASTER OWNER GATEKEEPER ───────────────────────────────
      // All commands can ONLY be run by Server Owner, Extra Owner, or Bot Owner
      const isAuthorized = await PermissionHelper.isCommandAuthorized(guild, user, client);
      if (!isAuthorized) {
        return interaction.reply({
          embeds: [
            EmbedGenerator.error(
              'Permission Denied',
              '❌ You are not authorized to run commands on this bot.\n\n' +
              '🔒 Commands can only be executed by:\n' +
              '• 👑 **Server Owner**\n' +
              '• 🛡️ **Extra Owners**\n' +
              '• 🤖 **Bot Owner**'
            )
          ],
          ephemeral: true
        });
      }

      const allowGlobalCommands = ['help', 'ping', 'botinfo', 'avatar', 'banner', 'userinfo', 'spam'];

      if (!guild && !allowGlobalCommands.includes(interaction.commandName)) {
        const inviteRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel('Invite Mia to Server')
            .setStyle(ButtonStyle.Link)
            .setURL(`https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`)
        );

        return interaction.reply({
          embeds: [
            EmbedGenerator.warn(
              'Bot Not in Server',
              '**Mia** is not added to this server yet! To use moderation, antinuke, music, and ticketing, the bot must be invited to the server with administrator permissions.\n\n' +
              '👉 Click the button below to invite **Mia** to your server!'
            )
          ],
          components: [inviteRow],
          ephemeral: true
        }).catch(() => null);
      }

      const command = client.commands.get(interaction.commandName);
      if (!command) {
        Logger.warn(`Slash command not found: /${interaction.commandName}`);
        return interaction.reply({
          embeds: [EmbedGenerator.error('Command Error', `Command \`/${interaction.commandName}\` is not recognized.`)],
          ephemeral: true
        });
      }

      try {
        await command.execute(interaction);
      } catch (error) {
        Logger.error(`Command execution error (${interaction.commandName}): ${error.stack}`);
        const errorEmbed = EmbedGenerator.error(
          'Command Failed',
          'An unexpected error occurred while executing this command. The development team has been notified.'
        );

        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ embeds: [errorEmbed], components: [] }).catch(() => null);
        } else {
          await interaction.reply({ embeds: [errorEmbed], ephemeral: true }).catch(() => null);
        }
      }
      return;
    }

    // 2. Handle Button Interactions
    if (interaction.isButton()) {
      const { customId, guild, member, user } = interaction;

      // Music Interactive Controller Buttons
      if (customId.startsWith('music_')) {
        if (!guild) return;
        const queue = musicManager.getQueue(guild.id);
        if (!queue || !queue.currentTrack) {
          return interaction.reply({ embeds: [EmbedGenerator.warn('Notice', 'No active music queue in this server.')], ephemeral: true });
        }

        const voiceChannel = member?.voice?.channel;
        if (!voiceChannel) {
          return interaction.reply({ embeds: [EmbedGenerator.warn('Voice Channel Required', 'You must be in a voice channel to use music controls.')], ephemeral: true });
        }

        if (customId === 'music_pause_resume_btn') {
          const isPaused = queue.audioPlayer.state.status === 'paused';
          if (isPaused) {
            queue.resume();
            return interaction.reply({ embeds: [EmbedGenerator.success('Resumed', 'Resumed audio playback.')], ephemeral: true });
          } else {
            queue.pause();
            return interaction.reply({ embeds: [EmbedGenerator.success('Paused', 'Paused audio playback.')], ephemeral: true });
          }
        }

        if (customId === 'music_skip_btn') {
          queue.skip();
          return interaction.reply({ embeds: [EmbedGenerator.success('Skipped', 'Skipped current track.')], ephemeral: true });
        }

        if (customId === 'music_prev_btn') {
          const success = queue.previous();
          if (success) {
            return interaction.reply({ embeds: [EmbedGenerator.success('Previous Track', 'Playing previous track.')], ephemeral: true });
          } else {
            return interaction.reply({ embeds: [EmbedGenerator.warn('Notice', 'No previous track in history.')], ephemeral: true });
          }
        }

        if (customId === 'music_queue_btn') {
          let description = `**Now Playing:** [${queue.currentTrack?.title || 'None'}](${queue.currentTrack?.url || ''})\n\n`;
          if (queue.queue.length > 0) {
            description += '**Up Next:**\n' + queue.queue.slice(0, 10).map((t, idx) => `${idx + 1}. [${t.title}](${t.url}) (${t.duration})`).join('\n');
            if (queue.queue.length > 10) {
              description += `\n*...and ${queue.queue.length - 10} more tracks*`;
            }
          } else {
            description += '*No upcoming tracks in queue.*';
          }

          const embed = EmbedGenerator.base()
            .setTitle('🎵 Current Queue')
            .setDescription(description);

          return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (customId === 'music_loop_btn') {
          const loopMode = queue.toggleLoop();
          return interaction.reply({
            embeds: [EmbedGenerator.success('Loop Mode', `Loop mode is now: **${loopMode ? loopMode.toUpperCase() : 'OFF'}**`)],
            ephemeral: true
          });
        }

        if (customId === 'music_autoplay_btn') {
          const auto = queue.toggleAutoplay();
          return interaction.reply({
            embeds: [EmbedGenerator.success('Autoplay Mode', `Autoplay is now: **${auto ? 'ENABLED (AI Related Songs)' : 'DISABLED'}**`)],
            ephemeral: true
          });
        }

        if (customId === 'music_stop_btn') {
          const isServerOwner = guild.ownerId === user.id;
          const isExtraOwner = antinukeManager.isExtraOwner(guild.id, user.id);
          const isBotOwnerUser = isBotOwner(user.id);

          if (!isServerOwner && !isExtraOwner && !isBotOwnerUser) {
            return interaction.reply({
              embeds: [EmbedGenerator.error('Permission Denied', 'Only the **Server Owner**, **Extra Owner**, or **Bot Owner** can end the music session.')],
              ephemeral: true
            });
          }

          queue.destroy();
          musicManager.queues.delete(guild.id);
          return interaction.reply({ embeds: [EmbedGenerator.success('Session Ended', 'Music playback stopped and bot disconnected.')], ephemeral: true });
        }
      }

      // Automod Interactive Buttons (Enable All / Cancel)
      if (customId === 'automod_enable_all') {
        const isAuth = await PermissionHelper.isCommandAuthorized(guild, user, client);
        if (!isAuth && !member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
          return interaction.reply({ embeds: [EmbedGenerator.error('Permission Denied', 'You need `Manage Server` permissions to modify AutoMod settings.')], ephemeral: true });
        }

        moderationManager.enableAll(guild.id);
        const embed = automodCommand.buildAutomodSetupEmbed(guild);
        const components = automodCommand.buildAutomodSetupComponents();
        return interaction.update({ embeds: [embed], components });
      }

      if (customId === 'automod_cancel') {
        const isAuth = await PermissionHelper.isCommandAuthorized(guild, user, client);
        if (!isAuth && !member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
          return interaction.reply({ embeds: [EmbedGenerator.error('Permission Denied', 'You need `Manage Server` permissions to modify AutoMod settings.')], ephemeral: true });
        }

        moderationManager.disableAll(guild.id);
        const embed = automodCommand.buildAutomodSetupEmbed(guild);
        const components = automodCommand.buildAutomodSetupComponents();
        return interaction.update({ embeds: [embed], components });
      }

      // Logging Interactive Buttons
      if (customId === 'logging_auto_setup') {
        const isAuth = await PermissionHelper.isCommandAuthorized(guild, user, client);
        if (!isAuth && !member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
          return interaction.reply({ embeds: [EmbedGenerator.error('Permission Denied', 'You need `Manage Server` permissions to configure logging.')], ephemeral: true });
        }

        await interaction.deferUpdate();
        try {
          await loggingCommand.executeAutoSetup(guild);
          const embed = loggingCommand.buildLoggingSetupEmbed(guild);
          const components = loggingCommand.buildLoggingComponents(guild);
          return interaction.editReply({ embeds: [embed], components });
        } catch (err) {
          Logger.error(`Auto setup failed: ${err.message}`);
          return interaction.followUp({
            embeds: [EmbedGenerator.error('Setup Failed', `Failed to create logging channels: ${err.message}`)],
            ephemeral: true
          });
        }
      }

      if (customId === 'logging_toggle_status') {
        const isAuth = await PermissionHelper.isCommandAuthorized(guild, user, client);
        if (!isAuth && !member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
          return interaction.reply({ embeds: [EmbedGenerator.error('Permission Denied', 'You need `Manage Server` permissions to configure logging.')], ephemeral: true });
        }

        const config = loggingManager.getConfig(guild.id);
        loggingManager.setEnabled(guild.id, !config.enabled);
        const embed = loggingCommand.buildLoggingSetupEmbed(guild);
        const components = loggingCommand.buildLoggingComponents(guild);
        return interaction.update({ embeds: [embed], components });
      }

      if (customId === 'logging_reset') {
        const isAuth = await PermissionHelper.isCommandAuthorized(guild, user, client);
        if (!isAuth && !member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
          return interaction.reply({ embeds: [EmbedGenerator.error('Permission Denied', 'You need `Manage Server` permissions to configure logging.')], ephemeral: true });
        }

        loggingManager.resetConfig(guild.id);
        const embed = loggingCommand.buildLoggingSetupEmbed(guild);
        const components = loggingCommand.buildLoggingComponents(guild);
        return interaction.update({ embeds: [embed], components });
      }

      if (customId === 'logging_cancel') {
        return interaction.message.delete().catch(() => null);
      }

      // Help Home Button
      if (customId === 'help_home_btn') {
        const embed = helpCommand.buildMainHelpEmbed(guild, client);
        const selectMenu = helpCommand.buildSelectMenu();
        const buttons = helpCommand.buildButtons(client, false);

        return interaction.update({
          embeds: [embed],
          components: [selectMenu, buttons]
        });
      }


      // ─── Reaction Role Visual Editor Buttons ───────────────────
      if (customId.startsWith('rr_edit_') || customId === 'rr_add_button_modal' || customId === 'rr_clear_buttons' || customId === 'rr_publish_panel') {
        try {
          const isAuth = await PermissionHelper.isCommandAuthorized(guild, user, client);
          if (!isAuth && !member?.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return interaction.reply({ embeds: [EmbedGenerator.error('Permission Denied', 'You need `Manage Roles` permissions to configure reaction roles.')], ephemeral: true });
          }

        const draft = reactionRoleEditor.getDraft(guild.id);

        // 1. Edit Basic Info (color / title / description)
        if (customId === 'rr_edit_basic') {
          const modal = new ModalBuilder()
            .setCustomId('rr_modal_basic')
            .setTitle('Edit Basic Information');

          const titleInput = new TextInputBuilder()
            .setCustomId('rr_input_title')
            .setLabel('Embed Title (no GIF emojis in titles)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Leave blank & use # heading in Description for GIF emojis')
            .setValue(draft.title || '')
            .setRequired(false);

          const descInput = new TextInputBuilder()
            .setCustomId('rr_input_desc')
            .setLabel('Description (GIF emojis work here)')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('# <a:emoji:id> Your Title Here\nClick buttons below to get roles!')
            .setValue(draft.description || '')
            .setRequired(false);

          const colorInput = new TextInputBuilder()
            .setCustomId('rr_input_color')
            .setLabel('Embed Hex Color (e.g. #5865F2, #ED4245)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('#5865F2')
            .setValue(draft.color || '#5865F2')
            .setRequired(false);

          modal.addComponents(
            new ActionRowBuilder().addComponents(titleInput),
            new ActionRowBuilder().addComponents(descInput),
            new ActionRowBuilder().addComponents(colorInput)
          );

          return interaction.showModal(modal);
        }

        // 2. Edit Author
        if (customId === 'rr_edit_author') {
          const modal = new ModalBuilder()
            .setCustomId('rr_modal_author')
            .setTitle('Edit Author');

          const authorNameInput = new TextInputBuilder()
            .setCustomId('rr_input_author_name')
            .setLabel('Author Name')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g. Role Selection or Community')
            .setValue(draft.author_name || '')
            .setRequired(false);

          const authorIconInput = new TextInputBuilder()
            .setCustomId('rr_input_author_icon')
            .setLabel('Author Icon URL (or {server_icon})')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('{server_icon}')
            .setValue(draft.author_icon || '')
            .setRequired(false);

          const authorUrlInput = new TextInputBuilder()
            .setCustomId('rr_input_author_url')
            .setLabel('Author Link URL')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('https://...')
            .setValue(draft.author_url || '')
            .setRequired(false);

          modal.addComponents(
            new ActionRowBuilder().addComponents(authorNameInput),
            new ActionRowBuilder().addComponents(authorIconInput),
            new ActionRowBuilder().addComponents(authorUrlInput)
          );

          return interaction.showModal(modal);
        }

        // 3. Edit Footer
        if (customId === 'rr_edit_footer') {
          const modal = new ModalBuilder()
            .setCustomId('rr_modal_footer')
            .setTitle('Edit Footer');

          const footerTextInput = new TextInputBuilder()
            .setCustomId('rr_input_footer_text')
            .setLabel('Footer Text')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g. Click again to remove a role')
            .setValue(draft.footer_text || '')
            .setRequired(false);

          const footerIconInput = new TextInputBuilder()
            .setCustomId('rr_input_footer_icon')
            .setLabel('Footer Icon URL (or {server_icon})')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('{server_icon}')
            .setValue(draft.footer_icon || '')
            .setRequired(false);

          modal.addComponents(
            new ActionRowBuilder().addComponents(footerTextInput),
            new ActionRowBuilder().addComponents(footerIconInput)
          );

          return interaction.showModal(modal);
        }

        // 4. Edit Images
        if (customId === 'rr_edit_images') {
          const modal = new ModalBuilder()
            .setCustomId('rr_modal_images')
            .setTitle('Edit Images');

          const thumbInput = new TextInputBuilder()
            .setCustomId('rr_input_thumb')
            .setLabel('Thumbnail URL (or {server_icon})')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('{server_icon}')
            .setValue(draft.thumbnail || '')
            .setRequired(false);

          const bannerInput = new TextInputBuilder()
            .setCustomId('rr_input_banner')
            .setLabel('Large Banner Image URL (https://...)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('https://i.imgur.com/example.png')
            .setValue(draft.image || '')
            .setRequired(false);

          modal.addComponents(
            new ActionRowBuilder().addComponents(thumbInput),
            new ActionRowBuilder().addComponents(bannerInput)
          );

          return interaction.showModal(modal);
        }

        // 5. Add Role Button Modal
        if (customId === 'rr_add_button_modal') {
          const modal = new ModalBuilder()
            .setCustomId('rr_modal_add_button')
            .setTitle('Add Role Button');

          const roleInput = new TextInputBuilder()
            .setCustomId('rr_input_role')
            .setLabel('Role ID, Mention, or Exact Role Name')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g. 123456789012345678 or @Gamer or Gamer')
            .setRequired(true);

          const labelInput = new TextInputBuilder()
            .setCustomId('rr_input_btn_label')
            .setLabel('Button Label')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g. Gamer, VIP, Announcements')
            .setRequired(true);

          const emojiInput = new TextInputBuilder()
            .setCustomId('rr_input_btn_emoji')
            .setLabel('Button Emoji (optional)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g. 🎮 or <:custom:1234>')
            .setRequired(false);

          const styleInput = new TextInputBuilder()
            .setCustomId('rr_input_btn_style')
            .setLabel('Style: primary / secondary / success / danger')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('secondary (default), primary, success, danger')
            .setValue('secondary')
            .setRequired(false);

          modal.addComponents(
            new ActionRowBuilder().addComponents(roleInput),
            new ActionRowBuilder().addComponents(labelInput),
            new ActionRowBuilder().addComponents(emojiInput),
            new ActionRowBuilder().addComponents(styleInput)
          );

          return interaction.showModal(modal);
        }

        // 6. Clear Buttons
        if (customId === 'rr_clear_buttons') {
          draft.buttons = [];
          const previewEmbed = reactionRoleEditor.formatPreview(guild, draft);
          const components = reactionRoleEditor.buildEditorComponents(guild.id);

          return interaction.update({
            embeds: [previewEmbed],
            components
          });
        }

        // 7. Publish Panel (Ask for destination channel)
        if (customId === 'rr_publish_panel') {
          const modal = new ModalBuilder()
            .setCustomId('rr_modal_publish')
            .setTitle('Send Reaction Role Panel');

          const channelInput = new TextInputBuilder()
            .setCustomId('rr_input_publish_channel')
            .setLabel('Destination Channel (Mention or ID)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g. #roles or 123456789012345678')
            .setValue(`<#${interaction.channelId}>`)
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(channelInput));
          return interaction.showModal(modal);
        }
        } catch (rrErr) {
          Logger.error(`Reaction Role Editor button error [${customId}]: ${rrErr.stack}`);
          const errFn = interaction.replied || interaction.deferred
            ? (d) => interaction.followUp(d).catch(() => null)
            : (d) => interaction.reply(d).catch(() => null);
          return errFn({ embeds: [EmbedGenerator.error('Editor Error', `Something went wrong: ${rrErr.message}`)], ephemeral: true });
        }
      }

      // Reaction Role Button Click (rr_<roleId>)
      if (customId.startsWith('rr_')) {
        const roleId = customId.replace('rr_', '');
        const role = guild?.roles.cache.get(roleId);

        if (!role) {
          return interaction.reply({ embeds: [EmbedGenerator.error('Role Error', 'That role no longer exists in this server.')], ephemeral: true });
        }

        if (member?.roles.cache.has(roleId)) {
          await member.roles.remove(roleId, 'Reaction role toggled off');
          return interaction.reply({
            embeds: [EmbedGenerator.warn('Role Removed', `Removed role <@&${role.id}> from your profile.`)],
            ephemeral: true
          });
        } else if (member) {
          await member.roles.add(roleId, 'Reaction role toggled on');
          return interaction.reply({
            embeds: [EmbedGenerator.success('Role Added', `Assigned role <@&${role.id}> to your profile.`)],
            ephemeral: true
          });
        }
      }


      // ─── Embed Visual Editor Buttons ───────────────────────────
      if (customId.startsWith('embed_edit_') || customId === 'embed_send_modal' || customId === 'embed_reset') {
        try {
          const isAuth = await PermissionHelper.isCommandAuthorized(guild, user, client);
          if (!isAuth && !member?.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return interaction.reply({ embeds: [EmbedGenerator.error('Permission Denied', 'You need `Manage Messages` to use the embed editor.')], ephemeral: true });
          }

          const draft = embedCommand.getDraft(guild.id);

          // Reset
          if (customId === 'embed_reset') {
            const drafts = embedCommand.getDraft.__proto__; // won't work, clear via module
            // Clear the draft by resetting its keys
            Object.assign(draft, {
              title: '', description: '', color: '#5865F2',
              author_name: '', author_icon: '', author_url: '',
              footer_text: '', footer_icon: '',
              thumbnail: '', image: '', content: ''
            });
            const preview = embedCommand.buildPreviewEmbed(guild, draft);
            const components = embedCommand.buildEditorComponents();
            return interaction.update({ embeds: [preview], components });
          }

          // 1. Edit Basic Info
          if (customId === 'embed_edit_basic') {
            const { ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
            const modal = new ModalBuilder().setCustomId('embed_modal_basic').setTitle('Edit Basic Information');
            modal.addComponents(
              new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('embed_input_title').setLabel('Embed Title').setStyle(TextInputStyle.Short)
                  .setPlaceholder('Your title here').setValue(draft.title || '').setRequired(false)
              ),
              new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('embed_input_desc').setLabel('Description (GIF emojis work here)').setStyle(TextInputStyle.Paragraph)
                  .setPlaceholder('Your description here').setValue(draft.description || '').setRequired(false)
              ),
              new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('embed_input_color').setLabel('Hex Color (e.g. #5865F2)').setStyle(TextInputStyle.Short)
                  .setPlaceholder('#5865F2').setValue(draft.color || '').setRequired(false)
              ),
              new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('embed_input_content').setLabel('Message Content (above embed)').setStyle(TextInputStyle.Short)
                  .setPlaceholder('Optional text above the embed').setValue(draft.content || '').setRequired(false)
              )
            );
            return interaction.showModal(modal);
          }

          // 2. Edit Author
          if (customId === 'embed_edit_author') {
            const { ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
            const modal = new ModalBuilder().setCustomId('embed_modal_author').setTitle('Edit Author');
            modal.addComponents(
              new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('embed_input_author_name').setLabel('Author Name').setStyle(TextInputStyle.Short)
                  .setPlaceholder('e.g. Server Staff').setValue(draft.author_name || '').setRequired(false)
              ),
              new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('embed_input_author_icon').setLabel('Author Icon URL').setStyle(TextInputStyle.Short)
                  .setPlaceholder('{server_icon} or https://...').setValue(draft.author_icon || '').setRequired(false)
              ),
              new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('embed_input_author_url').setLabel('Author Click URL (optional)').setStyle(TextInputStyle.Short)
                  .setPlaceholder('https://...').setValue(draft.author_url || '').setRequired(false)
              )
            );
            return interaction.showModal(modal);
          }

          // 3. Edit Footer
          if (customId === 'embed_edit_footer') {
            const { ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
            const modal = new ModalBuilder().setCustomId('embed_modal_footer').setTitle('Edit Footer');
            modal.addComponents(
              new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('embed_input_footer_text').setLabel('Footer Text').setStyle(TextInputStyle.Short)
                  .setPlaceholder('Footer goes here').setValue(draft.footer_text || '').setRequired(false)
              ),
              new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('embed_input_footer_icon').setLabel('Footer Icon URL').setStyle(TextInputStyle.Short)
                  .setPlaceholder('https://...').setValue(draft.footer_icon || '').setRequired(false)
              )
            );
            return interaction.showModal(modal);
          }

          // 4. Edit Images
          if (customId === 'embed_edit_images') {
            const { ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
            const modal = new ModalBuilder().setCustomId('embed_modal_images').setTitle('Edit Images');
            modal.addComponents(
              new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('embed_input_thumbnail').setLabel('Thumbnail URL (top-right corner)').setStyle(TextInputStyle.Short)
                  .setPlaceholder('{server_icon} or https://...').setValue(draft.thumbnail || '').setRequired(false)
              ),
              new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('embed_input_image').setLabel('Large Image URL (bottom of embed)').setStyle(TextInputStyle.Short)
                  .setPlaceholder('https://...').setValue(draft.image || '').setRequired(false)
              )
            );
            return interaction.showModal(modal);
          }

          // 5. Send Embed (pick channel)
          if (customId === 'embed_send_modal') {
            const { ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
            const modal = new ModalBuilder().setCustomId('embed_modal_send').setTitle('Send Embed');
            modal.addComponents(
              new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('embed_input_send_channel').setLabel('Destination Channel (Mention or ID)')
                  .setStyle(TextInputStyle.Short).setPlaceholder(`e.g. #general or ${interaction.channelId}`)
                  .setValue(`<#${interaction.channelId}>`).setRequired(true)
              )
            );
            return interaction.showModal(modal);
          }
        } catch (embedBtnErr) {
          Logger.error(`Embed editor button error [${customId}]: ${embedBtnErr.stack}`);
          const fn = interaction.replied || interaction.deferred
            ? (d) => interaction.followUp(d).catch(() => null)
            : (d) => interaction.reply(d).catch(() => null);
          return fn({ embeds: [EmbedGenerator.error('Editor Error', embedBtnErr.message)], ephemeral: true });
        }
      }

      // ─── Server Branding Interactive Editor Buttons ───────────
      if (customId.startsWith('branding_btn_')) {
        const isOwner = await isBotOwner(client, user.id);
        if (!isOwner) {
          return interaction.reply({
            embeds: [EmbedGenerator.error('Access Denied', '❌ The **Branding** system is strictly restricted to the **Bot Owner**.')],
            ephemeral: true
          });
        }

        const branding = brandingManager.getServerBranding(guild?.id);

        // 1. Color
        if (customId === 'branding_btn_color') {
          const modal = new ModalBuilder()
            .setCustomId('branding_modal_color')
            .setTitle('Edit Embed Color');

          const colorInput = new TextInputBuilder()
            .setCustomId('branding_input_color')
            .setLabel('Embed Hex Color (e.g. #FF0000, #5865F2)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('#FF0000')
            .setValue(branding.embed_color || '#FF0000')
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(colorInput));
          return interaction.showModal(modal);
        }

        // 2. Description
        if (customId === 'branding_btn_description') {
          const modal = new ModalBuilder()
            .setCustomId('branding_modal_description')
            .setTitle('Edit Description / Tagline');

          const descInput = new TextInputBuilder()
            .setCustomId('branding_input_description')
            .setLabel('Default Description Tagline')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Enter default server description / footer text (Leave blank to clear)')
            .setValue(branding.description_text || '')
            .setRequired(false);

          modal.addComponents(new ActionRowBuilder().addComponents(descInput));
          return interaction.showModal(modal);
        }

        // 3. Author
        if (customId === 'branding_btn_author') {
          const modal = new ModalBuilder()
            .setCustomId('branding_modal_author')
            .setTitle('Edit Author Details');

          const nameInput = new TextInputBuilder()
            .setCustomId('branding_input_author_name')
            .setLabel('Author Name')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('𝐌𝐢𝐚 ⚚')
            .setValue(branding.author_name || '𝐌𝐢𝐚 ⚚')
            .setRequired(true);

          const iconInput = new TextInputBuilder()
            .setCustomId('branding_input_author_icon')
            .setLabel('Author Icon URL (Direct Image Link)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('https://...')
            .setValue(branding.author_icon || '')
            .setRequired(false);

          modal.addComponents(
            new ActionRowBuilder().addComponents(nameInput),
            new ActionRowBuilder().addComponents(iconInput)
          );
          return interaction.showModal(modal);
        }

        // 4. Images
        if (customId === 'branding_btn_images') {
          const modal = new ModalBuilder()
            .setCustomId('branding_modal_images')
            .setTitle('Edit Bot Thumbnail & Banner');

          const thumbInput = new TextInputBuilder()
            .setCustomId('branding_input_thumbnail')
            .setLabel('Bot Thumbnail URL (Direct Image Link)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('https://...')
            .setValue(branding.thumbnail_url || '')
            .setRequired(false);

          const bannerInput = new TextInputBuilder()
            .setCustomId('branding_input_banner')
            .setLabel('Bot Banner URL (Direct Image Link)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('https://...')
            .setValue(branding.banner_url || '')
            .setRequired(false);

          modal.addComponents(
            new ActionRowBuilder().addComponents(thumbInput),
            new ActionRowBuilder().addComponents(bannerInput)
          );
          return interaction.showModal(modal);
        }

        // 5. Footer
        if (customId === 'branding_btn_footer') {
          const modal = new ModalBuilder()
            .setCustomId('branding_modal_footer')
            .setTitle('Edit Footer Details');

          const footerTextInput = new TextInputBuilder()
            .setCustomId('branding_input_footer_text')
            .setLabel('Footer Text')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Mia • Security & Operations')
            .setValue(branding.footer_text || 'Mia • Security & Operations')
            .setRequired(true);

          const footerIconInput = new TextInputBuilder()
            .setCustomId('branding_input_footer_icon')
            .setLabel('Footer Icon URL (Direct Image Link)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('https://...')
            .setValue(branding.footer_icon || '')
            .setRequired(false);

          modal.addComponents(
            new ActionRowBuilder().addComponents(footerTextInput),
            new ActionRowBuilder().addComponents(footerIconInput)
          );
          return interaction.showModal(modal);
        }

        // 6. Preview
        if (customId === 'branding_btn_preview') {
          const previewEmbed = new EmbedBuilder()
            .setColor(branding.embed_color || '#FF0000')
            .setAuthor({
              name: branding.author_name || '𝐌𝐢𝐚 ⚚',
              iconURL: branding.author_icon || undefined
            })
            .setTitle('Sample Security Embed // Live Preview')
            .setDescription(
              `This is an interactive preview of how bot embeds look with your current branding configuration for **${guild?.name}**.\n\n` +
              (branding.description_text ? `*${branding.description_text}*\n\n` : '') +
              `🛡️ **Antinuke:** \`Active\`\n` +
              `⚡ **Automod:** \`Enabled\`\n` +
              `📊 **Audit Logging:** \`7 Channels Connected\``
            )
            .setFooter({
              text: branding.footer_text || 'Mia • Security & Operations',
              iconURL: branding.footer_icon || undefined
            })
            .setTimestamp();

          if (branding.thumbnail_url) {
            previewEmbed.setThumbnail(branding.thumbnail_url);
          }
          if (branding.banner_url) {
            previewEmbed.setImage(branding.banner_url);
          }

          return interaction.reply({ embeds: [previewEmbed], ephemeral: true });
        }

        // 7. Reset
        if (customId === 'branding_btn_reset') {
          brandingManager.resetServerBranding(guild?.id);
          if (guild) {
            await guild.members.me?.setNickname(null).catch(() => null);
          }
          const updatedEmbed = brandingCommand.buildServerBrandingEmbed(guild);
          const updatedComponents = brandingCommand.buildServerBrandingComponents();
          return interaction.update({ embeds: [updatedEmbed], components: updatedComponents });
        }
      }

      // Anti-Raid Buttons
      if (customId === 'antiraid_toggle') {
        const isAuth = await PermissionHelper.isCommandAuthorized(guild, user, client);
        if (!isAuth && !member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
          return interaction.reply({ embeds: [EmbedGenerator.error('Permission Denied', 'You need `Manage Server` permissions.')], ephemeral: true });
        }
        const config = antiraidManager.getConfig(guild.id);
        antiraidManager.setEnabled(guild.id, !config.enabled);

        const embed = antiraidCommand.buildAntiraidConfigEmbed(guild);
        const components = antiraidCommand.buildAntiraidComponents(guild);
        return interaction.update({ embeds: [embed], components });
      }

      if (customId === 'antiraid_lockdown') {
        const isAuth = await PermissionHelper.isCommandAuthorized(guild, user, client);
        if (!isAuth && !member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
          return interaction.reply({ embeds: [EmbedGenerator.error('Permission Denied', 'You need `Manage Server` permissions.')], ephemeral: true });
        }
        await interaction.deferUpdate();
        await AntiraidEngine.lockdownGuild(guild, member);
        const embed = antiraidCommand.buildAntiraidConfigEmbed(guild);
        const components = antiraidCommand.buildAntiraidComponents(guild);
        return interaction.editReply({ embeds: [embed], components });
      }

      if (customId === 'antiraid_unlock') {
        const isAuth = await PermissionHelper.isCommandAuthorized(guild, user, client);
        if (!isAuth && !member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
          return interaction.reply({ embeds: [EmbedGenerator.error('Permission Denied', 'You need `Manage Server` permissions.')], ephemeral: true });
        }
        await interaction.deferUpdate();
        await AntiraidEngine.unlockGuild(guild, member);
        const embed = antiraidCommand.buildAntiraidConfigEmbed(guild);
        const components = antiraidCommand.buildAntiraidComponents(guild);
        return interaction.editReply({ embeds: [embed], components });
      }

      if (customId === 'antiraid_reset') {
        const isAuth = await PermissionHelper.isCommandAuthorized(guild, user, client);
        if (!isAuth && !member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
          return interaction.reply({ embeds: [EmbedGenerator.error('Permission Denied', 'You need `Manage Server` permissions.')], ephemeral: true });
        }
        antiraidManager.resetConfig(guild.id);
        const embed = antiraidCommand.buildAntiraidConfigEmbed(guild);
        const components = antiraidCommand.buildAntiraidComponents(guild);
        return interaction.update({ embeds: [embed], components });
      }

      if (customId === 'antiraid_view_config') {
        const embed = antiraidCommand.buildAntiraidConfigEmbed(guild);
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (customId === 'antiraid_close') {
        return interaction.message?.delete().catch(() => null);
      }

      // Stop Spam Button Handler
      if (customId.startsWith('stop_spam_')) {
        const isOwner = await spamCommand.isAuthorizedOwner(guild, interaction.user, client);
        if (!isOwner) {
          return interaction.reply({ content: '❌ Only the bot owner can stop spam tasks.', ephemeral: true });
        }

        const channelId = customId.replace('stop_spam_', '');
        const stopped = spamCommand.stopSpam(channelId);

        return interaction.reply({
          content: stopped ? '🛑 Spam task has been halted.' : 'ℹ️ No active spam task was running in that channel.',
          ephemeral: true
        });
      }

      // One-Click "Spam Server" Burst Button Handler (User-App / Unjoined Servers)
      if (customId === 'spam_burst_btn') {
        return spamCommand.handleSpamBurstButton(interaction, client);
      }

      // Welcomer Interactive Control Buttons (welcomer_*)
      if (customId.startsWith('welcomer_')) {
        if (!member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
          return interaction.reply({ content: '❌ You need `Manage Server` permissions to use Welcomer controls.', ephemeral: true });
        }

        const config = featureManager.getWelcomerConfig(guild.id);
        const embedData = config.embed_data || {};

        // 1. Open Basic Info Modal
        if (customId === 'welcomer_edit_basic') {
          const modal = new ModalBuilder()
            .setCustomId('welcomer_modal_basic')
            .setTitle('Edit Basic Info');

          const contentInput = new TextInputBuilder()
            .setCustomId('welcomer_input_content')
            .setLabel('Message Text Outside Embed')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('e.g. Hey {user} Welcome to {server}!')
            .setValue(embedData.content || '')
            .setRequired(false);

          const titleInput = new TextInputBuilder()
            .setCustomId('welcomer_input_title')
            .setLabel('Embed Title')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g. {server}')
            .setValue(embedData.title || '')
            .setRequired(false);

          const descInput = new TextInputBuilder()
            .setCustomId('welcomer_input_desc')
            .setLabel('Embed Description')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('e.g. Welcome {user}!\n📜 Rules: <#123>\n🎖️ Member #{membercount}')
            .setValue(embedData.description || config.message || '')
            .setRequired(false);

          const colorInput = new TextInputBuilder()
            .setCustomId('welcomer_input_color')
            .setLabel('Embed Hex Color (e.g. #ED4245, #5865F2)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('#ED4245')
            .setValue(embedData.color || '#ED4245')
            .setRequired(false);

          modal.addComponents(
            new ActionRowBuilder().addComponents(contentInput),
            new ActionRowBuilder().addComponents(titleInput),
            new ActionRowBuilder().addComponents(descInput),
            new ActionRowBuilder().addComponents(colorInput)
          );

          return interaction.showModal(modal);
        }

        // 2. Open Author Modal
        if (customId === 'welcomer_edit_author') {
          const modal = new ModalBuilder()
            .setCustomId('welcomer_modal_author')
            .setTitle('Edit Author');

          const authorNameInput = new TextInputBuilder()
            .setCustomId('welcomer_input_author_name')
            .setLabel('Author Name')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g. {server} or Official Community')
            .setValue(embedData.author_name || '')
            .setRequired(false);

          const authorIconInput = new TextInputBuilder()
            .setCustomId('welcomer_input_author_icon')
            .setLabel('Author Icon URL (or {server_icon}, {avatar})')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('{server_icon}')
            .setValue(embedData.author_icon || '')
            .setRequired(false);

          const authorUrlInput = new TextInputBuilder()
            .setCustomId('welcomer_input_author_url')
            .setLabel('Author Link URL')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('https://...')
            .setValue(embedData.author_url || '')
            .setRequired(false);

          modal.addComponents(
            new ActionRowBuilder().addComponents(authorNameInput),
            new ActionRowBuilder().addComponents(authorIconInput),
            new ActionRowBuilder().addComponents(authorUrlInput)
          );

          return interaction.showModal(modal);
        }

        // 3. Open Footer Modal
        if (customId === 'welcomer_edit_footer') {
          const modal = new ModalBuilder()
            .setCustomId('welcomer_modal_footer')
            .setTitle('Edit Footer');

          const footerTextInput = new TextInputBuilder()
            .setCustomId('welcomer_input_footer_text')
            .setLabel('Footer Text')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g. {server} • Member #{membercount}')
            .setValue(embedData.footer_text || '')
            .setRequired(false);

          const footerIconInput = new TextInputBuilder()
            .setCustomId('welcomer_input_footer_icon')
            .setLabel('Footer Icon URL (or {server_icon}, {avatar})')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('{server_icon}')
            .setValue(embedData.footer_icon || '')
            .setRequired(false);

          modal.addComponents(
            new ActionRowBuilder().addComponents(footerTextInput),
            new ActionRowBuilder().addComponents(footerIconInput)
          );

          return interaction.showModal(modal);
        }

        // 4. Open Images Modal
        if (customId === 'welcomer_edit_images') {
          const modal = new ModalBuilder()
            .setCustomId('welcomer_modal_images')
            .setTitle('Edit Images');

          const thumbInput = new TextInputBuilder()
            .setCustomId('welcomer_input_thumb')
            .setLabel('Thumbnail URL (or {avatar}, {server_icon})')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('{avatar}')
            .setValue(embedData.thumbnail || '')
            .setRequired(false);

          const bannerInput = new TextInputBuilder()
            .setCustomId('welcomer_input_banner')
            .setLabel('Large Banner Image URL (https://...)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('https://i.imgur.com/example.png')
            .setValue(embedData.image || '')
            .setRequired(false);

          modal.addComponents(
            new ActionRowBuilder().addComponents(thumbInput),
            new ActionRowBuilder().addComponents(bannerInput)
          );

          return interaction.showModal(modal);
        }

        // 5. Toggle Welcomer Button
        if (customId === 'welcomer_toggle_btn') {
          const newState = config.enabled ? 0 : 1;
          featureManager.setWelcomerEnabled(guild.id, newState);

          const updatedConfig = featureManager.getWelcomerConfig(guild.id);
          const payload = welcomerCommand.formatWelcomePayload(guild, member, updatedConfig);
          const components = welcomerCommand.buildWelcomerEditorComponents(guild);

          return interaction.update({
            content: payload.content || null,
            embeds: payload.embeds,
            components
          });
        }

        // 6. Test Welcome Greeting
        if (customId === 'welcomer_test_btn') {
          const targetChannelId = config.channel_id;
          if (!targetChannelId) {
            return interaction.reply({
              embeds: [EmbedGenerator.error('No Channel Set', 'No welcome channel is configured. Use `/welcomer channel` to set one first.')],
              ephemeral: true
            });
          }

          const targetChannel = guild.channels.cache.get(targetChannelId);
          if (!targetChannel) {
            return interaction.reply({
              embeds: [EmbedGenerator.error('Channel Not Found', `Welcome channel <#${targetChannelId}> no longer exists. Set a new one with \`/welcomer channel\`.`)],
              ephemeral: true
            });
          }

          await interaction.deferReply({ ephemeral: true });
          const payload = welcomerCommand.formatWelcomePayload(guild, member, config);
          await targetChannel.send({
            content: payload.content || null,
            embeds: payload.embeds
          });

          return interaction.editReply({
            embeds: [EmbedGenerator.success('Test Sent!', `Test welcome message sent to ${targetChannel}.`)]
          });
        }
      }

      // Louder Mic & Earrape Guard Control Buttons (antimic_*)
      if (customId.startsWith('antimic_')) {
        if (!member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
          return interaction.reply({ content: '❌ You need `Manage Server` permissions to use Mic Guard controls.', ephemeral: true });
        }

        if (customId === 'antimic_toggle_btn') {
          const config = micGuardManager.getConfig(guild.id);
          const newState = config.enabled ? 0 : 1;
          micGuardManager.setEnabled(guild.id, newState);

          const embed = antimicCommand.buildMicGuardEmbed(guild);
          const components = antimicCommand.buildMicGuardComponents(guild);
          return interaction.update({ embeds: [embed], components });
        }

        if (customId === 'antimic_cycle_sens_btn') {
          const config = micGuardManager.getConfig(guild.id);
          const current = config.sensitivity || 'standard';
          const nextSens = current === 'standard' ? 'high' : (current === 'high' ? 'lenient' : 'standard');
          micGuardManager.setSensitivity(guild.id, nextSens);

          const embed = antimicCommand.buildMicGuardEmbed(guild);
          const components = antimicCommand.buildMicGuardComponents(guild);
          return interaction.update({ embeds: [embed], components });
        }

        if (customId === 'antimic_join_btn') {
          const connection = getVoiceConnection(guild.id);
          if (connection && connection.state.status !== VoiceConnectionStatus.Destroyed) {
            connection.destroy();
            const embed = antimicCommand.buildMicGuardEmbed(guild);
            const components = antimicCommand.buildMicGuardComponents(guild);
            return interaction.update({ embeds: [embed], components });
          } else {
            const voiceChannel = member.voice?.channel;
            if (!voiceChannel) {
              return interaction.reply({ content: '❌ You must join a voice channel first before activating Mic Guard.', ephemeral: true });
            }

            const newConn = joinVoiceChannel({
              channelId: String(voiceChannel.id),
              guildId: String(guild.id),
              adapterCreator: guild.voiceAdapterCreator,
              selfDeaf: false,
              selfMute: true
            });

            await entersState(newConn, VoiceConnectionStatus.Ready, 15_000).catch(() => null);
            micGuardEngine.attach(newConn, guild, interaction.channel);

            const embed = antimicCommand.buildMicGuardEmbed(guild);
            const components = antimicCommand.buildMicGuardComponents(guild);
            return interaction.update({ embeds: [embed], components });
          }
        }
      }

      // VoiceMaster Interface Control Buttons (vm_*)
      if (customId.startsWith('vm_')) {
        const voiceChannel = member.voice?.channel || guild.channels.cache.get(interaction.channelId);
        if (!voiceChannel || (voiceChannel.type !== ChannelType.GuildVoice && voiceChannel.type !== ChannelType.GuildStageVoice)) {
          return interaction.reply({ content: '❌ You must be connected to your VoiceMaster temporary voice channel to use this control.', ephemeral: true });
        }

        const tempVoice = extraFeaturesManager.getTempVoice(voiceChannel.id);
        if (!tempVoice) {
          return interaction.reply({ content: '❌ This voice channel is not managed by VoiceMaster.', ephemeral: true });
        }

        // Claim ownership check
        if (customId === 'vm_claim') {
          if (tempVoice.owner_id === member.id) {
            return interaction.reply({ content: '👑 You are already the owner of this voice channel.', ephemeral: true });
          }

          const currentOwnerInRoom = voiceChannel.members.has(tempVoice.owner_id);
          if (currentOwnerInRoom) {
            return interaction.reply({ content: `❌ You cannot claim this channel while the owner (<@${tempVoice.owner_id}>) is still connected.`, ephemeral: true });
          }

          extraFeaturesManager.updateTempVoiceOwner(voiceChannel.id, member.id);
          return interaction.reply({ content: `👑 You have claimed ownership of **${voiceChannel.name}**!`, ephemeral: true });
        }

        // All other controls require channel ownership or ManageChannels permission
        if (tempVoice.owner_id !== member.id && !member.permissions.has(PermissionFlagsBits.ManageChannels)) {
          return interaction.reply({ content: `❌ Only the room owner (<@${tempVoice.owner_id}>) can manage this voice channel.`, ephemeral: true });
        }

        if (customId === 'vm_lock') {
          await voiceChannel.permissionOverwrites.edit(guild.roles.everyone, { Connect: false });
          return interaction.reply({ content: `🔒 Your voice channel **${voiceChannel.name}** is now **locked**. Nobody new can join.`, ephemeral: true });
        }

        if (customId === 'vm_unlock') {
          await voiceChannel.permissionOverwrites.edit(guild.roles.everyone, { Connect: null });
          return interaction.reply({ content: `🔓 Your voice channel **${voiceChannel.name}** is now **unlocked**.`, ephemeral: true });
        }

        if (customId === 'vm_hide') {
          await voiceChannel.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: false });
          return interaction.reply({ content: `🙈 Your voice channel **${voiceChannel.name}** is now **hidden** from other members.`, ephemeral: true });
        }

        if (customId === 'vm_reveal') {
          await voiceChannel.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: null });
          return interaction.reply({ content: `👁️ Your voice channel **${voiceChannel.name}** is now **visible** to everyone.`, ephemeral: true });
        }

        if (customId === 'vm_rename') {
          const modal = new ModalBuilder()
            .setCustomId(`vm_modal_rename_${voiceChannel.id}`)
            .setTitle('Rename Voice Channel')
            .addComponents(
              new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId('vm_input_name')
                  .setLabel('New Channel Name')
                  .setStyle(TextInputStyle.Short)
                  .setPlaceholder(voiceChannel.name)
                  .setMaxLength(100)
                  .setRequired(true)
              )
            );
          return interaction.showModal(modal);
        }

        if (customId === 'vm_limit') {
          const modal = new ModalBuilder()
            .setCustomId(`vm_modal_limit_${voiceChannel.id}`)
            .setTitle('Set User Limit')
            .addComponents(
              new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId('vm_input_limit')
                  .setLabel('User Limit (0 = Unlimited, Max 99)')
                  .setStyle(TextInputStyle.Short)
                  .setPlaceholder(`${voiceChannel.userLimit || 0}`)
                  .setMaxLength(2)
                  .setRequired(true)
              )
            );
          return interaction.showModal(modal);
        }

        if (customId === 'vm_mute') {
          const userSelect = new UserSelectMenuBuilder()
            .setCustomId(`vm_select_mute_${voiceChannel.id}`)
            .setPlaceholder('Select a user to mute in this channel...');
          return interaction.reply({
            content: '🔇 **Select a user to mute:**',
            components: [new ActionRowBuilder().addComponents(userSelect)],
            ephemeral: true
          });
        }

        if (customId === 'vm_unmute') {
          const userSelect = new UserSelectMenuBuilder()
            .setCustomId(`vm_select_unmute_${voiceChannel.id}`)
            .setPlaceholder('Select a user to unmute in this channel...');
          return interaction.reply({
            content: '🎙️ **Select a user to unmute:**',
            components: [new ActionRowBuilder().addComponents(userSelect)],
            ephemeral: true
          });
        }

        if (customId === 'vm_deafen') {
          const userSelect = new UserSelectMenuBuilder()
            .setCustomId(`vm_select_deafen_${voiceChannel.id}`)
            .setPlaceholder('Select a user to deafen in this channel...');
          return interaction.reply({
            content: '🔕 **Select a user to deafen:**',
            components: [new ActionRowBuilder().addComponents(userSelect)],
            ephemeral: true
          });
        }

        if (customId === 'vm_undeafen') {
          const userSelect = new UserSelectMenuBuilder()
            .setCustomId(`vm_select_undeafen_${voiceChannel.id}`)
            .setPlaceholder('Select a user to undeafen in this channel...');
          return interaction.reply({
            content: '🎧 **Select a user to undeafen:**',
            components: [new ActionRowBuilder().addComponents(userSelect)],
            ephemeral: true
          });
        }

        if (customId === 'vm_permit') {
          const userSelect = new UserSelectMenuBuilder()
            .setCustomId(`vm_select_permit_${voiceChannel.id}`)
            .setPlaceholder('Select a user to permit into your channel...');
          return interaction.reply({
            content: '🔊 **Select a user to permit (allows joining even if hidden/locked):**',
            components: [new ActionRowBuilder().addComponents(userSelect)],
            ephemeral: true
          });
        }

        if (customId === 'vm_ban') {
          const userSelect = new UserSelectMenuBuilder()
            .setCustomId(`vm_select_ban_${voiceChannel.id}`)
            .setPlaceholder('Select a user to ban/kick from your channel...');
          return interaction.reply({
            content: '🔨 **Select a user to block and kick from your channel:**',
            components: [new ActionRowBuilder().addComponents(userSelect)],
            ephemeral: true
          });
        }

        if (customId === 'vm_transfer') {
          const userSelect = new UserSelectMenuBuilder()
            .setCustomId(`vm_select_transfer_${voiceChannel.id}`)
            .setPlaceholder('Select the new owner of this channel...');
          return interaction.reply({
            content: '✈️ **Select a user to transfer room ownership to:**',
            components: [new ActionRowBuilder().addComponents(userSelect)],
            ephemeral: true
          });
        }
      }
    }

    // 3. Handle Select Menu Interactions
    if (interaction.isStringSelectMenu()) {
      const { customId, guild, member, user, values } = interaction;

      // Automod Select Event Toggle
      if (customId === 'automod_select_events') {
        const isAuth = await PermissionHelper.isCommandAuthorized(guild, user, client);
        if (!isAuth && !member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
          return interaction.reply({ embeds: [EmbedGenerator.error('Permission Denied', 'You need `Manage Server` permissions to modify AutoMod settings.')], ephemeral: true });
        }

        const selectedFeature = values[0];
        const config = moderationManager.getAutomodConfig(guild.id);
        const currentState = Boolean(config[selectedFeature]);

        moderationManager.setAutomodFeature(guild.id, selectedFeature, !currentState);

        const embed = automodCommand.buildAutomodSetupEmbed(guild);
        const components = automodCommand.buildAutomodSetupComponents();

        return interaction.update({ embeds: [embed], components });
      }

      // Help Category Select Menu
      if (customId === 'help_category_select') {
        const categoryKey = values[0];
        const embed = helpCommand.buildCategoryHelpEmbed(categoryKey, client, guild);

        if (!embed) {
          return interaction.reply({ embeds: [EmbedGenerator.error('Error', 'Category not found.')], ephemeral: true });
        }

        const selectMenu = helpCommand.buildSelectMenu(categoryKey);
        const buttons = helpCommand.buildButtons(client, true);

        return interaction.update({
          embeds: [embed],
          components: [selectMenu, buttons]
        });
      }

      // Logging Select Category to Configure Channel
      if (customId === 'logging_select_category') {
        const isAuth = await PermissionHelper.isCommandAuthorized(guild, user, client);
        if (!isAuth && !member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
          return interaction.reply({ embeds: [EmbedGenerator.error('Permission Denied', 'You need `Manage Server` permissions to configure logging.')], ephemeral: true });
        }

        const selectedCategory = values[0];
        const channelSelect = new ChannelSelectMenuBuilder()
          .setCustomId(`logging_channel_${selectedCategory}`)
          .setPlaceholder(`Select a text channel for ${selectedCategory.toUpperCase()} logs...`)
          .setChannelTypes(ChannelType.GuildText);

        const row = new ActionRowBuilder().addComponents(channelSelect);

        return interaction.reply({
          embeds: [
            EmbedGenerator.base()
              .setTitle(`📁 Set ${selectedCategory.toUpperCase()} Logging Channel`)
              .setDescription(`Please select a text channel from the menu below to route all **${selectedCategory.toUpperCase()}** audit events:`)
          ],
          components: [row],
          ephemeral: true
        });
      }

      // Anti-Raid Preset Select Menu
      if (customId === 'antiraid_preset_select') {
        const isAuth = await PermissionHelper.isCommandAuthorized(guild, user, client);
        if (!isAuth && !member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
          return interaction.reply({ embeds: [EmbedGenerator.error('Permission Denied', 'You need `Manage Server` permissions.')], ephemeral: true });
        }

        const presetKey = values[0];
        antiraidManager.applyPreset(guild.id, presetKey);

        const embed = antiraidCommand.buildAntiraidConfigEmbed(guild);
        const components = antiraidCommand.buildAntiraidComponents(guild);

        return interaction.update({ embeds: [embed], components });
      }

      // VoiceMaster Setup Button Selection
      if (customId === 'vm_setup_select_buttons') {
        const isAuth = await PermissionHelper.isCommandAuthorized(guild, user, client);
        if (!isAuth && !member?.permissions.has(PermissionFlagsBits.ManageChannels)) {
          return interaction.reply({ embeds: [EmbedGenerator.error('Permission Denied', 'You need `Manage Channels` permissions to configure VoiceMaster.')], ephemeral: true });
        }

        await interaction.deferUpdate();
        try {
          const selectedButtons = values && values.length > 0 ? values : ['all'];
          const result = await voicemasterCommand.executeVoiceMasterSetup(guild, selectedButtons);
          const { category, interfaceChannel, joinChannel, updated } = result;

          const title = updated ? 'VoiceMaster Interface Updated' : 'VoiceMaster Configured Successfully';
          const description = updated
            ? `✨ Successfully updated the live **${interfaceChannel}** control panel with your selected buttons!\n\n` +
              `*You can run \`/voicemaster buttons\` or \`,voicemaster\` at any time to add or remove buttons.*`
            : `✨ Created **${category ? category.name : 'VoiceMaster'}** dynamic voice system:\n\n` +
              `• 💬 **Interface Panel:** ${interfaceChannel}\n` +
              `• ➕ **Join to Create:** ${joinChannel}\n\n` +
              `*You can run \`/voicemaster buttons\` or \`,voicemaster\` anytime to customize which buttons are visible.*`;

          return interaction.editReply({
            embeds: [EmbedGenerator.success(title, description)],
            components: []
          });
        } catch (err) {
          return interaction.editReply({
            embeds: [EmbedGenerator.error('VoiceMaster Operation Failed', err.message)],
            components: []
          });
        }
      }
    }

    // 4. Handle Channel Select Menu Interactions
    if (interaction.isChannelSelectMenu()) {
      const { customId, guild, member, user, values } = interaction;

      if (customId.startsWith('logging_channel_')) {
        const isAuth = await PermissionHelper.isCommandAuthorized(guild, user, client);
        if (!isAuth && !member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
          return interaction.reply({ embeds: [EmbedGenerator.error('Permission Denied', 'You need `Manage Server` permissions to configure logging.')], ephemeral: true });
        }

        const category = customId.replace('logging_channel_', '');
        const targetChannelId = values[0];

        loggingManager.setChannel(guild.id, category, targetChannelId);

        return interaction.update({
          embeds: [
            EmbedGenerator.success(
              'Channel Bound Successfully',
              `✅ **${category.toUpperCase()}** audit logs will now be sent to <#${targetChannelId}>.\n\n*You can view the updated configuration with \`/logging config\`.*`
            )
          ],
          components: []
        });
      }
    }

    // 5. Handle User Select Menu Interactions (VoiceMaster controls)
    if (interaction.isUserSelectMenu()) {
      const { customId, guild, member, values } = interaction;

      if (customId.startsWith('vm_select_')) {
        const parts = customId.split('_');
        const action = parts[2];
        const channelId = parts[3];
        const targetUserId = values[0];
        const targetMember = await guild.members.fetch(targetUserId).catch(() => null);
        const voiceChannel = guild.channels.cache.get(channelId);

        if (!voiceChannel) {
          return interaction.reply({ content: '❌ Voice channel no longer exists.', ephemeral: true });
        }

        const tempVoice = extraFeaturesManager.getTempVoice(channelId);
        if (!tempVoice || (tempVoice.owner_id !== member.id && !member.permissions.has(PermissionFlagsBits.ManageChannels))) {
          return interaction.reply({ content: '❌ You do not have permission to manage this room.', ephemeral: true });
        }

        if (action === 'mute') {
          if (targetMember && targetMember.voice?.channelId === channelId) {
            await targetMember.voice.setMute(true, 'VoiceMaster room owner action').catch(() => null);
            return interaction.update({ content: `🔇 Muted <@${targetUserId}> in **${voiceChannel.name}**.`, components: [] });
          } else {
            return interaction.update({ content: `❌ <@${targetUserId}> is not currently connected to your voice room.`, components: [] });
          }
        }

        if (action === 'unmute') {
          if (targetMember && targetMember.voice?.channelId === channelId) {
            await targetMember.voice.setMute(false, 'VoiceMaster room owner action').catch(() => null);
            return interaction.update({ content: `🎙️ Unmuted <@${targetUserId}> in **${voiceChannel.name}**.`, components: [] });
          } else {
            return interaction.update({ content: `❌ <@${targetUserId}> is not currently connected to your voice room.`, components: [] });
          }
        }

        if (action === 'deafen') {
          if (targetMember && targetMember.voice?.channelId === channelId) {
            await targetMember.voice.setDeaf(true, 'VoiceMaster room owner action').catch(() => null);
            return interaction.update({ content: `🔕 Deafened <@${targetUserId}> in **${voiceChannel.name}**.`, components: [] });
          } else {
            return interaction.update({ content: `❌ <@${targetUserId}> is not currently connected to your voice room.`, components: [] });
          }
        }

        if (action === 'undeafen') {
          if (targetMember && targetMember.voice?.channelId === channelId) {
            await targetMember.voice.setDeaf(false, 'VoiceMaster room owner action').catch(() => null);
            return interaction.update({ content: `🎧 Undeafened <@${targetUserId}> in **${voiceChannel.name}**.`, components: [] });
          } else {
            return interaction.update({ content: `❌ <@${targetUserId}> is not currently connected to your voice room.`, components: [] });
          }
        }

        if (action === 'permit') {
          await voiceChannel.permissionOverwrites.edit(targetUserId, {
            Connect: true,
            ViewChannel: true
          });
          return interaction.update({ content: `🔊 Permitted <@${targetUserId}> to join **${voiceChannel.name}**!`, components: [] });
        }

        if (action === 'ban') {
          await voiceChannel.permissionOverwrites.edit(targetUserId, {
            Connect: false,
            ViewChannel: false
          });
          if (targetMember && targetMember.voice?.channelId === channelId) {
            await targetMember.voice.disconnect('Banned by VoiceMaster room owner').catch(() => null);
          }
          return interaction.update({ content: `🔨 Blocked and disconnected <@${targetUserId}> from **${voiceChannel.name}**.`, components: [] });
        }

        if (action === 'transfer') {
          extraFeaturesManager.updateTempVoiceOwner(channelId, targetUserId);
          return interaction.update({ content: `✈️ Transferred ownership of **${voiceChannel.name}** to <@${targetUserId}>!`, components: [] });
        }
      }
    }

    // 6. Handle Modal Submit Interactions (VoiceMaster rename/limit, Embed, RR, Branding)
    if (interaction.isModalSubmit()) {
      const { customId, guild, fields, user } = interaction;

      // ─── Embed Editor Modals ──────────────────────────────────
      if (customId.startsWith('embed_modal_')) {
        try {
          const draft = embedCommand.getDraft(guild.id);

          if (customId === 'embed_modal_basic') {
            draft.title       = fields.getTextInputValue('embed_input_title').trim();
            draft.description = fields.getTextInputValue('embed_input_desc').trim();
            draft.color       = fields.getTextInputValue('embed_input_color').trim() || '#5865F2';
            draft.content     = fields.getTextInputValue('embed_input_content').trim();
          }

          if (customId === 'embed_modal_author') {
            draft.author_name = fields.getTextInputValue('embed_input_author_name').trim();
            draft.author_icon = fields.getTextInputValue('embed_input_author_icon').trim();
            draft.author_url  = fields.getTextInputValue('embed_input_author_url').trim();
          }

          if (customId === 'embed_modal_footer') {
            draft.footer_text = fields.getTextInputValue('embed_input_footer_text').trim();
            draft.footer_icon = fields.getTextInputValue('embed_input_footer_icon').trim();
          }

          if (customId === 'embed_modal_images') {
            draft.thumbnail = fields.getTextInputValue('embed_input_thumbnail').trim();
            draft.image     = fields.getTextInputValue('embed_input_image').trim();
          }

          if (customId === 'embed_modal_send') {
            const raw = fields.getTextInputValue('embed_input_send_channel').trim();
            const channelId = raw.replace(/[<#>]/g, '');
            const targetChannel = guild.channels.cache.get(channelId);

            if (!targetChannel) {
              return interaction.reply({
                embeds: [EmbedGenerator.error('Channel Not Found', `Could not find a channel for \`${raw}\`. Use a channel mention like <#channelId> or paste the channel ID.`)],
                ephemeral: true
              });
            }

            const preview = embedCommand.buildPreviewEmbed(guild, draft);
            await targetChannel.send({
              content: draft.content || null,
              embeds: [preview]
            });

            return interaction.reply({
              embeds: [EmbedGenerator.success('Embed Sent!', `Your embed was sent to ${targetChannel}.`)],
              ephemeral: true
            });
          }

          // For non-send modals, update the preview in-place
          const preview = embedCommand.buildPreviewEmbed(guild, draft);
          const components = embedCommand.buildEditorComponents();
          return interaction.update({ embeds: [preview], components });

        } catch (embedModalErr) {
          Logger.error(`Embed modal error [${customId}]: ${embedModalErr.stack}`);
          const fn = interaction.replied || interaction.deferred
            ? (d) => interaction.followUp(d).catch(() => null)
            : (d) => interaction.reply(d).catch(() => null);
          return fn({ embeds: [EmbedGenerator.error('Error', embedModalErr.message)], ephemeral: true });
        }
      }

      if (customId.startsWith('vm_modal_rename_')) {
        const channelId = customId.replace('vm_modal_rename_', '');
        const voiceChannel = guild.channels.cache.get(channelId);
        if (!voiceChannel) {
          return interaction.reply({ content: '❌ Voice channel no longer exists.', ephemeral: true });
        }
        const newName = fields.getTextInputValue('vm_input_name').trim();
        try {
          await voiceChannel.setName(newName);
          return interaction.reply({ content: `🖊️ Voice channel renamed to **${newName}**!`, ephemeral: true });
        } catch (err) {
          return interaction.reply({ content: `❌ Failed to rename channel: ${err.message}`, ephemeral: true });
        }
      }

      if (customId.startsWith('vm_modal_limit_')) {
        const channelId = customId.replace('vm_modal_limit_', '');
        const voiceChannel = guild.channels.cache.get(channelId);
        if (!voiceChannel) {
          return interaction.reply({ content: '❌ Voice channel no longer exists.', ephemeral: true });
        }
        const limitStr = fields.getTextInputValue('vm_input_limit').trim();
        const limit = parseInt(limitStr, 10);
        if (isNaN(limit) || limit < 0 || limit > 99) {
          return interaction.reply({ content: '❌ Please enter a valid number between 0 and 99.', ephemeral: true });
        }
        try {
          await voiceChannel.setUserLimit(limit);
          return interaction.reply({ content: `👥 User limit for **${voiceChannel.name}** set to **${limit === 0 ? 'Unlimited' : limit}**!`, ephemeral: true });
        } catch (err) {
          return interaction.reply({ content: `❌ Failed to set user limit: ${err.message}`, ephemeral: true });
        }
      }

      // Welcomer Modal Submissions
      if (customId.startsWith('welcomer_modal_')) {
        const config = featureManager.getWelcomerConfig(guild.id);
        const embedData = config.embed_data || {};

        if (customId === 'welcomer_modal_basic') {
          embedData.content = fields.getTextInputValue('welcomer_input_content').trim();
          embedData.title = fields.getTextInputValue('welcomer_input_title').trim();
          embedData.description = fields.getTextInputValue('welcomer_input_desc').trim();
          embedData.color = fields.getTextInputValue('welcomer_input_color').trim() || '#ED4245';

          featureManager.setWelcomerEmbedData(guild.id, embedData);
        }

        if (customId === 'welcomer_modal_author') {
          embedData.author_name = fields.getTextInputValue('welcomer_input_author_name').trim();
          embedData.author_icon = fields.getTextInputValue('welcomer_input_author_icon').trim();
          embedData.author_url = fields.getTextInputValue('welcomer_input_author_url').trim();

          featureManager.setWelcomerEmbedData(guild.id, embedData);
        }

        if (customId === 'welcomer_modal_footer') {
          embedData.footer_text = fields.getTextInputValue('welcomer_input_footer_text').trim();
          embedData.footer_icon = fields.getTextInputValue('welcomer_input_footer_icon').trim();

          featureManager.setWelcomerEmbedData(guild.id, embedData);
        }

        if (customId === 'welcomer_modal_images') {
          embedData.thumbnail = fields.getTextInputValue('welcomer_input_thumb').trim();
          embedData.image = fields.getTextInputValue('welcomer_input_banner').trim();

          featureManager.setWelcomerEmbedData(guild.id, embedData);
        }

        const updatedConfig = featureManager.getWelcomerConfig(guild.id);
        const payload = welcomerCommand.formatWelcomePayload(guild, interaction.member, updatedConfig);
        const components = welcomerCommand.buildWelcomerEditorComponents(guild);

        return interaction.reply({
          content: `✅ **Welcome Message Updated!** Here is your preview:\n${payload.content || ''}`.trim(),
          embeds: payload.embeds,
          components,
          ephemeral: true
        });
      }

      // ─── Reaction Role Visual Editor Modal Submissions ───────────────────
      if (customId.startsWith('rr_modal_')) {
        const draft = reactionRoleEditor.getDraft(guild.id);

        if (customId === 'rr_modal_basic') {
          draft.title = fields.getTextInputValue('rr_input_title').trim();
          draft.description = fields.getTextInputValue('rr_input_desc').trim();
          draft.color = fields.getTextInputValue('rr_input_color').trim() || '#5865F2';

          const previewEmbed = reactionRoleEditor.formatPreview(guild, draft);
          const components = reactionRoleEditor.buildEditorComponents(guild.id);
          return interaction.update({ embeds: [previewEmbed], components });
        }

        if (customId === 'rr_modal_author') {
          draft.author_name = fields.getTextInputValue('rr_input_author_name').trim();
          draft.author_icon = fields.getTextInputValue('rr_input_author_icon').trim();
          draft.author_url = fields.getTextInputValue('rr_input_author_url').trim();

          const previewEmbed = reactionRoleEditor.formatPreview(guild, draft);
          const components = reactionRoleEditor.buildEditorComponents(guild.id);
          return interaction.update({ embeds: [previewEmbed], components });
        }

        if (customId === 'rr_modal_footer') {
          draft.footer_text = fields.getTextInputValue('rr_input_footer_text').trim();
          draft.footer_icon = fields.getTextInputValue('rr_input_footer_icon').trim();

          const previewEmbed = reactionRoleEditor.formatPreview(guild, draft);
          const components = reactionRoleEditor.buildEditorComponents(guild.id);
          return interaction.update({ embeds: [previewEmbed], components });
        }

        if (customId === 'rr_modal_images') {
          draft.thumbnail = fields.getTextInputValue('rr_input_thumb').trim();
          draft.image = fields.getTextInputValue('rr_input_banner').trim();

          const previewEmbed = reactionRoleEditor.formatPreview(guild, draft);
          const components = reactionRoleEditor.buildEditorComponents(guild.id);
          return interaction.update({ embeds: [previewEmbed], components });
        }

        if (customId === 'rr_modal_add_button') {
          const rawRole = fields.getTextInputValue('rr_input_role').trim();
          const label = fields.getTextInputValue('rr_input_btn_label').trim();
          const emoji = fields.getTextInputValue('rr_input_btn_emoji')?.trim() || null;
          const rawStyle = (fields.getTextInputValue('rr_input_btn_style') || 'secondary').trim().toLowerCase();

          // Resolve role from ID, mention <@&id>, or exact name
          const cleanRoleId = rawRole.replace(/[<@&>]/g, '');
          const role = guild.roles.cache.get(cleanRoleId)
            || guild.roles.cache.find(r => r.name.toLowerCase() === rawRole.toLowerCase());

          if (!role) {
            return interaction.reply({
              embeds: [EmbedGenerator.error('Role Not Found', `Could not find any role matching \`${rawRole}\`. Please double check the ID or name.`)],
              ephemeral: true
            });
          }

          const botMember = guild.members.me;
          if (role.position >= botMember.roles.highest.position) {
            return interaction.reply({
              embeds: [
                EmbedGenerator.error(
                  'Hierarchy Error',
                  `The role <@&${role.id}> is higher than or equal to my highest role (<@&${botMember.roles.highest.id}>). Please move my role higher in Server Settings → Roles.`
                )
              ],
              ephemeral: true
            });
          }

          let style = ButtonStyle.Secondary;
          if (rawStyle === 'primary' || rawStyle === 'blue' || rawStyle === 'blurple') style = ButtonStyle.Primary;
          if (rawStyle === 'success' || rawStyle === 'green') style = ButtonStyle.Success;
          if (rawStyle === 'danger' || rawStyle === 'red') style = ButtonStyle.Danger;

          // Check if button already in draft
          if (draft.buttons.some(b => b.roleId === role.id)) {
            return interaction.reply({
              embeds: [EmbedGenerator.warn('Button Already Added', `A button for <@&${role.id}> is already in this panel draft.`)],
              ephemeral: true
            });
          }

          draft.buttons.push({
            roleId: role.id,
            label,
            emoji,
            style
          });

          const previewEmbed = reactionRoleEditor.formatPreview(guild, draft);
          const components = reactionRoleEditor.buildEditorComponents(guild.id);
          return interaction.update({ embeds: [previewEmbed], components });
        }

        if (customId === 'rr_modal_publish') {
          const rawChannel = fields.getTextInputValue('rr_input_publish_channel').trim();
          const cleanChannelId = rawChannel.replace(/[<#>]/g, '');
          const targetChannel = guild.channels.cache.get(cleanChannelId)
            || guild.channels.cache.find(c => c.name.toLowerCase() === rawChannel.toLowerCase());

          if (!targetChannel || !targetChannel.isTextBased()) {
            return interaction.reply({
              embeds: [EmbedGenerator.error('Invalid Channel', `Could not find a valid text channel matching \`${rawChannel}\`.`)],
              ephemeral: true
            });
          }

          if (draft.buttons.length === 0) {
            return interaction.reply({
              embeds: [EmbedGenerator.warn('No Buttons Added', 'Please add at least 1 role button using **`➕ add role button`** before sending the panel!')],
              ephemeral: true
            });
          }

          try {
            const finalEmbed = reactionRoleEditor.formatPreview(guild, draft);
            const buttonRows = reactionRoleEditor.buildRoleButtonRows(draft);

            const publishedMsg = await targetChannel.send({
              embeds: [finalEmbed],
              components: buttonRows
            });

            // Save all buttons in database
            for (const btn of draft.buttons) {
              featureManager.addReactionRole(guild.id, targetChannel.id, publishedMsg.id, `rr_${btn.roleId}`, btn.roleId);
            }

            return interaction.reply({
              embeds: [
                EmbedGenerator.success(
                  '🎉 Reaction Role Panel Published!',
                  `Your reaction role panel has been successfully sent to ${targetChannel} with **${draft.buttons.length}** role buttons!\n\n` +
                  `🔗 **[Jump to Panel Message](${publishedMsg.url})**\n` +
                  `📋 **Message ID:** \`${publishedMsg.id}\``
                )
              ],
              ephemeral: true
            });
          } catch (pubErr) {
            return interaction.reply({
              embeds: [EmbedGenerator.error('Publish Failed', `Could not send panel to ${targetChannel}: ${pubErr.message}`)],
              ephemeral: true
            });
          }
        }
      }

      // ─── Server Branding Modal Submissions ───────────────────
      if (customId.startsWith('branding_modal_')) {
        const isOwner = await isBotOwner(client, user.id);
        if (!isOwner) {
          return interaction.reply({
            embeds: [EmbedGenerator.error('Access Denied', '❌ The **Branding** system is strictly restricted to the **Bot Owner**.')],
            ephemeral: true
          });
        }

        // Immediately acknowledge modal to Discord so it never times out
        await interaction.deferUpdate().catch(() => null);

        if (customId === 'branding_modal_color') {
          const color = fields.getTextInputValue('branding_input_color').trim();
          brandingManager.setServerBranding(guild?.id, { embed_color: color });

          const updatedEmbed = brandingCommand.buildServerBrandingEmbed(guild);
          const updatedComponents = brandingCommand.buildServerBrandingComponents();
          return interaction.editReply({ embeds: [updatedEmbed], components: updatedComponents }).catch(() => null);
        }

        if (customId === 'branding_modal_description') {
          const desc = fields.getTextInputValue('branding_input_description').trim() || null;
          brandingManager.setServerBranding(guild?.id, { description_text: desc });

          const updatedEmbed = brandingCommand.buildServerBrandingEmbed(guild);
          const updatedComponents = brandingCommand.buildServerBrandingComponents();
          return interaction.editReply({ embeds: [updatedEmbed], components: updatedComponents }).catch(() => null);
        }

        if (customId === 'branding_modal_author') {
          const authorName = fields.getTextInputValue('branding_input_author_name').trim();
          const authorIcon = fields.getTextInputValue('branding_input_author_icon').trim() || null;
          brandingManager.setServerBranding(guild?.id, {
            author_name: authorName,
            author_icon: authorIcon
          });

          // Set bot nickname in this server only
          if (guild && authorName) {
            guild.members.me?.setNickname(authorName).catch(() => null);
          }

          const updatedEmbed = brandingCommand.buildServerBrandingEmbed(guild);
          const updatedComponents = brandingCommand.buildServerBrandingComponents();
          return interaction.editReply({ embeds: [updatedEmbed], components: updatedComponents }).catch(() => null);
        }

        if (customId === 'branding_modal_images') {
          const thumb = fields.getTextInputValue('branding_input_thumbnail').trim() || null;
          const banner = fields.getTextInputValue('branding_input_banner').trim() || null;
          brandingManager.setServerBranding(guild?.id, {
            thumbnail_url: thumb,
            banner_url: banner
          });

          const updatedEmbed = brandingCommand.buildServerBrandingEmbed(guild);
          const updatedComponents = brandingCommand.buildServerBrandingComponents();
          return interaction.editReply({ embeds: [updatedEmbed], components: updatedComponents }).catch(() => null);
        }

        if (customId === 'branding_modal_footer') {
          const footerText = fields.getTextInputValue('branding_input_footer_text').trim();
          const footerIcon = fields.getTextInputValue('branding_input_footer_icon').trim() || null;
          brandingManager.setServerBranding(guild?.id, {
            footer_text: footerText,
            footer_icon: footerIcon
          });

          const updatedEmbed = brandingCommand.buildServerBrandingEmbed(guild);
          const updatedComponents = brandingCommand.buildServerBrandingComponents();
          return interaction.editReply({ embeds: [updatedEmbed], components: updatedComponents }).catch(() => null);
        }
      }
    }
  }
};

