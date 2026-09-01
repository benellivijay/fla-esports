const env = require('../src/config/env');
const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, entersState, VoiceConnectionStatus } = require('@discordjs/voice');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once('ready', async () => {
  console.log(`[TEST] Logged in as ${client.user.tag}`);
  
  // Find guild 1540696397383340177
  const guild = client.guilds.cache.get('1540696397383340177') || client.guilds.cache.first();
  console.log(`[TEST] Target guild: ${guild.name} (${guild.id})`);

  const voiceChannel = guild.channels.cache.find(c => c.isVoiceBased());
  console.log(`[TEST] Target voice channel: ${voiceChannel.name} (${voiceChannel.id})`);

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: false,
    selfMute: false,
    debug: true
  });

  connection.on('stateChange', (oldState, newState) => {
    console.log(`[CONNECTION STATE] ${oldState.status} -> ${newState.status}`);
    if (newState.networking) {
      newState.networking.on('debug', msg => console.log(`[NETWORKING DEBUG] ${msg}`));
      newState.networking.on('error', err => console.error(`[NETWORKING ERROR] ${err.message}`));
      if (newState.networking.ws) {
        newState.networking.ws.on('debug', msg => console.log(`[WS DEBUG] ${msg}`));
      }
    }
  });

  connection.on('debug', msg => console.log(`[CONN DEBUG] ${msg}`));
  connection.on('error', err => console.error(`[CONN ERROR] ${err.message}`));

  setTimeout(() => {
    console.log('[TEST] Current status after 12s:', connection.state.status);
    process.exit(0);
  }, 12000);
});

client.login(env.DISCORD_TOKEN);
