const { joinVoiceChannel, getVoiceConnection, VoiceConnectionStatus } = require('@discordjs/voice');
const yts = require('yt-search');
const play = require('play-dl');
const https = require('https');
const GuildQueue = require('./GuildQueue');
const Logger = require('../../src/utils/logger');

// Initialize SoundCloud client ID for flawless streaming
(async () => {
  try {
    const clientId = await play.getFreeClientID();
    await play.setToken({ soundcloud: { client_id: clientId } });
    Logger.info('[MUSIC ENGINE] ✅ SoundCloud client token initialized.');
  } catch (e) {}
})();

function fetchJson(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

function fetchText(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', () => resolve(null));
  });
}

class MusicManager {
  constructor() {
    this.queues = new Map(); // guildId -> GuildQueue
  }

  getQueue(guildId) {
    if (!guildId) return null;
    return this.queues.get(guildId);
  }

  async resolveSoundCloudStream(query) {
    if (!query) return null;
    const noiseRegex = /(official\s*(music\s*)?video|lyric\s*video|lyrical\s*video|audio|full\s*song|video\s*song|visualizer|hd|4k|tamil tunes|gana rockers media|gana balamurugan media|drugs aw)/gi;
    const words = query
      .replace(/\[.*?\]|\(.*?\)/g, '')
      .replace(/\|.*$/g, '')
      .replace(noiseRegex, '')
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 1);

    const progressiveQueries = [
      query,
      words.join(' '),
      words.slice(0, 2).join(' '),
      words.slice(-2).join(' '),
      words.slice(1, 3).join(' ')
    ].filter(q => q && q.length > 2);

    const uniqueSCQueries = [...new Set(progressiveQueries)];

    for (const scq of uniqueSCQueries) {
      try {
        const scSearch = await play.search(scq, { source: { soundcloud: 'tracks' }, limit: 5 });
        if (scSearch && scSearch.length > 0) {
          for (const sc of scSearch) {
            const streamTarget = sc.permalink || sc.url;
            if (streamTarget) return streamTarget;
          }
        }
      } catch (e) {}
    }
    return null;
  }

  async resolveTrack(query, requester) {
    if (!query) return null;
    const cleanQuery = query.trim();

    // 1. Spotify Track URL
    if (cleanQuery.includes('spotify.com') && cleanQuery.includes('/track/')) {
      try {
        const oembed = await fetchJson('https://open.spotify.com/oembed?url=' + encodeURIComponent(cleanQuery));
        if (oembed && oembed.title) {
          const title = oembed.title;
          const streamUrl = await this.resolveSoundCloudStream(title);
          return {
            title: title,
            url: cleanQuery,
            streamUrl: streamUrl,
            duration: '3:30',
            author: 'Spotify',
            thumbnail: oembed.thumbnail_url || 'https://open.spotifycdn.com/cdn/images/favicon32.8e66b099.png',
            requester,
            userQuery: title,
            source: 'spotify'
          };
        }
      } catch (e) {}
    }

    // 2. Spotify Playlist URL
    if (cleanQuery.includes('spotify.com') && cleanQuery.includes('/playlist/')) {
      try {
        const match = cleanQuery.match(/\/playlist\/([a-zA-Z0-9]+)/);
        if (match) {
          const html = await fetchText('https://open.spotify.com/embed/playlist/' + match[1]);
          if (html) {
            const idx = html.indexOf('__NEXT_DATA__');
            if (idx !== -1) {
              const start = html.indexOf('>', idx) + 1;
              const end = html.indexOf('</script>', start);
              const json = JSON.parse(html.slice(start, end));
              const entity = json.props?.pageProps?.state?.data?.entity;
              if (entity?.trackList && entity.trackList.length > 0) {
                return {
                  isPlaylist: true,
                  title: entity.name || 'Spotify Playlist',
                  tracks: entity.trackList.map(t => ({
                    title: `${t.title} - ${t.subtitle}`,
                    url: cleanQuery,
                    duration: t.duration ? `${Math.floor(t.duration / 60000)}:${String(Math.floor((t.duration % 60000) / 1000)).padStart(2, '0')}` : '3:30',
                    author: t.subtitle || 'Spotify Artist',
                    thumbnail: entity.coverArt?.sources?.[0]?.url || 'https://open.spotifycdn.com/cdn/images/favicon32.8e66b099.png',
                    requester,
                    userQuery: `${t.title} ${t.subtitle}`.trim(),
                    source: 'spotify'
                  }))
                };
              }
            }
          }
        }
      } catch (e) {}
    }

    // 3. YouTube Video ID / Direct URL
    const videoIdMatch = cleanQuery.match(/(?:youtu\.be\/|v=|\/shorts\/|\/embed\/|\/live\/)([a-zA-Z0-9_-]{11})/i);
    let ytTrack = null;
    if (videoIdMatch) {
      const videoId = videoIdMatch[1];
      try {
        const videoInfo = await yts({ videoId });
        if (videoInfo) {
          ytTrack = {
            title: videoInfo.title,
            url: videoInfo.url || `https://youtube.com/watch?v=${videoId}`,
            duration: videoInfo.timestamp || 'Live',
            author: videoInfo.author?.name || 'Unknown Artist',
            thumbnail: videoInfo.thumbnail || videoInfo.image,
            requester,
            userQuery: cleanQuery
          };
        }
      } catch (err) {}
    }

    // 4. Search as a general YouTube query for UI Metadata
    if (!ytTrack) {
      const searchRes = await yts(cleanQuery).catch(() => null);
      if (searchRes && searchRes.videos && searchRes.videos.length > 0) {
        const topVideo = searchRes.videos[0];
        ytTrack = {
          title: topVideo.title,
          url: topVideo.url,
          duration: topVideo.timestamp,
          author: topVideo.author?.name || 'Unknown Artist',
          thumbnail: topVideo.thumbnail,
          requester,
          userQuery: cleanQuery
        };
      }
    }

    // 5. Attach unblocked SoundCloud stream URL
    const scStreamUrl = await this.resolveSoundCloudStream(cleanQuery);
    if (scStreamUrl) {
      if (ytTrack) {
        ytTrack.streamUrl = scStreamUrl;
        return ytTrack;
      }
      return {
        title: cleanQuery,
        url: scStreamUrl,
        streamUrl: scStreamUrl,
        duration: '3:30',
        author: 'Spotify / Web',
        thumbnail: undefined,
        requester,
        userQuery: cleanQuery,
        source: 'spotify'
      };
    }

    return ytTrack;
  }

  async play(interaction, query) {
    if (!interaction.guild) {
      return { success: false, message: 'This command can only be used in a server.' };
    }

    const member = interaction.member;
    const voiceChannel = member?.voice?.channel;

    if (!voiceChannel) {
      return { success: false, message: 'You must join a voice channel first before playing music!' };
    }

    const botMember = interaction.guild.members.me || (await interaction.guild.members.fetchMe().catch(() => null));
    if (!botMember) {
      return { success: false, message: 'Could not resolve bot member permissions in this guild.' };
    }

    const permissions = voiceChannel.permissionsFor(botMember);
    if (!permissions || !permissions.has('Connect') || !permissions.has('Speak')) {
      return { success: false, message: 'I need `Connect` and `Speak` permissions in your voice channel!' };
    }

    let queue = this.queues.get(interaction.guildId);
    let connection = getVoiceConnection(interaction.guildId);

    if (!connection || connection.state.status === VoiceConnectionStatus.Destroyed || connection.state.status === VoiceConnectionStatus.Disconnected) {
      Logger.info(`Joining voice channel: ${voiceChannel.name} (${voiceChannel.id}) in guild ${interaction.guild.name}`);
      connection = joinVoiceChannel({
        channelId: String(voiceChannel.id),
        guildId: String(interaction.guildId),
        adapterCreator: interaction.guild.voiceAdapterCreator,
        selfDeaf: true,
        selfMute: false
      });
    }

    if (!queue) {
      queue = new GuildQueue(connection, interaction.channel);
      this.queues.set(interaction.guildId, queue);
    } else {
      queue.voiceConnection = connection;
    }

    try {
      const trackInfo = await this.resolveTrack(query, interaction.user);

      if (!trackInfo) {
        return { success: false, message: `No audio results found for \`${query}\`.` };
      }

      if (trackInfo.isPlaylist) {
        for (const t of trackInfo.tracks) {
          await queue.enqueue(t);
        }
        return {
          success: true,
          isPlaylist: true,
          count: trackInfo.tracks.length,
          title: trackInfo.title,
          track: trackInfo.tracks[0]
        };
      }

      await queue.enqueue(trackInfo);
      return { success: true, track: trackInfo, position: queue.queue.length };
    } catch (err) {
      Logger.error(`Music play search error: ${err.message}`);
      return { success: false, message: `Failed to search and queue audio: ${err.message}` };
    }
  }

  async playNow(interaction, query) {
    if (!interaction.guild) {
      return { success: false, message: 'This command can only be used in a server.' };
    }

    const member = interaction.member;
    const voiceChannel = member?.voice?.channel;

    if (!voiceChannel) {
      return { success: false, message: 'You must join a voice channel first before playing music!' };
    }

    const botMember = interaction.guild.members.me || (await interaction.guild.members.fetchMe().catch(() => null));
    if (!botMember) {
      return { success: false, message: 'Could not resolve bot member permissions in this guild.' };
    }

    const permissions = voiceChannel.permissionsFor(botMember);
    if (!permissions || !permissions.has('Connect') || !permissions.has('Speak')) {
      return { success: false, message: 'I need `Connect` and `Speak` permissions in your voice channel!' };
    }

    let queue = this.queues.get(interaction.guildId);
    let connection = getVoiceConnection(interaction.guildId);

    if (!connection || connection.state.status === VoiceConnectionStatus.Destroyed || connection.state.status === VoiceConnectionStatus.Disconnected) {
      connection = joinVoiceChannel({
        channelId: String(voiceChannel.id),
        guildId: String(interaction.guildId),
        adapterCreator: interaction.guild.voiceAdapterCreator,
        selfDeaf: true,
        selfMute: false
      });
    }

    if (!queue) {
      queue = new GuildQueue(connection, interaction.channel);
      this.queues.set(interaction.guildId, queue);
    } else {
      queue.voiceConnection = connection;
    }

    try {
      const trackInfo = await this.resolveTrack(query, interaction.user);

      if (!trackInfo) {
        return { success: false, message: `No audio results found for \`${query}\`.` };
      }

      if (trackInfo.isPlaylist) {
        await queue.playNow(trackInfo.tracks[0]);
        for (let i = 1; i < trackInfo.tracks.length; i++) {
          await queue.enqueue(trackInfo.tracks[i]);
        }
        return {
          success: true,
          isPlaylist: true,
          count: trackInfo.tracks.length,
          title: trackInfo.title,
          track: trackInfo.tracks[0]
        };
      }

      await queue.playNow(trackInfo);
      return { success: true, track: trackInfo };
    } catch (err) {
      Logger.error(`Music playNow error: ${err.message}`);
      return { success: false, message: `Failed to search and play audio: ${err.message}` };
    }
  }

  skip(guildId) {
    if (!guildId) return false;
    const queue = this.queues.get(guildId);
    if (!queue || !queue.currentTrack) return false;
    queue.skip();
    return true;
  }

  previous(guildId) {
    if (!guildId) return false;
    const queue = this.queues.get(guildId);
    if (!queue) return false;
    return queue.previous();
  }

  stop(guildId) {
    if (!guildId) return false;
    const queue = this.queues.get(guildId);
    if (!queue) return false;
    queue.destroy();
    this.queues.delete(guildId);
    return true;
  }

  pause(guildId) {
    if (!guildId) return false;
    const queue = this.queues.get(guildId);
    if (!queue) return false;
    return queue.pause();
  }

  resume(guildId) {
    if (!guildId) return false;
    const queue = this.queues.get(guildId);
    if (!queue) return false;
    return queue.resume();
  }

  toggleLoop(guildId) {
    if (!guildId) return false;
    const queue = this.queues.get(guildId);
    if (!queue) return false;
    return queue.toggleLoop();
  }

  toggleAutoplay(guildId, explicitState = null) {
    if (!guildId) return false;
    const queue = this.queues.get(guildId);
    if (!queue) return false;
    return queue.toggleAutoplay(explicitState);
  }

  setVolume(guildId, volume) {
    if (!guildId) return false;
    const queue = this.queues.get(guildId);
    if (!queue) return false;
    queue.volume = Math.max(0, Math.min(200, volume));
    return true;
  }
}

module.exports = new MusicManager();
