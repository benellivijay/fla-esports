const db = require('../db');

class ModerationManager {
  // Warnings
  addWarning(guildId, userId, moderatorId, reason) {
    const result = db.run(
      'INSERT INTO warnings (guild_id, user_id, moderator_id, reason, created_at) VALUES (?, ?, ?, ?, ?)',
      guildId,
      userId,
      moderatorId,
      reason,
      Date.now()
    );
    return result;
  }

  getWarnings(guildId, userId) {
    return db.all(
      'SELECT * FROM warnings WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC',
      guildId,
      userId
    );
  }

  clearWarnings(guildId, userId) {
    return db.run('DELETE FROM warnings WHERE guild_id = ? AND user_id = ?', guildId, userId);
  }

  deleteWarning(guildId, warningId) {
    return db.run('DELETE FROM warnings WHERE guild_id = ? AND id = ?', guildId, warningId);
  }

  // Automod Configuration
  getAutomodConfig(guildId) {
    let row = db.get('SELECT * FROM automod_config WHERE guild_id = ?', guildId);
    if (!row) {
      this.initAutomodConfig(guildId);
      row = db.get('SELECT * FROM automod_config WHERE guild_id = ?', guildId);
    }
    return {
      ...row,
      antispam: Boolean(row.antispam),
      anticaps: Boolean(row.anticaps),
      antilink: Boolean(row.antilink),
      antiinvite: Boolean(row.antiinvite),
      antimention: Boolean(row.antimention),
      antiemojispam: Boolean(row.antiemojispam),
      antinsfw: Boolean(row.antinsfw),
      badwords_list: JSON.parse(row.badwords_list || '[]')
    };
  }

  initAutomodConfig(guildId) {
    db.run(
      `INSERT OR IGNORE INTO automod_config 
       (guild_id, antispam, anticaps, antilink, antiinvite, antimention, antiemojispam, antinsfw, badwords_list, mass_mention_limit, action) 
       VALUES (?, 0, 0, 0, 0, 0, 0, 0, '[]', 5, 'warn')`,
      guildId
    );
  }

  setAutomodFeature(guildId, feature, value) {
    this.initAutomodConfig(guildId);
    if (feature === 'badwords_list') {
      const json = JSON.stringify(value);
      db.run('UPDATE automod_config SET badwords_list = ? WHERE guild_id = ?', json, guildId);
    } else {
      db.run(`UPDATE automod_config SET ${feature} = ? WHERE guild_id = ?`, value ? 1 : 0, guildId);
    }
  }

  enableAll(guildId) {
    this.initAutomodConfig(guildId);
    db.run(
      `UPDATE automod_config SET 
       antispam = 1, anticaps = 1, antilink = 1, antiinvite = 1, antimention = 1, antiemojispam = 1, antinsfw = 1
       WHERE guild_id = ?`,
      guildId
    );
  }

  disableAll(guildId) {
    this.initAutomodConfig(guildId);
    db.run(
      `UPDATE automod_config SET 
       antispam = 0, anticaps = 0, antilink = 0, antiinvite = 0, antimention = 0, antiemojispam = 0, antinsfw = 0
       WHERE guild_id = ?`,
      guildId
    );
  }

  addBadword(guildId, word) {
    const config = this.getAutomodConfig(guildId);
    const list = config.badwords_list;
    if (!list.includes(word.toLowerCase())) {
      list.push(word.toLowerCase());
      this.setAutomodFeature(guildId, 'badwords_list', list);
    }
  }

  removeBadword(guildId, word) {
    const config = this.getAutomodConfig(guildId);
    const list = config.badwords_list.filter(w => w !== word.toLowerCase());
    this.setAutomodFeature(guildId, 'badwords_list', list);
  }

  clearBadwords(guildId) {
    this.setAutomodFeature(guildId, 'badwords_list', []);
  }

  setAutomodAction(guildId, action) {
    this.initAutomodConfig(guildId);
    db.run('UPDATE automod_config SET action = ? WHERE guild_id = ?', action, guildId);
  }
}

module.exports = new ModerationManager();
