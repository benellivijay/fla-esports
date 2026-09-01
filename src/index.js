// Configure bundled FFmpeg binary globally for audio transcoding
try {
  const ffmpegPath = require('ffmpeg-static');
  if (ffmpegPath) {
    process.env.FFMPEG_PATH = ffmpegPath;
  }
} catch (e) {}

const {
  Client,
  GatewayIntentBits,
  Partials,
  Collection
} = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const env = require('./config/env');
const Logger = require('./utils/logger');
require('./database/db'); // Initialize DB & Schema
require('./antimic/VoicePatch'); // C++ Native Decryption Patch

// Initialize Discord Client with all required Gateway Intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildWebhooks,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildIntegrations,
    GatewayIntentBits.GuildEmojisAndStickers
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.User,
    Partials.GuildMember
  ]
});

client.commands = new Collection();

// 1. Load Commands Recursively
function loadCommands(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory()) {
      loadCommands(fullPath);
    } else if (file.name.endsWith('.js')) {
      try {
        const command = require(fullPath);
        if ('data' in command && 'execute' in command) {
          client.commands.set(command.data.name, command);
          Logger.info(`Loaded command: /${command.data.name}`);
        }
      } catch (err) {
        Logger.error(`Failed to load command at ${fullPath}: ${err.message}`);
      }
    }
  }
}

// 2. Load Events Recursively
function loadEvents(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory()) {
      loadEvents(fullPath);
    } else if (file.name.endsWith('.js')) {
      try {
        const event = require(fullPath);
        if (event.name && typeof event.execute === 'function') {
          if (event.once) {
            client.once(event.name, (...args) => event.execute(...args, client));
          } else {
            client.on(event.name, (...args) => event.execute(...args, client));
          }
          Logger.info(`Registered event listener: ${event.name}`);
        }
      } catch (err) {
        Logger.error(`Failed to load event at ${fullPath}: ${err.message}`);
      }
    }
  }
}

// Start loading
loadCommands(path.join(__dirname, 'commands'));
loadEvents(path.join(__dirname, 'events'));

// Global Process Exception Handlers
process.on('unhandledRejection', error => {
  Logger.error('Unhandled Promise Rejection:', error);
});

process.on('uncaughtException', error => {
  Logger.error('Uncaught Exception:', error);
});

// Login Bot to Discord Gateway
(async () => {
  try {
    const sodium = require('libsodium-wrappers');
    if (sodium && sodium.ready) {
      await sodium.ready;
      Logger.info('WebAssembly cryptographic engine initialized.');
    }
  } catch (e) {}

  if (env.DISCORD_TOKEN) {
    client.login(env.DISCORD_TOKEN).catch(err => {
      Logger.error(`Discord login failed: ${err.message}`);
    });
  } else {
    Logger.warn('No DISCORD_TOKEN provided in environment. Please configure your .env file.');
  }
})();

module.exports = client;
