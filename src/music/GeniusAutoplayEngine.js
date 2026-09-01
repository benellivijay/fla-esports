const yts = require('yt-search');
const play = require('play-dl');
const Logger = require('../utils/logger');

// JUNK / NON-MUSIC KEYWORDS TO REJECT
const JUNK_KEYWORDS = [
  '1 hour', '10 hour', '1 hour loop', '10 hours', '100 hours', 'extended loop',
  'bass boosted loop', 'slowed reverb 1hr', '1hr loop',
  'reaction', 'reacts to', 'reacting to', 'interview', 'behind the scenes',
  'trailer', 'teaser', 'gameplay', 'walkthrough', 'roast', 'vlog', 'unboxing',
  'tutorial', 'podcast', 'full movie', 'shorts', 'tiktok compilation', 'meme compilation'
];

class GeniusAutoplayEngine {
  /**
   * Cleans video titles by removing noise, tags, and extraneous metadata
   */
  static cleanTitle(rawTitle) {
    if (!rawTitle) return '';
    return rawTitle
      .replace(/\[.*?\]|\(.*?\)/g, '') // remove brackets and parentheses contents
      .replace(/\|.*$/g, '')           // remove trailing pipe tags
      .replace(/(official\s*(music\s*)?video|lyric\s*video|audio|full\s*song|visualizer|hd|4k|remix|slowed\s*\+\s*reverb)/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Checks if a title or description is junk/podcast/reaction video
   */
  static isJunk(video) {
    if (!video) return true;
    const titleLower = (video.title || '').toLowerCase();
    
    // Check duration (ideal song duration is 1m - 10m)
    if (video.seconds && (video.seconds < 55 || video.seconds > 660)) {
      return true;
    }

    // Check junk keywords
    for (const kw of JUNK_KEYWORDS) {
      if (titleLower.includes(kw)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Calculates word overlap similarity between two title strings (0 to 1)
   */
  static titleSimilarity(title1, title2) {
    const words1 = new Set(this.cleanTitle(title1).toLowerCase().split(/\s+/).filter(w => w.length > 2));
    const words2 = new Set(this.cleanTitle(title2).toLowerCase().split(/\s+/).filter(w => w.length > 2));
    if (words1.size === 0 || words2.size === 0) return 0;

    let overlap = 0;
    for (const w of words1) {
      if (words2.has(w)) overlap++;
    }

    return overlap / Math.max(words1.size, words2.size);
  }

  /**
   * Finds the next genius song recommendation based on current song and history
   * @param {Object} currentTrack Current playing song
   * @param {Set<string>} playedUrls Set of already played video URLs
   * @param {Array<string>} playedTitles List of recently played titles
   * @returns {Promise<Object|null>} Next recommended track
   */
  static async getNextTrack(currentTrack, playedUrls = new Set(), playedTitles = []) {
    if (!currentTrack) return null;

    const cleanName = this.cleanTitle(currentTrack.title);
    const artist = (currentTrack.author && currentTrack.author !== 'Unknown Artist') ? currentTrack.author : '';

    // Multi-tier intelligent search queries
    const queryStrategies = [
      // 1. Artist Top Mix
      artist ? `"${artist}" top songs audio` : null,
      // 2. Song Vibe / Related Mix
      `"${cleanName}" related songs mix audio`,
      // 3. Similar Tracks / Music Recommendations
      artist ? `songs like "${cleanName}" by "${artist}"` : `songs like "${cleanName}" audio`,
      // 4. Fallback search
      `${cleanName} audio official`
    ].filter(Boolean);

    for (const query of queryStrategies) {
      try {
        Logger.info(`[GeniusAutoplay] Searching query: "${query}"`);
        const searchResult = await yts(query).catch(() => null);
        if (!searchResult || !searchResult.videos || searchResult.videos.length === 0) {
          continue;
        }

        for (const video of searchResult.videos) {
          // 1. URL uniqueness check
          if (playedUrls.has(video.url) || video.url === currentTrack.url) {
            continue;
          }

          // 2. Junk filter
          if (this.isJunk(video)) {
            continue;
          }

          // 3. Title similarity check against played history
          const isDuplicateTitle = playedTitles.some(prevTitle => {
            return this.titleSimilarity(prevTitle, video.title) > 0.65;
          });
          if (isDuplicateTitle) {
            continue;
          }

          // Valid genius track found!
          Logger.info(`[GeniusAutoplay] Match found: "${video.title}" by ${video.author?.name} (${video.timestamp})`);
          let streamUrl = video.url;
          try {
            const alt = await play.search(video.title, { source: { soundcloud: 'tracks' }, limit: 1 });
            if (alt && alt[0]) streamUrl = alt[0].url;
          } catch {}

          return {
            title: video.title,
            url: video.url,
            streamUrl,
            duration: video.timestamp,
            author: video.author?.name || artist || 'Music Artist',
            thumbnail: video.thumbnail,
            requester: { tag: 'Genius Autoplay 📻', username: 'Mia Autoplay', id: 'autoplay' },
            isAutoplay: true,
            recommendedFrom: currentTrack.title
          };
        }
      } catch (err) {
        Logger.warn(`[GeniusAutoplay] Strategy failed for query "${query}": ${err.message}`);
      }
    }

    return null;
  }
}

module.exports = GeniusAutoplayEngine;
