const env = require('../src/config/env');
const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, entersState, VoiceConnectionStatus, createAudioPlayer, createAudioResource } = require('@discordjs/voice');
const Logger = require('../src/utils/logger');

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
  
  const guild = client.guilds.cache.first();
  if (!guild) {
    console.error('[TEST] No guild found!');
    process.exit(1);
  }

  console.log(`[TEST] Found guild: ${guild.name} (${guild.id})`);
  const voiceChannel = guild.channels.cache.find(c => c.isVoiceBased());
  if (!voiceChannel) {
    console.error('[TEST] No voice channel found!');
    process.exit(1);
  }

  console.log(`[TEST] Found voice channel: ${voiceChannel.name} (${voiceChannel.id})`);

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: false,
    selfMute: false
  });

  connection.on('stateChange', (oldState, newState) => {
    console.log(`[TEST STATE] ${oldState.status} -> ${newState.status}`);
  });

  connection.on('debug', message => {
    console.log(`[TEST DEBUG] ${message}`);
  });

  connection.on('error', error => {
    console.error(`[TEST ERROR]`, error);
  });

  try {
    console.log('[TEST] Waiting 15s for Ready state...');
    await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
    console.log('🎉 [TEST SUCCESS] Connection reached READY state!');
  } catch (e) {
    console.error('❌ [TEST FAILED] Connection failed to reach ready state:', e.message);
  }

  process.exit(0);
});

client.login(env.DISCORD_TOKEN);
