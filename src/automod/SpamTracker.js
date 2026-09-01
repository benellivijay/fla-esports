class SpamTracker {
  constructor() {
    this.messageBuckets = new Map(); // key: `${guildId}:${userId}` -> Array<number>

    // Cleanup every 30s
    setInterval(() => this.cleanup(), 30 * 1000);
  }

  isSpamming(guildId, userId, maxMessages = 5, windowMs = 3000) {
    const now = Date.now();
    const key = `${guildId}:${userId}`;

    let timestamps = this.messageBuckets.get(key) || [];
    timestamps = timestamps.filter(ts => (now - ts) < windowMs);
    timestamps.push(now);
    this.messageBuckets.set(key, timestamps);

    return timestamps.length >= maxMessages;
  }

  cleanup() {
    const now = Date.now();
    for (const [key, timestamps] of this.messageBuckets.entries()) {
      const valid = timestamps.filter(ts => (now - ts) < 10000);
      if (valid.length === 0) {
        this.messageBuckets.delete(key);
      } else {
        this.messageBuckets.set(key, valid);
      }
    }
  }
}

module.exports = new SpamTracker();
