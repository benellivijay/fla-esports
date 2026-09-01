const {
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  VoiceConnectionStatus,
  StreamType
} = require('@discordjs/voice');
const play = require('play-dl');
const ytdl = require('@distube/ytdl-core');
let youtubedl = null;
try {
  youtubedl = require('yt-dlp-exec');
} catch (e) {}
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, Routes } = require('discord.js');
const prism = require('prism-media');
const GeniusAutoplayEngine = require('./GeniusAutoplayEngine');
const MicGuardEngine = require('../antimic/MicGuardEngine');
const Logger = require('../utils/logger');
const EmbedGenerator = require('../utils/embed');

const https = require('https');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { spawn } = require('child_process');

let isBinaryChecked = false;
async function ensureBinaries() {
  if (isBinaryChecked) return;
  isBinaryChecked = true;

  if (process.platform === 'linux') {
    // 1. Ensure Linux yt-dlp binary
    const ytdlpDir = path.join(process.cwd(), 'node_modules', 'yt-dlp-exec', 'bin');
    const ytdlpTarget = path.join(ytdlpDir, 'yt-dlp');
    
    // Force re-download if it's the Python zipapp (small file)
    if (fs.existsSync(ytdlpTarget)) {
      const stats = fs.statSync(ytdlpTarget);
      if (stats.size < 10000000) { // Less than 10MB means it's the zipapp, not the standalone
        fs.unlinkSync(ytdlpTarget);
      }
    }

    if (!fs.existsSync(ytdlpTarget)) {
      Logger.info('[MUSIC ENGINE] Downloading Linux yt-dlp binary...');
      try {
        if (!fs.existsSync(ytdlpDir)) fs.mkdirSync(ytdlpDir, { recursive: true });
        const file = fs.createWriteStream(ytdlpTarget);
        function fetchBin(url) {
          https.get(url, res => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
              return fetchBin(res.headers.location);
            }
            res.pipe(file);
            file.on('finish', () => {
              file.close();
              try { fs.chmodSync(ytdlpTarget, 0o755); } catch(e) {}
              Logger.info('[MUSIC ENGINE] ✅ Linux yt-dlp binary ready!');
            });
          }).on('error', () => {});
        }
        fetchBin('https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux');
      } catch (err) {}
    } else {
      try { fs.chmodSync(ytdlpTarget, 0o755); } catch(e) {}
    }

    // 2. Ensure Linux ffmpeg binary
    const ffmpegDir = path.join(process.cwd(), 'node_modules', 'ffmpeg-static');
    const ffmpegTarget = path.join(ffmpegDir, 'ffmpeg');
    if (!fs.existsSync(ffmpegTarget)) {
      Logger.info('[MUSIC ENGINE] Downloading Linux ffmpeg binary...');
      try {
        if (!fs.existsSync(ffmpegDir)) fs.mkdirSync(ffmpegDir, { recursive: true });
        const dest = fs.createWriteStream(ffmpegTarget);
        function fetchFfmpeg(url) {
          https.get(url, res => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
              return fetchFfmpeg(res.headers.location);
            }
            const gunzip = zlib.createGunzip();
            res.pipe(gunzip).pipe(dest);
            dest.on('finish', () => {
              dest.close();
              try { fs.chmodSync(ffmpegTarget, 0o755); } catch(e) {}
              Logger.info('[MUSIC ENGINE] ✅ Linux ffmpeg binary ready!');
            });
          }).on('error', () => {});
        }
        fetchFfmpeg('https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1/ffmpeg-linux-x64.gz');
      } catch (err) {}
    } else {
      try { fs.chmodSync(ffmpegTarget, 0o755); } catch(e) {}
    }
  }
}
ensureBinaries();

function getFfmpegPath() {
  if (process.platform === 'linux') {
    const linuxStatic = path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg');
    if (fs.existsSync(linuxStatic)) return linuxStatic;
  }
  try {
    const staticPath = require('ffmpeg-static');
    if (staticPath && fs.existsSync(staticPath)) return staticPath;
  } catch (e) {}
  return 'ffmpeg';
}

let isSoundcloudReady = false;
async function ensureSoundCloudToken() {
  if (isSoundcloudReady) return;
  try {
    const clientId = await play.getFreeClientID();
    await play.setToken({ soundcloud: { client_id: clientId } });
    isSoundcloudReady = true;
  } catch (e) {}
}

function applyAudioEffects(rawStream, title) {
  const lower = (title || '').toLowerCase();
  let filter = '';

  if (lower.includes('slowed') && lower.includes('reverb')) {
    filter = 'atempo=0.86,asetrate=48000*0.92,aecho=0.8:0.88:60:0.4';
  } else if (lower.includes('slowed')) {
    filter = 'atempo=0.85,asetrate=48000*0.92';
  } else if (lower.includes('sped up') || lower.includes('speed up') || lower.includes('nightcore')) {
    filter = 'atempo=1.06,asetrate=48000*1.24';
  } else if (lower.includes('reverb')) {
    filter = 'aecho=0.8:0.88:60:0.4';
  } else if (lower.includes('bass boost') || lower.includes('bassboost')) {
    filter = 'bass=g=10:f=110:w=0.6';
  }

  const ffmpegBin = getFfmpegPath();
  const ffmpegArgs = [
    '-analyzeduration', '0',
    '-loglevel', '0',
    '-i', 'pipe:0',
    ...(filter ? ['-af', filter] : []),
    '-f', 's16le',
    '-ar', '48000',
    '-ac', '2',
    'pipe:1'
  ];

  const ffmpegProcess = spawn(ffmpegBin, ffmpegArgs);
  rawStream.pipe(ffmpegProcess.stdin);

  ffmpegProcess.stdin.on('error', () => null);
  ffmpegProcess.stderr.on('data', d => Logger.error(`[FFmpeg STDERR] ` + d.toString()));
  ffmpegProcess.on('error', (err) => Logger.warn(`FFmpeg process error: ${err.message}`));

  return {
    stream: ffmpegProcess.stdout,
    process: ffmpegProcess,
    type: StreamType.Raw
  };
}

class GuildQueue {
  constructor(voiceConnection, textChannel) {
    this.voiceConnection = voiceConnection;
    this.textChannel = textChannel;
    this.audioPlayer = createAudioPlayer();
    this.queue = [];
    this.previousTracks = [];
    this.currentTrack = null;
    this.currentProcess = null;
    this.volume = 100;
    this.loop = false; // false | 'track' | 'queue'
    this.autoplay = true; // Default ON
    this.isPlaying = false;
    this.nowPlayingMessage = null;

    // Genius Autoplay Engine State
    this.playedHistory = new Set();
    this.playedTitles = [];
    this.prefetchedTrack = null;
    this.isPrefetching = false;

    this.voiceConnection.subscribe(this.audioPlayer);
    this.setupListeners();

    // Attach real-time louder mic & earrape protection
    if (this.textChannel?.guild) {
      MicGuardEngine.attach(this.voiceConnection, this.textChannel.guild, this.textChannel);
    }
  }

  setupListeners() {
    this.voiceConnection.on('debug', message => {
      Logger.info(`[VOICE_DEBUG] ${message}`);
    });

    this.voiceConnection.on('error', error => {
      Logger.error(`[VOICE_ERROR] ${error.message}`);
    });

    this.audioPlayer.on(AudioPlayerStatus.Playing, () => {
      Logger.info(`AudioPlayer is now PLAYING track: ${this.currentTrack?.title}`);
      // Pre-fetch the next genius track in the background for zero-latency playback!
      this.prepareNextAutoplayTrack();
    });

    this.audioPlayer.on(AudioPlayerStatus.Buffering, () => {
      Logger.info(`AudioPlayer is buffering track: ${this.currentTrack?.title}`);
    });

    this.audioPlayer.on(AudioPlayerStatus.Idle, async () => {
      Logger.info(`AudioPlayer became Idle.`);
      this.cleanupCurrentProcess();

      if (this.loop === 'track' && this.currentTrack) {
        await this.playTrack(this.currentTrack);
      } else if (this.loop === 'queue' && this.currentTrack) {
        this.queue.push(this.currentTrack);
        await this.processQueue();
      } else if (this.queue.length > 0) {
        await this.processQueue();
      } else if (this.autoplay && this.currentTrack) {
        await this.handleAutoplayNext();
      } else {
        this.isPlaying = false;
        this.currentTrack = null;
      }
    });

    this.audioPlayer.on('error', error => {
      Logger.error(`Audio Player Error: ${error.message}`);
      this.cleanupCurrentProcess();
      this.processQueue();
    });

    this.voiceConnection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(this.voiceConnection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(this.voiceConnection, VoiceConnectionStatus.Connecting, 5_000)
        ]);
      } catch {
        this.destroy();
      }
    });

    this.voiceConnection.on('stateChange', (oldState, newState) => {
      Logger.info(`Voice connection state changed: ${oldState.status} -> ${newState.status}`);
    });
  }

  /**
   * Pre-fetches the next genius track in the background while the current song is playing
   */
  async prepareNextAutoplayTrack() {
    if (!this.autoplay || this.queue.length > 0 || this.isPrefetching || !this.currentTrack) {
      return;
    }

    this.isPrefetching = true;
    try {
      Logger.info(`[GeniusAutoplay] Background pre-fetching next song for "${this.currentTrack.title}"...`);
      const nextTrack = await GeniusAutoplayEngine.getNextTrack(
        this.currentTrack,
        this.playedHistory,
        this.playedTitles
      );
      if (nextTrack) {
        this.prefetchedTrack = nextTrack;
        Logger.info(`[GeniusAutoplay] Pre-fetch ready: "${nextTrack.title}"`);
      }
    } catch (err) {
      Logger.warn(`[GeniusAutoplay] Pre-fetch failed: ${err.message}`);
    } finally {
      this.isPrefetching = false;
    }
  }

  /**
   * Seamlessly transitions to the next autoplay song
   */
  async handleAutoplayNext() {
    try {
      let nextTrack = this.prefetchedTrack;
      this.prefetchedTrack = null;

      if (!nextTrack && this.currentTrack) {
        Logger.info(`[GeniusAutoplay] Resolving on-demand recommendation for "${this.currentTrack.title}"...`);
        nextTrack = await GeniusAutoplayEngine.getNextTrack(
          this.currentTrack,
          this.playedHistory,
          this.playedTitles
        );
      }

      if (nextTrack) {
        Logger.info(`[GeniusAutoplay] Starting next track: "${nextTrack.title}"`);
        await this.playTrack(nextTrack);
        return;
      }
    } catch (e) {
      Logger.warn(`[GeniusAutoplay] Autoplay error: ${e.message}`);
    }

    this.isPlaying = false;
    this.currentTrack = null;
  }

  cleanupCurrentProcess() {
    if (this.currentProcess) {
      try {
        this.currentProcess.kill('SIGKILL');
      } catch {}
      this.currentProcess = null;
    }
    if (this.currentFfmpeg) {
      try {
        this.currentFfmpeg.kill('SIGKILL');
      } catch {}
      this.currentFfmpeg = null;
    }
  }

  async enqueue(track) {
    this.queue.push(track);
    // User added a track, clear prefetched autoplay
    this.prefetchedTrack = null;
    if (!this.isPlaying && this.audioPlayer.state.status === AudioPlayerStatus.Idle) {
      await this.processQueue();
    }
  }

  async playNow(track) {
    if (this.currentTrack) {
      this.previousTracks.push(this.currentTrack);
      if (this.previousTracks.length > 10) this.previousTracks.shift();
    }
    this.cleanupCurrentProcess();
    this.prefetchedTrack = null;
    await this.playTrack(track);
  }

  async updateVoiceChannelStatus(statusText) {
    try {
      const channelId = this.voiceConnection?.joinConfig?.channelId;
      const client = this.textChannel?.client;
      if (!channelId || !client) return;

      const status = statusText ? String(statusText).slice(0, 480) : '';
      await client.rest.put(Routes.channelVoiceStatus(channelId), {
        body: { status }
      }).catch(() => null);
    } catch {}
  }

  async processQueue() {
    if (this.queue.length === 0) {
      this.isPlaying = false;
      this.currentTrack = null;
      await this.updateVoiceChannelStatus('');
      return;
    }

    if (this.currentTrack) {
      this.previousTracks.push(this.currentTrack);
      if (this.previousTracks.length > 10) this.previousTracks.shift();
    }

    const nextTrack = this.queue.shift();
    await this.playTrack(nextTrack);
  }

  buildControllerComponents(isPaused = false) {
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('music_pause_resume_btn')
        .setLabel(isPaused ? 'Resume' : 'Pause')
        .setStyle(isPaused ? ButtonStyle.Success : ButtonStyle.Primary)
        .setEmoji(isPaused ? '▶️' : '⏸️'),
      new ButtonBuilder()
        .setCustomId('music_skip_btn')
        .setLabel('Skip')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('⏭️'),
      new ButtonBuilder()
        .setCustomId('music_prev_btn')
        .setLabel('Previous')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⏮️')
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('music_queue_btn')
        .setLabel(`Queue (${this.queue.length})`)
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('➕'),
      new ButtonBuilder()
        .setCustomId('music_loop_btn')
        .setLabel(this.loop ? (this.loop === 'track' ? 'Loop: Track' : 'Loop: Queue') : 'Loop')
        .setStyle(this.loop ? ButtonStyle.Success : ButtonStyle.Secondary)
        .setEmoji('🔁'),
      new ButtonBuilder()
        .setCustomId('music_autoplay_btn')
        .setLabel(this.autoplay ? 'Autoplay: ON' : 'Autoplay: OFF')
        .setStyle(this.autoplay ? ButtonStyle.Success : ButtonStyle.Secondary)
        .setEmoji('📻')
    );

    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('music_stop_btn')
        .setLabel('End Session')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('⏹️')
    );

    return [row1, row2, row3];
  }

  buildNowPlayingEmbed(track) {
    const embed = EmbedGenerator.base()
      .setAuthor({ name: track.isAutoplay ? '📻 Genius Autoplay' : 'Now Playing' })
      .setTitle(`🎵 ${track.title}`)
      .setURL(track.url);

    let desc = `👤 **${track.author || 'Unknown Artist'}** ⏱️ **${track.duration || 'Live'}**\n` +
      `⚙️ **Lossless Quality** 🎤 **320kbps** 🔥 **Trending**\n\n`;

    if (track.isAutoplay && track.recommendedFrom) {
      desc += `✨ *Recommended based on:* **${track.recommendedFrom.slice(0, 40)}**\n`;
    } else {
      desc += `*Requested by ${track.requester?.tag || track.requester?.username || track.requester || 'User'}*`;
    }

    embed.setDescription(desc);

    if (track.thumbnail) {
      embed.setThumbnail(track.thumbnail);
    }

    return embed;
  }

  async playTrack(track) {
    try {
      this.cleanupCurrentProcess();
      this.currentTrack = track;
      this.isPlaying = true;

      // Track in history to prevent repeats
      if (track.url) this.playedHistory.add(track.url);
      if (track.title) {
        this.playedTitles.push(track.title);
        if (this.playedTitles.length > 50) this.playedTitles.shift();
      }

      // Wait for voice connection to be ready if connecting
      if (this.voiceConnection.state.status !== VoiceConnectionStatus.Ready) {
        try {
          await entersState(this.voiceConnection, VoiceConnectionStatus.Ready, 20_000);
        } catch (err) {
          Logger.warn(`Voice connection ready timeout: ${err.message}`);
        }
      }

      Logger.info(`Starting audio playback stream for: ${track.title} (${track.url})`);

      await ensureSoundCloudToken();
      let resource = null;

      // 1. Primary: Direct Pre-Resolved Stream (SoundCloud / Direct Stream)
      if (track.streamUrl && track.streamUrl.includes('soundcloud.com')) {
        try {
          const stream = await play.stream(track.streamUrl);
          const fx = applyAudioEffects(stream.stream, track.title);
          this.currentFfmpeg = fx.process;
          resource = createAudioResource(fx.stream, {
            inputType: StreamType.Raw,
            inlineVolume: true
          });
          Logger.info(`[MUSIC ENGINE] Streaming pre-resolved exact audio: "${track.title}" (${track.streamUrl})`);
        } catch (e) {
          Logger.warn(`Pre-resolved stream failed: ${e.message}`);
        }
      }

      // 2. Secondary: SoundCloud Clean Title Progressive Search
      if (!resource) {
        const rawTitle = track.userQuery || track.title || '';
        const noiseRegex = /(official\s*(music\s*)?video|lyric\s*video|lyrical\s*video|audio|full\s*song|video\s*song|visualizer|hd|4k|tamil tunes|gana rockers media|gana balamurugan media|drugs aw)/gi;
        const words = rawTitle
          .replace(/\[.*?\]|\(.*?\)/g, '')
          .replace(/\|.*$/g, '')
          .replace(noiseRegex, '')
          .replace(/[^a-zA-Z0-9\s]/g, ' ')
          .split(/\s+/)
          .filter(w => w.length > 1);

        const segments = rawTitle.split(/[-|:]/)
          .map(s => s.replace(/\[.*?\]|\(.*?\)/g, '').replace(noiseRegex, '').trim())
          .filter(s => s.length > 2);

        const searchQueries = [
          track.userQuery || null,
          words.join(' '),
          segments[0] || null,
          segments[1] || null,
          words.slice(0, 2).join(' '),
          words.slice(-2).join(' '),
          words.slice(1, 3).join(' ')
        ].filter(Boolean);

        const uniqueQueries = [...new Set(searchQueries)];

        for (const query of uniqueQueries) {
          if (resource) break;
          try {
            if (query.includes('soundcloud.com')) {
              const stream = await play.stream(query);
              const fx = applyAudioEffects(stream.stream, track.title);
              this.currentFfmpeg = fx.process;
              resource = createAudioResource(fx.stream, {
                inputType: StreamType.Raw,
                inlineVolume: true
              });
              break;
            }

            const scResults = await play.search(query, { source: { soundcloud: 'tracks' }, limit: 5 });
            if (scResults && scResults.length > 0) {
              for (const candidate of scResults) {
                try {
                  const targetUrl = candidate.permalink || candidate.url;
                  const stream = await play.stream(targetUrl);
                  const fx = applyAudioEffects(stream.stream, track.title);
                  this.currentFfmpeg = fx.process;
                  resource = createAudioResource(fx.stream, {
                    inputType: StreamType.Raw,
                    inlineVolume: true
                  });
                  if (resource) {
                    Logger.info(`[MUSIC ENGINE] Streaming SoundCloud candidate: "${candidate.name}" (${targetUrl})`);
                    track.streamUrl = targetUrl;
                    break;
                  }
                } catch (candidateErr) {
                  Logger.warn(`Candidate "${candidate.name}" failed: ${candidateErr.message}`);
                }
              }
            }
          } catch (queryErr) {
            Logger.warn(`SoundCloud query "${query}" failed: ${queryErr.message}`);
          }
        }
      }

      // 3. Fallback: play-dl direct URL
      if (!resource) {
        try {
          const stream = await play.stream(track.url);
          const fx = applyAudioEffects(stream.stream, track.title);
          this.currentFfmpeg = fx.process;
          resource = createAudioResource(fx.stream, {
            inputType: StreamType.Raw,
            inlineVolume: true
          });
        } catch (e) {}
      }

      // 4. Fallback: @distube/ytdl-core
      if (!resource) {
        try {
          const stream = ytdl(track.url, {
            filter: 'audioonly',
            quality: 'highestaudio',
            highWaterMark: 1 << 25
          });
          const fx = applyAudioEffects(stream, track.title);
          this.currentFfmpeg = fx.process;
          resource = createAudioResource(fx.stream, {
            inputType: StreamType.Raw,
            inlineVolume: true
          });
        } catch (e) {}
      }

      if (!resource) {
        throw new Error(`Could not locate a playable stream for "${track.title}" on this server.`);
      }

      if (resource.volume) {
        resource.volume.setVolume(this.volume / 100);
      }

      this.audioPlayer.play(resource);

      // Update Discord Voice Channel Status!
      const statusTitle = `🎶 ${track.title}`.slice(0, 100);
      this.updateVoiceChannelStatus(statusTitle);

      if (this.textChannel) {
        const embed = this.buildNowPlayingEmbed(track);
        const components = this.buildControllerComponents(false);

        this.nowPlayingMessage = await this.textChannel.send({
          embeds: [embed],
          components
        }).catch(() => null);
      }
    } catch (err) {
      Logger.error(`Error playing track: ${err.message}`);
      this.cleanupCurrentProcess();
      if (this.textChannel) {
        this.textChannel.send({
          embeds: [EmbedGenerator.warn('Track Skipped', `Could not play **${track?.title || 'Unknown'}** (No unblocked stream found on server).`)]
        }).catch(() => null);
      }
      setTimeout(() => this.processQueue(), 1500);
    }
  }

  skip() {
    this.cleanupCurrentProcess();
    this.audioPlayer.stop();
  }

  previous() {
    if (this.previousTracks.length > 0) {
      const prev = this.previousTracks.pop();
      if (this.currentTrack) {
        this.queue.unshift(this.currentTrack);
      }
      this.prefetchedTrack = null;
      this.playTrack(prev);
      return true;
    }
    return false;
  }

  stop() {
    this.cleanupCurrentProcess();
    this.queue = [];
    this.previousTracks = [];
    this.currentTrack = null;
    this.prefetchedTrack = null;
    this.updateVoiceChannelStatus('');
    this.audioPlayer.stop();
    if (this.nowPlayingMessage) {
      this.nowPlayingMessage.edit({
        embeds: [EmbedGenerator.base().setTitle('⏹️ Music Session Ended').setDescription('Playback stopped and voice session ended.')],
        components: []
      }).catch(() => null);
    }
  }

  pause() {
    const paused = this.audioPlayer.pause();
    if (paused && this.nowPlayingMessage && this.currentTrack) {
      const components = this.buildControllerComponents(true);
      this.nowPlayingMessage.edit({ components }).catch(() => null);
    }
    return paused;
  }

  resume() {
    const resumed = this.audioPlayer.unpause();
    if (resumed && this.nowPlayingMessage && this.currentTrack) {
      const components = this.buildControllerComponents(false);
      this.nowPlayingMessage.edit({ components }).catch(() => null);
    }
    return resumed;
  }

  toggleLoop() {
    if (!this.loop) this.loop = 'track';
    else if (this.loop === 'track') this.loop = 'queue';
    else this.loop = false;

    if (this.nowPlayingMessage && this.currentTrack) {
      const isPaused = this.audioPlayer.state.status === AudioPlayerStatus.Paused;
      const components = this.buildControllerComponents(isPaused);
      this.nowPlayingMessage.edit({ components }).catch(() => null);
    }
    return this.loop;
  }

  toggleAutoplay(explicitState = null) {
    if (explicitState !== null) {
      this.autoplay = Boolean(explicitState);
    } else {
      this.autoplay = !this.autoplay;
    }

    if (this.autoplay) {
      this.prepareNextAutoplayTrack();
    } else {
      this.prefetchedTrack = null;
    }

    if (this.nowPlayingMessage && this.currentTrack) {
      const isPaused = this.audioPlayer.state.status === AudioPlayerStatus.Paused;
      const components = this.buildControllerComponents(isPaused);
      this.nowPlayingMessage.edit({ components }).catch(() => null);
    }
    return this.autoplay;
  }

  destroy() {
    this.stop();
    try {
      this.voiceConnection.destroy();
    } catch {}
  }
}

module.exports = GuildQueue;
