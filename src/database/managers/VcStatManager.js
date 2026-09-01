const db = require('../db');

class VcStatManager {
  add(guildId, channelId, template) {
    db.run(
      `INSERT OR REPLACE INTO vc_stat_trackers (guild_id, channel_id, template) VALUES (?, ?, ?)`,
      guildId, channelId, template
    );
  }

  remove(guildId, channelId) {
    db.run(
      `DELETE FROM vc_stat_trackers WHERE guild_id = ? AND channel_id = ?`,
      guildId, channelId
    );
  }

  getAll(guildId) {
    return db.all(`SELECT * FROM vc_stat_trackers WHERE guild_id = ?`, guildId);
  }

  getAllTrackers() {
    return db.all(`SELECT * FROM vc_stat_trackers`);
  }
}

module.exports = new VcStatManager();
