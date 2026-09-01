const { ActivityType } = require('discord.js');
const https = require('https');
const http = require('http');
const db = require('../db');
const Logger = require('../../utils/logger');

function downloadImageBuffer(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadImageBuffer(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP Status ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

class BrandingManager {
  constructor() {
    this.ensureTable();
  }

  ensureTable() {
    try {
      db.run(`
        CREATE TABLE IF NOT EXISTS bot_branding (
          id TEXT PRIMARY KEY DEFAULT 'global',
          status TEXT DEFAULT 'online',
          activity_type TEXT DEFAULT 'Watching',
          activity_text TEXT DEFAULT '/antinuke | 𝐌𝐢𝐚 ⚚ Security',
          stream_url TEXT,
          updated_at INTEGER
        );
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS server_branding (
          guild_id TEXT PRIMARY KEY,
          embed_color TEXT DEFAULT '#FF0000',
          thumbnail_url TEXT,
          banner_url TEXT,
          footer_text TEXT DEFAULT '𝐌𝐢𝐚 ⚚ • Security & Operations',
          footer_icon TEXT,
          author_name TEXT DEFAULT '𝐌𝐢𝐚 ⚚',
          author_icon TEXT,
          description_text TEXT,
          updated_at INTEGER
        );
      `);
    } catch {}
  }

  getBranding() {
    this.ensureTable();
    let row = db.get("SELECT * FROM bot_branding WHERE id = 'global'");
    if (!row) {
      db.run(
        "INSERT OR IGNORE INTO bot_branding (id, status, activity_type, activity_text, stream_url, updated_at) VALUES ('global', 'online', 'Watching', '/antinuke | 𝐌𝐢𝐚 ⚚ Security', NULL, ?)",
        Date.now()
      );
      row = db.get("SELECT * FROM bot_branding WHERE id = 'global'");
    }
    return row;
  }

  setBranding(data = {}) {
    this.ensureTable();
    const current = this.getBranding();
    const status = data.status || current.status || 'online';
    const activityType = data.activity_type || current.activity_type || 'Watching';
    const activityText = data.activity_text !== undefined ? data.activity_text : (current.activity_text || '/antinuke | 𝐌𝐢𝐚 ⚚ Security');
    const streamUrl = data.stream_url !== undefined ? data.stream_url : current.stream_url;

    db.run(
      `INSERT INTO bot_branding (id, status, activity_type, activity_text, stream_url, updated_at)
       VALUES ('global', ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         status = excluded.status,
         activity_type = excluded.activity_type,
         activity_text = excluded.activity_text,
         stream_url = excluded.stream_url,
         updated_at = excluded.updated_at`,
      status,
      activityType,
      activityText,
      streamUrl,
      Date.now()
    );

    return this.getBranding();
  }

  // ─── Server-Specific Branding ───────────────────────────────────────────────
  getDefaultServerBranding() {
    return {
      embed_color: '#FF0000',
      thumbnail_url: null,
      banner_url: null,
      footer_text: '𝐌𝐢𝐚 ⚚ • Security & Operations',
      footer_icon: null,
      author_name: '𝐌𝐢𝐚 ⚚',
      author_icon: null,
      description_text: null
    };
  }

  getServerBranding(guildId) {
    if (!guildId) return this.getDefaultServerBranding();
    this.ensureTable();
    let row = db.get("SELECT * FROM server_branding WHERE guild_id = ?", guildId);
    if (!row) {
      db.run(
        "INSERT OR IGNORE INTO server_branding (guild_id, embed_color, thumbnail_url, banner_url, footer_text, footer_icon, author_name, author_icon, description_text, updated_at) VALUES (?, '#FF0000', NULL, NULL, '𝐌𝐢𝐚 ⚚ • Security & Operations', NULL, '𝐌𝐢𝐚 ⚚', NULL, NULL, ?)",
        guildId,
        Date.now()
      );
      row = db.get("SELECT * FROM server_branding WHERE guild_id = ?", guildId);
    }
    return row || this.getDefaultServerBranding();
  }

  setServerBranding(guildId, data = {}) {
    if (!guildId) return this.getDefaultServerBranding();
    this.ensureTable();
    const current = this.getServerBranding(guildId);

    const embedColor = data.embed_color !== undefined ? data.embed_color : current.embed_color;
    const thumbnailUrl = data.thumbnail_url !== undefined ? data.thumbnail_url : current.thumbnail_url;
    const bannerUrl = data.banner_url !== undefined ? data.banner_url : current.banner_url;
    const footerText = data.footer_text !== undefined ? data.footer_text : current.footer_text;
    const footerIcon = data.footer_icon !== undefined ? data.footer_icon : current.footer_icon;
    const authorName = data.author_name !== undefined ? data.author_name : current.author_name;
    const authorIcon = data.author_icon !== undefined ? data.author_icon : current.author_icon;
    const descriptionText = data.description_text !== undefined ? data.description_text : current.description_text;

    db.run(
      `INSERT INTO server_branding (guild_id, embed_color, thumbnail_url, banner_url, footer_text, footer_icon, author_name, author_icon, description_text, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(guild_id) DO UPDATE SET
         embed_color = excluded.embed_color,
         thumbnail_url = excluded.thumbnail_url,
         banner_url = excluded.banner_url,
         footer_text = excluded.footer_text,
         footer_icon = excluded.footer_icon,
         author_name = excluded.author_name,
         author_icon = excluded.author_icon,
         description_text = excluded.description_text,
         updated_at = excluded.updated_at`,
      guildId,
      embedColor,
      thumbnailUrl,
      bannerUrl,
      footerText,
      footerIcon,
      authorName,
      authorIcon,
      descriptionText,
      Date.now()
    );

    return this.getServerBranding(guildId);
  }

  resetServerBranding(guildId) {
    if (!guildId) return this.getDefaultServerBranding();
    this.ensureTable();
    db.run(
      `UPDATE server_branding SET
         embed_color = '#FF0000',
         thumbnail_url = NULL,
         banner_url = NULL,
         footer_text = '𝐌𝐢𝐚 ⚚ • Security & Operations',
         footer_icon = NULL,
         author_name = '𝐌𝐢𝐚 ⚚',
         author_icon = NULL,
         description_text = NULL,
         updated_at = ?
       WHERE guild_id = ?`,
      Date.now(),
      guildId
    );
    return this.getServerBranding(guildId);
  }

  resolveActivityType(typeStr) {
    const s = String(typeStr || '').toLowerCase();
    if (s === 'playing' || s === 'play') return ActivityType.Playing;
    if (s === 'streaming' || s === 'stream') return ActivityType.Streaming;
    if (s === 'listening' || s === 'listen') return ActivityType.Listening;
    if (s === 'competing' || s === 'compete') return ActivityType.Competing;
    if (s === 'custom') return ActivityType.Custom;
    return ActivityType.Watching;
  }

  async updateBotAvatar(client, imageUrl) {
    if (!client?.user || !imageUrl) return { success: false, error: 'No image URL provided' };
    try {
      let buffer;
      if (imageUrl.startsWith('data:')) {
        buffer = imageUrl;
      } else {
        buffer = await downloadImageBuffer(imageUrl);
      }
      await client.user.setAvatar(buffer);
      Logger.success(`Successfully updated bot Discord profile avatar.`);
      return { success: true };
    } catch (err) {
      Logger.error(`Failed to update bot avatar: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  applyPresence(client) {
    if (!client?.user) return;
    try {
      const branding = this.getBranding();
      const actType = this.resolveActivityType(branding.activity_type);

      const activityOptions = {
        name: branding.activity_text || '/antinuke | 𝐌𝐢𝐚 ⚚ Security',
        type: actType
      };

      if (actType === ActivityType.Streaming && branding.stream_url) {
        activityOptions.url = branding.stream_url;
      }

      client.user.setPresence({
        activities: [activityOptions],
        status: branding.status || 'online'
      });
    } catch (err) {
      Logger.warn(`Failed to apply bot branding presence: ${err.message}`);
    }
  }
}

module.exports = new BrandingManager();
