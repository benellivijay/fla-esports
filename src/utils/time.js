const ms = require('ms');

class TimeHelper {
  /**
   * Parse duration string (e.g. '10m', '1h', '2d') to milliseconds
   */
  static parseDuration(input) {
    if (!input) return null;
    try {
      const parsed = ms(input);
      return typeof parsed === 'number' && parsed > 0 ? parsed : null;
    } catch {
      return null;
    }
  }

  /**
   * Format milliseconds into human readable format
   */
  static formatDuration(milliseconds) {
    if (!milliseconds || milliseconds <= 0) return '0s';
    return ms(milliseconds, { long: true });
  }

  /**
   * Format Discord timestamp
   */
  static discordTimestamp(timestamp, style = 'R') {
    const unix = Math.floor(new Date(timestamp).getTime() / 1000);
    return `<t:${unix}:${style}>`;
  }
}

module.exports = TimeHelper;
