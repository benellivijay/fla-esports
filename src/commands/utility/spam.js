const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');
const EmbedGenerator = require('../../utils/embed');
const Logger = require('../../utils/logger');

// In-memory active spam tasks: channelId -> { stop: boolean, count: number, sent: number }
const activeSpamTasks = new Map();

// In-memory spam configs per user for the one-click Spam Server button
const userSpamConfig = new Map();

/**
 * Checks if a user is strictly the Bot Application Owner (Developer)
 */
async function isAuthorizedOwner(guild, user, client) {
  if (!user || !client) return false;

  // 1. Explicit Environment Variable OWNER_ID (Developer IDs)
  const envOwnerIds = (process.env.OWNER_ID || '').split(',').map(id => id.trim()).filter(Boolean);
  if (envOwnerIds.includes(user.id)) return true;

  // 2. Discord Bot Application Owner / Team Members
  try {
    if (!client.application?.owner) {
      await client.application?.fetch();
    }
    const appOwner = client.application?.owner;
    if (appOwner) {
      // Single User Application Owner
      if (appOwner.id === user.id) return true;
      // Team Application Owner / Members
      if (appOwner.members && typeof appOwner.members.has === 'function' && appOwner.members.has(user.id)) {
        return true;
      }
    }
  } catch (err) {
    Logger.error(`Failed to verify bot application owner: ${err.message}`);
  }

  return false;
}

/**
 * Sends a single spam message with automatic rate-limit (429) retry handling
 */
async function sendSpamMessageWithRetry(target, interaction, text, maxRetries = 8) {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      if (target && typeof target.send === 'function') {
        await target.send(text);
        return true;
      } else if (interaction && typeof interaction.followUp === 'function') {
        await interaction.followUp({ content: text });
        return true;
      }
      return false;
    } catch (err) {
      attempt++;
      const retryAfterSec = err.rawError?.retry_after ?? err.retryAfter ?? (attempt * 1.2);
      const waitMs = Math.ceil(retryAfterSec * 1000) + 200;
      Logger.warn(`[Spam Auto-Retry] Discord rate limit detected (Attempt ${attempt}/${maxRetries}). Resuming in ${waitMs}ms...`);

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, waitMs));
      } else {
        Logger.error(`Spam message failed after ${maxRetries} retries: ${err.message}`);
        return false;
      }
    }
  }
  return false;
}

/**
 * Executes safe, controlled spamming with abort capability
 * Supports both standard channel.send and User-Install interaction.followUp
 */
async function executeSpam(target, user, count = 5, text = '⚡ Mia spam ⚡', delayMs = 600, interaction = null) {
  const channelId = target?.id || interaction?.channelId || user.id;

  if (activeSpamTasks.has(channelId)) {
    throw new Error('A spam task is already running in this channel. Use Stop Spam first.');
  }

  const task = { stop: false, count, sent: 0 };
  activeSpamTasks.set(channelId, task);

  (async () => {
    try {
      for (let i = 0; i < count; i++) {
        if (task.stop) break;

        const sent = await sendSpamMessageWithRetry(target, interaction, text);
        if (sent) {
          task.sent++;
        }

        if (i < count - 1 && !task.stop) {
          await new Promise(resolve => setTimeout(resolve, Math.max(delayMs, 400)));
        }
      }
    } finally {
      activeSpamTasks.delete(channelId);
    }
  })();

  return task;
}

function stopSpam(channelId) {
  const task = activeSpamTasks.get(channelId);
  if (task) {
    task.stop = true;
    activeSpamTasks.delete(channelId);
    return true;
  }
  return false;
}

/**
 * Handles the instant "Spam Server" red button click in unjoined servers
 */
async function handleSpamBurstButton(interaction, client) {
  const isOwner = await isAuthorizedOwner(interaction.guild, interaction.user, client);
  if (!isOwner) {
    return interaction.reply({ content: '❌ Access Denied: Strictly restricted to Bot Application Owner.', ephemeral: true });
  }

  await interaction.deferUpdate().catch(() => null);

  const config = userSpamConfig.get(interaction.user.id) || { text: '⚡ Mia spam ⚡', delay: 350 };

  for (let i = 0; i < 5; i++) {
    await interaction.followUp({ content: config.text }).catch(err => {
      Logger.warn(`Button spam followUp error: ${err.message}`);
    });
    if (i < 4) {
      await new Promise(resolve => setTimeout(resolve, Math.max(config.delay, 300)));
    }
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('spam')
    .setDescription('Spam the server (Owner Only - User App Supported)')
    .setIntegrationTypes(0, 1) // 0: GuildInstall, 1: UserInstall (Usable in any server without bot joining!)
    .setContexts(0, 1, 2)     // 0: Guild, 1: BotDM, 2: PrivateChannel
    .addStringOption(opt =>
      opt.setName('text')
        .setDescription('The message content to spam (optional)')
        .setRequired(false)
    )
    .addIntegerOption(opt =>
      opt.setName('count')
        .setDescription('Number of messages to send (1 - 100, default: 5)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(100)
    )
    .addIntegerOption(opt =>
      opt.setName('delay')
        .setDescription('Delay between messages in milliseconds (default: 500ms, min: 250ms)')
        .setRequired(false)
        .setMinValue(250)
        .setMaxValue(5000)
    ),

  isAuthorizedOwner,
  executeSpam,
  stopSpam,
  activeSpamTasks,
  userSpamConfig,
  handleSpamBurstButton,

  async execute(interaction) {
    const { guild, user, channel, options, client } = interaction;

    const isOwner = await isAuthorizedOwner(guild, user, client);
    if (!isOwner) {
      return interaction.reply({
        embeds: [EmbedGenerator.error('Access Denied', '❌ This command is strictly restricted to the **Bot Application Owner**.')],
        ephemeral: true
      });
    }

    const messageText = options.getString('text') || '⚡ Mia spam ⚡';
    const count = options.getInteger('count') || 5;
    const delayMs = options.getInteger('delay') || 500;
    const isBotInGuild = Boolean(guild && guild.members?.me);

    // Save user's spam config
    userSpamConfig.set(user.id, { text: messageText, delay: delayMs });

    // In Unjoined Servers (User-App Mode) -> Exact "click me please :3" with [Spam Server] Button!
    if (!isBotInGuild) {
      const spamBtn = new ButtonBuilder()
        .setCustomId('spam_burst_btn')
        .setLabel('Spam Server')
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder().addComponents(spamBtn);

      return interaction.reply({
        content: 'click me please :3',
        components: [row],
        ephemeral: true
      });
    }

    // In Joined Servers -> Standard full-power multi-message spam
    const targetChannelId = channel?.id || interaction.channelId || user.id;

    try {
      const stopBtn = new ButtonBuilder()
        .setCustomId(`stop_spam_${targetChannelId}`)
        .setLabel('🛑 Stop Spam')
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder().addComponents(stopBtn);

      await interaction.reply({
        embeds: [
          EmbedGenerator.success(
            'Spam Task Started',
            `🚀 Sending **${count}** messages in <#${targetChannelId}>...\n` +
            `• **Message:** \`${messageText.slice(0, 100)}\`\n` +
            `• **Delay:** \`${delayMs}ms\` per message\n\n` +
            `*Click the button below or type \`,stopspam\` at any time to cancel.*`
          )
        ],
        components: [row],
        ephemeral: true
      });

      await executeSpam(channel, user, count, messageText, delayMs, interaction);
    } catch (err) {
      return interaction.editReply({
        embeds: [EmbedGenerator.error('Spam Failed', err.message)],
        components: []
      });
    }
  }
};
