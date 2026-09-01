const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');
const guildManager = require('../../database/managers/GuildManager');
const brandingManager = require('../../database/managers/BrandingManager');
const EmbedGenerator = require('../../utils/embed');
const env = require('../../config/env');

const MODULE_DATA = {
  antinuke: {
    name: 'Antinuke',
    emoji: '🛡️',
    description: 'Fastest rolling rate-limit antinuke & raid protection system',
    commands: [
      { name: '/antinuke config', desc: 'View complete antinuke settings, limits, trust & floor status' },
      { name: '/antinuke enable', desc: 'Enable antinuke protection for the server' },
      { name: '/antinuke disable', desc: 'Disable antinuke protection (Server Owner only)' },
      { name: '/antinuke limit set', desc: 'Configure threshold and sliding time window for an action' },
      { name: '/antinuke limit view', desc: 'View current rolling limits and time windows' },
      { name: '/antinuke punish set', desc: 'Set punishment (Ban/Kick/Strip Roles/Quarantine)' },
      { name: '/antinuke whitelist add/remove/list', desc: 'Manage users exempt from limits' },
      { name: '/antinuke extraowner add/remove/list', desc: 'Delegate antinuke config rights to co-admins' },
      { name: '/antinuke floor-role setup/inspect', desc: 'Bulk-ban floor role defense hierarchy' },
      { name: '/antinuke log set', desc: 'Set real-time security alerts channel' }
    ]
  },
  antiraid: {
    name: 'Anti-Raid',
    emoji: '🔒',
    description: 'Score-based mass join raid defense, bot token suppression & auto-lockdown',
    commands: [
      { name: '/antiraid setup | ,antiraid setup', desc: 'Interactive Anti-Raid dashboard with presets and controls' },
      { name: '/antiraid config | ,antiraid config', desc: 'View live risk scores, sliding window metrics & active raid state' },
      { name: '/antiraid preset <high|standard|lenient>', desc: 'Apply security presets (High, Standard, Lenient)' },
      { name: '/antiraid punish <ban|kick|timeout>', desc: 'Configure automatic raider punishment action' },
      { name: '/antiraid score <limit>', desc: 'Set cumulative score limit threshold' },
      { name: '/antiraid lockdown | ,antiraid lockdown', desc: 'Emergency manual server lockdown of all public channels' },
      { name: '/antiraid unlock | ,antiraid unlock', desc: 'Lift lockdown and restore normal server chat permissions' },
      { name: '/antiraid enable | /antiraid disable', desc: 'Toggle Anti-Raid protection' }
    ]
  },
  automod: {
    name: 'AutoMod',
    emoji: '⚔️',
    description: 'Automated filters & Discord native AutoMod rules integration',
    commands: [
      { name: '/automod config', desc: 'View active automod filters, penalties & native rules' },
      { name: '/automod rule-create', desc: 'Create Discord native AutoMod rule (Keyword/Spam/Mention/Preset)' },
      { name: '/automod rule-list', desc: 'List all active native Discord AutoMod rules' },
      { name: '/automod rule-delete', desc: 'Delete a native Discord AutoMod rule' },
      { name: '/automod rule-sync', desc: 'Migrate & sync bot blacklisted words to Discord AutoMod' },
      { name: '/automod anti-spam', desc: 'Toggle rapid message burst filter' },
      { name: '/automod anti-links', desc: 'Toggle unauthorized links filter' },
      { name: '/automod anti-invites', desc: 'Toggle Discord server invite link filter' },
      { name: '/automod badwords', desc: 'Add, remove, list, or clear blacklisted words' },
      { name: '/automod action', desc: 'Set penalty (Warn/Timeout/Kick)' }
    ]
  },
  moderation: {
    name: 'Moderation',
    emoji: '🛠️',
    description: 'Comprehensive staff moderation toolkit with pre-execution safety',
    commands: [
      { name: '/ban', desc: 'Ban a member from the server' },
      { name: '/unban', desc: 'Unban a user by ID' },
      { name: '/kick', desc: 'Kick a member from the server' },
      { name: '/timeout', desc: 'Mute/Timeout a member (5s - 28d)' },
      { name: '/untimeout', desc: 'Remove timeout from a member' },
      { name: '/warn', desc: 'Issue a formal warning to a user' },
      { name: '/warnings', desc: 'View warning history of a user' },
      { name: '/clearwarn', desc: 'Clear user warnings or delete a single warning' },
      { name: '/purge', desc: 'Bulk delete messages (optionally by user)' },
      { name: '/lock', desc: 'Lock the current channel' },
      { name: '/unlock', desc: 'Unlock the current channel' },
      { name: '/slowmode', desc: 'Set channel slowmode rate limit' },
      { name: '/nuke', desc: 'Recreate and wipe current channel (Bot Owner only)' }
    ]
  },
  utility: {
    name: 'Utility',
    emoji: '🔧',
    description: 'Server utilities, polling, branding, and embed tools',
    commands: [
      { name: '/poll', desc: 'Create a reaction poll' },
      { name: '/embed', desc: 'Send a custom formatted embed' },
      { name: '/branding', desc: 'Change bot avatar, username, status, activity & presence (Bot Owner only)' }
    ]
  },
  permit: {
    name: 'Permit',
    emoji: '🔨',
    description: 'Antinuke trust permissions & delegation',
    commands: [
      { name: '/antinuke extraowner', desc: 'Delegate antinuke management rights' },
      { name: '/antinuke whitelist', desc: 'Exempt trusted moderators from limits' }
    ]
  },
  autoresponder: {
    name: 'Autoresponder',
    emoji: '🌟',
    description: 'Custom trigger-based automated text replies',
    commands: [
      { name: '/autoresponder add', desc: 'Create a custom keyword automated response' },
      { name: '/autoresponder remove', desc: 'Delete an automated response trigger' },
      { name: '/autoresponder list', desc: 'List all active autoresponders' }
    ]
  },
  logging: {
    name: 'Logging',
    emoji: '✔️',
    description: 'Multi-category server audit trail with 1-click auto setup (7 dedicated channels)',
    commands: [
      { name: '/logging setup | ,logging setup', desc: 'Interactive logging dashboard with category select menu' },
      { name: '/logging auto | ,logging auto setup', desc: 'Auto-create "𝐌𝐢𝐚 ⚚ LOGS" category & 7 specialized channels' },
      { name: '/logging enable | ,logging enable', desc: 'Turn on server logging module' },
      { name: '/logging disable | ,logging disable', desc: 'Turn off server logging module' },
      { name: '/logging config | ,logging config', desc: 'View which events are enabled and where they are logged' },
      { name: '/logging reset | ,logging reset', desc: 'Wipe all logging configuration and start fresh' },
      { name: '/logging channel <category> <#ch>', desc: 'Set a specific category channel manually' }
    ]
  },
  general: {
    name: 'General',
    emoji: '👻',
    description: 'General bot and server information commands',
    commands: [
      { name: '/serverinfo', desc: 'Comprehensive server overview and metrics' },
      { name: '/userinfo', desc: 'Detailed member profile, roles, and dates' },
      { name: '/botinfo', desc: 'Mia bot stats, uptime, memory, and specs' },
      { name: '/ping', desc: 'Websocket latency and API roundtrip' }
    ]
  },
  music: {
    name: 'Music',
    emoji: '🎵',
    description: 'High-quality voice channel audio playback',
    commands: [
      { name: '/play <song>', desc: 'Queue & play audio from search or YouTube' },
      { name: '/playnow <song>', desc: 'Immediately play audio (bypassing queue)' },
      { name: '/autoplay [on/off]', desc: 'Toggle auto-playing related songs (Default ON)' },
      { name: '/skip', desc: 'Skip currently playing track' },
      { name: '/stop', desc: 'Stop audio, clear queue, and leave VC' },
      { name: '/pause', desc: 'Pause audio playback' },
      { name: '/resume', desc: 'Resume audio playback' },
      { name: '/queue', desc: 'View current track queue' },
      { name: '/nowplaying', desc: 'Show currently playing track & controls' },
      { name: '/volume <0-200>', desc: 'Adjust playback volume' },
      { name: '/loop <mode>', desc: 'Repeat mode (off/track/queue)' }
    ]
  },
  voicemaster: {
    name: 'VoiceMaster',
    emoji: '🎙️',
    description: 'Dynamic Join-to-Create temporary voice channel system',
    commands: [
      { name: '/voicemaster setup | ,voicemaster', desc: 'Create Join-to-Create category & control panel' },
      { name: '/voicemaster buttons', desc: 'Customize which buttons appear on the control panel' }
    ]
  },
  welcomer: {
    name: 'Welcomer',
    emoji: '🚪',
    description: 'New member greetings & auto-role assignment',
    commands: [
      { name: '/welcomer channel', desc: 'Set greeting channel' },
      { name: '/welcomer message', desc: 'Customize welcome message template' },
      { name: '/welcomer autorole', desc: 'Configure auto-roles for humans & bots' },
      { name: '/welcomer toggle', desc: 'Enable/disable welcomer' },
      { name: '/welcomer test', desc: 'Preview welcome message' }
    ]
  },
  pfp: {
    name: 'Pfp',
    emoji: '👤',
    description: 'Avatar and banner viewing utilities',
    commands: [
      { name: '/avatar', desc: 'Display high resolution member avatar' },
      { name: '/banner', desc: 'Display user profile banner or server banner' }
    ]
  },
  reactionroles: {
    name: 'ReactionRoles',
    emoji: '🔥',
    description: 'Interactive button reaction role panels & visual builder',
    commands: [
      { name: '/reactionrole editor | ?rr', desc: 'Open interactive Reaction Role Embed & Button Editor' },
      { name: '/reactionrole panel', desc: 'Create and customize a reaction role panel embed' },
      { name: '/reactionrole add', desc: 'Attach a role button to an existing panel message' }
    ]
  }
};

function buildMainHelpEmbed(guild, client) {
  const settings = guild ? guildManager.getGuild(guild.id) : null;
  const branding = brandingManager.getServerBranding(guild?.id);
  const prefix = settings?.prefix || '?';
  const totalCommands = Object.values(MODULE_DATA).reduce((acc, mod) => acc + (mod.commands?.length || 0), 0);

  const moduleList = Object.values(MODULE_DATA)
    .map(mod => `${mod.emoji} » ${mod.name}`)
    .join('\n');

  const embed = new EmbedBuilder()
    .setColor(branding?.embed_color || 0xED4245)
    .setAuthor({
      name: (branding?.author_name && branding.author_name !== '𝐌𝐢𝐚 ⚚') ? `${branding.author_name} • Security & Multipurpose` : `${client.user.username} • Security & Multipurpose`,
      iconURL: branding?.author_icon || client.user.displayAvatarURL({ dynamic: true })
    })
    .setTitle('__**Main Menu**__')
    .setThumbnail(branding?.thumbnail_url || client.user.displayAvatarURL({ dynamic: true, size: 256 }))
    .setDescription(
      `• **My Prefix is \`${prefix}\`**\n` +
      `• **Total Commands:** \`${totalCommands}\`\n` +
      `• **Choose a Specific Module of your Desire**\n\n` +
      `>>> ${moduleList}\n\n` +
      `🗎 **Links**\n` +
      `[Invite Me](https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands)`
    )
    .setFooter({
      text: (branding?.footer_text && !branding.footer_text.toLowerCase().includes('Mia')) ? branding.footer_text : `${client.user.username} • Security & Operations`,
      iconURL: branding?.footer_icon || undefined
    })
    .setTimestamp();

  if (branding?.banner_url) {
    embed.setImage(branding.banner_url);
  }

  return embed;
}

function buildCategoryHelpEmbed(categoryKey, client, guild = null) {
  const mod = MODULE_DATA[categoryKey];
  if (!mod) return null;

  const branding = brandingManager.getServerBranding(guild?.id);
  const cmdLines = mod.commands.map(c => `• \`${c.name}\`\n  *${c.desc}*`).join('\n\n');

  const embed = new EmbedBuilder()
    .setColor(branding?.embed_color || 0xED4245)
    .setAuthor({
      name: `${mod.emoji} ${mod.name} Module Commands`,
      iconURL: branding?.author_icon || client.user.displayAvatarURL({ dynamic: true })
    })
    .setTitle(`${mod.emoji} ${mod.name} Module`)
    .setDescription(`**${mod.description}**\n\n${cmdLines}`)
    .setFooter({
      text: branding?.footer_text || 'Use /help or the dropdown below to navigate modules',
      iconURL: branding?.footer_icon || undefined
    })
    .setTimestamp();

  if (branding?.thumbnail_url) {
    embed.setThumbnail(branding.thumbnail_url);
  }

  return embed;
}

function buildSelectMenu(currentCategory = null) {
  const select = new StringSelectMenuBuilder()
    .setCustomId('help_category_select')
    .setPlaceholder('Choose a Specific Module...');

  for (const [key, data] of Object.entries(MODULE_DATA)) {
    select.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(data.name)
        .setValue(key)
        .setDescription(data.description.slice(0, 50))
        .setEmoji(data.emoji)
        .setDefault(key === currentCategory)
    );
  }

  return new ActionRowBuilder().addComponents(select);
}

function buildButtons(client, inSubmenu = false) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('Invite Me')
      .setStyle(ButtonStyle.Link)
      .setURL(`https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`)
  );

  if (inSubmenu) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('help_home_btn')
        .setLabel('Home')
        .setEmoji('🏠')
        .setStyle(ButtonStyle.Primary)
    );
  }

  return row;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('View the interactive commands and module guide')
    .addStringOption(opt =>
      opt.setName('module')
        .setDescription('Specific module to view')
        .setRequired(false)
        .addChoices(
          { name: 'Antinuke', value: 'antinuke' },
          { name: 'Anti-Raid', value: 'antiraid' },
          { name: 'AutoMod', value: 'automod' },
          { name: 'Moderation', value: 'moderation' },
          { name: 'Utility', value: 'utility' },
          { name: 'VoiceMaster', value: 'voicemaster' },
          { name: 'Music', value: 'music' },
          { name: 'Welcomer', value: 'welcomer' },
          { name: 'ReactionRoles', value: 'reactionroles' },
          { name: 'Logging', value: 'logging' },
          { name: 'General', value: 'general' }
        )
    ),

  MODULE_DATA,
  buildMainHelpEmbed,
  buildCategoryHelpEmbed,
  buildSelectMenu,
  buildButtons,

  async execute(interaction) {
    const { guild, client, options } = interaction;
    const requestedModule = options?.getString('module');

    if (requestedModule && MODULE_DATA[requestedModule]) {
      const embed = buildCategoryHelpEmbed(requestedModule, client);
      const selectMenu = buildSelectMenu(requestedModule);
      const buttons = buildButtons(client, true);
      return interaction.reply({ embeds: [embed], components: [selectMenu, buttons] });
    }

    const embed = buildMainHelpEmbed(guild, client);
    const selectMenu = buildSelectMenu();
    const buttons = buildButtons(client, false);

    return interaction.reply({ embeds: [embed], components: [selectMenu, buttons] });
  }
};
