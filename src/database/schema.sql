-- Mia Database Schema (SQLite)

CREATE TABLE IF NOT EXISTS guild_settings (
  guild_id TEXT PRIMARY KEY,
  prefix TEXT DEFAULT '?',
  floor_role_id TEXT,
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS antinuke_config (
  guild_id TEXT PRIMARY KEY,
  enabled INTEGER DEFAULT 1,
  log_channel_id TEXT,
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS antinuke_limits (
  guild_id TEXT,
  category TEXT,
  limit_count INTEGER,
  time_window_seconds INTEGER,
  punishment TEXT DEFAULT 'ban',
  PRIMARY KEY (guild_id, category)
);

CREATE TABLE IF NOT EXISTS antinuke_whitelist (
  guild_id TEXT,
  user_id TEXT,
  added_by TEXT,
  created_at INTEGER,
  PRIMARY KEY (guild_id, user_id)
);

CREATE TABLE IF NOT EXISTS antinuke_extra_owners (
  guild_id TEXT,
  user_id TEXT,
  added_by TEXT,
  created_at INTEGER,
  PRIMARY KEY (guild_id, user_id)
);

CREATE TABLE IF NOT EXISTS logging_config (
  guild_id TEXT PRIMARY KEY,
  general_channel_id TEXT,
  antinuke_channel_id TEXT,
  enabled_events TEXT DEFAULT '["joins","leaves","edits","deletes","roles","channels","voice"]'
);

CREATE TABLE IF NOT EXISTS automod_config (
  guild_id TEXT PRIMARY KEY,
  antispam INTEGER DEFAULT 0,
  antilink INTEGER DEFAULT 0,
  antiinvite INTEGER DEFAULT 0,
  badwords_list TEXT DEFAULT '[]',
  mass_mention_limit INTEGER DEFAULT 5,
  action TEXT DEFAULT 'warn'
);

CREATE TABLE IF NOT EXISTS anti_raid_config (
  guild_id TEXT PRIMARY KEY,
  enabled INTEGER DEFAULT 1,
  score_limit INTEGER DEFAULT 25,
  window_seconds INTEGER DEFAULT 60,
  punishment TEXT DEFAULT 'kick',
  timeout_duration_minutes INTEGER DEFAULT 60,
  min_account_age_days INTEGER DEFAULT 3,
  age_score INTEGER DEFAULT 3,
  no_avatar_score INTEGER DEFAULT 3,
  rapid_join_score INTEGER DEFAULT 3,
  base_score INTEGER DEFAULT 1,
  badge_bypass_enabled INTEGER DEFAULT 1,
  auto_lockdown_enabled INTEGER DEFAULT 1,
  active_preset TEXT DEFAULT 'standard',
  lockdown_active INTEGER DEFAULT 0,
  last_raid_timestamp INTEGER
);

CREATE TABLE IF NOT EXISTS warnings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT,
  user_id TEXT,
  moderator_id TEXT,
  reason TEXT,
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS ticket_panels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT,
  channel_id TEXT,
  message_id TEXT,
  category_id TEXT,
  support_role_id TEXT,
  title TEXT,
  description TEXT
);

CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT,
  channel_id TEXT,
  user_id TEXT,
  status TEXT DEFAULT 'open',
  created_at INTEGER,
  closed_at INTEGER,
  closed_by TEXT
);

CREATE TABLE IF NOT EXISTS giveaways (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT,
  channel_id TEXT,
  message_id TEXT UNIQUE,
  prize TEXT,
  winners_count INTEGER DEFAULT 1,
  end_time INTEGER,
  host_id TEXT,
  required_role_id TEXT,
  participants TEXT DEFAULT '[]',
  ended INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS reaction_roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT,
  channel_id TEXT,
  message_id TEXT,
  custom_id TEXT,
  role_id TEXT
);

CREATE TABLE IF NOT EXISTS vanity_roles (
  guild_id TEXT PRIMARY KEY,
  role_id TEXT,
  vanity_string TEXT,
  enabled INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS welcomer_config (
  guild_id TEXT PRIMARY KEY,
  channel_id TEXT,
  message TEXT,
  embed_data TEXT,
  auto_role_id TEXT,
  bot_auto_role_id TEXT,
  enabled INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS autoresponders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT,
  trigger TEXT,
  reply TEXT,
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS voicemaster_config (
  guild_id TEXT PRIMARY KEY,
  category_id TEXT,
  channel_id TEXT,
  enabled INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS temp_voice_channels (
  channel_id TEXT PRIMARY KEY,
  guild_id TEXT,
  owner_id TEXT,
  created_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_warnings_guild_user ON warnings(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_giveaways_ended ON giveaways(ended, end_time);
CREATE INDEX IF NOT EXISTS idx_reaction_roles_msg ON reaction_roles(guild_id, message_id);
CREATE INDEX IF NOT EXISTS idx_autoresponders_guild ON autoresponders(guild_id);
