const db = require('../db');

class TicketManager {
  // Panel management
  savePanel({ guildId, channelId, messageId, categoryId, supportRoleId, title, description }) {
    return db.run(
      `INSERT INTO ticket_panels (guild_id, channel_id, message_id, category_id, support_role_id, title, description)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      guildId,
      channelId,
      messageId,
      categoryId,
      supportRoleId,
      title,
      description
    );
  }

  getPanel(guildId, messageId) {
    return db.get(
      'SELECT * FROM ticket_panels WHERE guild_id = ? AND message_id = ?',
      guildId,
      messageId
    );
  }

  getPanelByChannel(guildId, channelId) {
    return db.get(
      'SELECT * FROM ticket_panels WHERE guild_id = ? AND channel_id = ? ORDER BY id DESC LIMIT 1',
      guildId,
      channelId
    );
  }

  // Active tickets
  createTicket(guildId, channelId, userId) {
    return db.run(
      'INSERT INTO tickets (guild_id, channel_id, user_id, status, created_at) VALUES (?, ?, ?, ?, ?)',
      guildId,
      channelId,
      userId,
      'open',
      Date.now()
    );
  }

  getOpenTicket(guildId, userId) {
    return db.get(
      "SELECT * FROM tickets WHERE guild_id = ? AND user_id = ? AND status = 'open'",
      guildId,
      userId
    );
  }

  getTicketByChannel(channelId) {
    return db.get('SELECT * FROM tickets WHERE channel_id = ?', channelId);
  }

  closeTicket(channelId, closedBy) {
    return db.run(
      "UPDATE tickets SET status = 'closed', closed_at = ?, closed_by = ? WHERE channel_id = ?",
      Date.now(),
      closedBy,
      channelId
    );
  }
}

module.exports = new TicketManager();
