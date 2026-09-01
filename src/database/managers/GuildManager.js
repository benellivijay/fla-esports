const db = require('../db');

class GuildManager {
  getGuild(guildId) {
    const row = db.get('SELECT * FROM guild_settings WHERE guild_id = ?', guildId);
    if (!row) {
      this.initGuild(guildId);
      return db.get('SELECT * FROM guild_settings WHERE guild_id = ?', guildId);
    }
    return row;
  }

  initGuild(guildId) {
    db.run(
      'INSERT OR IGNORE INTO guild_settings (guild_id, prefix, created_at) VALUES (?, ?, ?)',
      guildId,
      '!',
      Date.now()
    );
  }

  setPrefix(guildId, prefix) {
    this.initGuild(guildId);
    db.run('UPDATE guild_settings SET prefix = ? WHERE guild_id = ?', prefix, guildId);
  }

  setFloorRole(guildId, roleId) {
    this.initGuild(guildId);
    db.run('UPDATE guild_settings SET floor_role_id = ? WHERE guild_id = ?', roleId, guildId);
  }

  getFloorRole(guildId) {
    const guild = this.getGuild(guildId);
    return guild?.floor_role_id || null;
  }
}

module.exports = new GuildManager();
