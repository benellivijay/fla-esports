const antinukeManager = require('../database/managers/AntinukeManager');
const { DEFAULT_LIMITS, PUNISHMENTS } = require('../config/constants');
const Logger = require('../utils/logger');

class AntinukeEngine {
  constructor() {
    // Map of key `${guildId}:${userId}:${category}` -> Array<number> (timestamps in ms)
    this.actionBuckets = new Map();

    // Start background cleanup every 60 seconds
    setInterval(() => this.cleanup(), 60 * 1000);
  }

  /**
   * Records an action performed by a user and checks if limits are breached.
   */
  recordAction(guildId, userId, category) {
    const now = Date.now();
    const key = `${guildId}:${userId}:${category}`;

    // Get configured limit for this category
    const limitConfig = antinukeManager.getLimit(guildId, category);
    const limitCount = limitConfig ? limitConfig.limit_count : (DEFAULT_LIMITS[category]?.limit || 3);
    const timeWindowSeconds = limitConfig ? limitConfig.time_window_seconds : (DEFAULT_LIMITS[category]?.window || 10);
    const punishment = limitConfig ? limitConfig.punishment : (DEFAULT_LIMITS[category]?.punishment || PUNISHMENTS.BAN);

    const windowMs = timeWindowSeconds * 1000;
    const windowStart = now - windowMs;

    let timestamps = this.actionBuckets.get(key) || [];
    // Prune timestamps older than window
    timestamps = timestamps.filter(ts => ts > windowStart);
    timestamps.push(now);
    this.actionBuckets.set(key, timestamps);

    Logger.security(`[Limit Track] Guild: ${guildId} | User: ${userId} | Category: ${category} | Count: ${timestamps.length}/${limitCount} in ${timeWindowSeconds}s`);

    if (timestamps.length >= limitCount) {
      // Clear bucket upon trigger to prevent redundant punishment cascades
      this.actionBuckets.delete(key);
      return {
        triggered: true,
        count: timestamps.length,
        limitCount,
        timeWindowSeconds,
        punishment
      };
    }

    return {
      triggered: false,
      count: timestamps.length,
      limitCount,
      timeWindowSeconds
    };
  }

  /**
   * Reset limits for a user in a guild
   */
  reset(guildId, userId, category = null) {
    if (category) {
      this.actionBuckets.delete(`${guildId}:${userId}:${category}`);
    } else {
      const prefix = `${guildId}:${userId}:`;
      for (const key of this.actionBuckets.keys()) {
        if (key.startsWith(prefix)) {
          this.actionBuckets.delete(key);
        }
      }
    }
  }

  /**
   * Periodic memory cleanup
   */
  cleanup() {
    const now = Date.now();
    const maxWindowMs = 60 * 1000; // max window cleanup threshold
    for (const [key, timestamps] of this.actionBuckets.entries()) {
      const valid = timestamps.filter(ts => (now - ts) < maxWindowMs);
      if (valid.length === 0) {
        this.actionBuckets.delete(key);
      } else {
        this.actionBuckets.set(key, valid);
      }
    }
  }
}

module.exports = new AntinukeEngine();
