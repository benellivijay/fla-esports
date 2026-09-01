const db = require('../db');

class GiveawayManager {
  createGiveaway({ guildId, channelId, messageId, prize, winnersCount, endTime, hostId, requiredRoleId }) {
    return db.run(
      `INSERT INTO giveaways (guild_id, channel_id, message_id, prize, winners_count, end_time, host_id, required_role_id, participants, ended)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, '[]', 0)`,
      guildId,
      channelId,
      messageId,
      prize,
      winnersCount,
      endTime,
      hostId,
      requiredRoleId || null
    );
  }

  getGiveaway(messageId) {
    const row = db.get('SELECT * FROM giveaways WHERE message_id = ?', messageId);
    if (row) {
      row.participants = JSON.parse(row.participants || '[]');
    }
    return row;
  }

  getActiveGiveaways() {
    const rows = db.all('SELECT * FROM giveaways WHERE ended = 0');
    return rows.map(r => ({
      ...r,
      participants: JSON.parse(r.participants || '[]')
    }));
  }

  getGuildGiveaways(guildId) {
    const rows = db.all('SELECT * FROM giveaways WHERE guild_id = ? ORDER BY end_time DESC', guildId);
    return rows.map(r => ({
      ...r,
      participants: JSON.parse(r.participants || '[]')
    }));
  }

  addParticipant(messageId, userId) {
    const giveaway = this.getGiveaway(messageId);
    if (!giveaway || giveaway.ended) return false;
    if (giveaway.participants.includes(userId)) return false;

    giveaway.participants.push(userId);
    db.run(
      'UPDATE giveaways SET participants = ? WHERE message_id = ?',
      JSON.stringify(giveaway.participants),
      messageId
    );
    return true;
  }

  removeParticipant(messageId, userId) {
    const giveaway = this.getGiveaway(messageId);
    if (!giveaway || giveaway.ended) return false;
    if (!giveaway.participants.includes(userId)) return false;

    const updated = giveaway.participants.filter(id => id !== userId);
    db.run(
      'UPDATE giveaways SET participants = ? WHERE message_id = ?',
      JSON.stringify(updated),
      messageId
    );
    return true;
  }

  endGiveaway(messageId) {
    return db.run('UPDATE giveaways SET ended = 1 WHERE message_id = ?', messageId);
  }
}

module.exports = new GiveawayManager();
