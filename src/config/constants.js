/**
 * Mia Bot - Core Constants & Configuration Definitions
 */

const ANTINUKE_CATEGORIES = {
  BAN: 'ban',
  UNBAN: 'unban',
  KICK: 'kick',
  MEMBER_PRUNE: 'member_prune',
  BOT_ADD: 'bot_add',
  VANITY_CHANGE: 'vanity_change',
  CHANNEL_CREATE: 'channel_create',
  CHANNEL_DELETE: 'channel_delete',
  CHANNEL_UPDATE: 'channel_update',
  ROLE_CREATE: 'role_create',
  ROLE_DELETE: 'role_delete',
  ROLE_UPDATE: 'role_update',
  MEMBER_UPDATE: 'member_update',
  SERVER_UPDATE: 'server_update',
  MASS_MENTION: 'mass_mention',
  EMOJI_STICKER_CREATE: 'emoji_sticker_create',
  EMOJI_STICKER_DELETE: 'emoji_sticker_delete',
  EMOJI_STICKER_UPDATE: 'emoji_sticker_update',
  WEBHOOK_CREATE: 'webhook_create',
  WEBHOOK_DELETE: 'webhook_delete',
  WEBHOOK_UPDATE: 'webhook_update',
  INTEGRATION_ADD: 'integration_add',
  INVITE_ROLE_GRANT: 'invite_role_grant'
};

const PUNISHMENTS = {
  BAN: 'ban',
  KICK: 'kick',
  STRIP_ROLES: 'strip_roles',
  QUARANTINE: 'quarantine' // 28-day timeout
};

// Default thresholds: [limit_count, time_window_seconds, default_punishment]
const DEFAULT_LIMITS = {
  [ANTINUKE_CATEGORIES.BAN]: { limit: 3, window: 10, punishment: PUNISHMENTS.BAN },
  [ANTINUKE_CATEGORIES.UNBAN]: { limit: 3, window: 10, punishment: PUNISHMENTS.BAN },
  [ANTINUKE_CATEGORIES.KICK]: { limit: 3, window: 10, punishment: PUNISHMENTS.BAN },
  [ANTINUKE_CATEGORIES.MEMBER_PRUNE]: { limit: 1, window: 10, punishment: PUNISHMENTS.BAN },
  [ANTINUKE_CATEGORIES.BOT_ADD]: { limit: 1, window: 10, punishment: PUNISHMENTS.BAN },
  [ANTINUKE_CATEGORIES.VANITY_CHANGE]: { limit: 1, window: 10, punishment: PUNISHMENTS.BAN },
  [ANTINUKE_CATEGORIES.CHANNEL_CREATE]: { limit: 3, window: 10, punishment: PUNISHMENTS.BAN },
  [ANTINUKE_CATEGORIES.CHANNEL_DELETE]: { limit: 2, window: 10, punishment: PUNISHMENTS.BAN },
  [ANTINUKE_CATEGORIES.CHANNEL_UPDATE]: { limit: 3, window: 10, punishment: PUNISHMENTS.BAN },
  [ANTINUKE_CATEGORIES.ROLE_CREATE]: { limit: 3, window: 10, punishment: PUNISHMENTS.BAN },
  [ANTINUKE_CATEGORIES.ROLE_DELETE]: { limit: 2, window: 10, punishment: PUNISHMENTS.BAN },
  [ANTINUKE_CATEGORIES.ROLE_UPDATE]: { limit: 3, window: 10, punishment: PUNISHMENTS.BAN },
  [ANTINUKE_CATEGORIES.MEMBER_UPDATE]: { limit: 4, window: 10, punishment: PUNISHMENTS.BAN },
  [ANTINUKE_CATEGORIES.SERVER_UPDATE]: { limit: 2, window: 10, punishment: PUNISHMENTS.BAN },
  [ANTINUKE_CATEGORIES.MASS_MENTION]: { limit: 3, window: 10, punishment: PUNISHMENTS.BAN },
  [ANTINUKE_CATEGORIES.EMOJI_STICKER_CREATE]: { limit: 4, window: 10, punishment: PUNISHMENTS.BAN },
  [ANTINUKE_CATEGORIES.EMOJI_STICKER_DELETE]: { limit: 3, window: 10, punishment: PUNISHMENTS.BAN },
  [ANTINUKE_CATEGORIES.EMOJI_STICKER_UPDATE]: { limit: 4, window: 10, punishment: PUNISHMENTS.BAN },
  [ANTINUKE_CATEGORIES.WEBHOOK_CREATE]: { limit: 2, window: 10, punishment: PUNISHMENTS.BAN },
  [ANTINUKE_CATEGORIES.WEBHOOK_DELETE]: { limit: 2, window: 10, punishment: PUNISHMENTS.BAN },
  [ANTINUKE_CATEGORIES.WEBHOOK_UPDATE]: { limit: 3, window: 10, punishment: PUNISHMENTS.BAN },
  [ANTINUKE_CATEGORIES.INTEGRATION_ADD]: { limit: 1, window: 10, punishment: PUNISHMENTS.BAN },
  [ANTINUKE_CATEGORIES.INVITE_ROLE_GRANT]: { limit: 1, window: 10, punishment: PUNISHMENTS.BAN }
};

const COLORS = {
  PRIMARY: '#5865F2',
  SUCCESS: '#57F287',
  DANGER: '#ED4245',
  WARNING: '#FEE75C',
  INFO: '#5865F2',
  SECURITY: '#EB459E',
  DARK: '#2B2D31'
};

const EMOJIS = {
  SHIELD: '🛡️',
  ALERT: '🚨',
  LOCK: '🔒',
  UNLOCK: '🔓',
  CHECK: '✅',
  CROSS: '❌',
  TRASH: '🗑️',
  TICKET: '📩',
  GIVEAWAY: '🎉',
  MUSIC: '🎵',
  GEAR: '⚙️',
  INFO: 'ℹ️',
  CROWN: '👑',
  WARN: '⚠️'
};

const FLOOR_ROLE_NAME = 'Mia-security-floor';

module.exports = {
  ANTINUKE_CATEGORIES,
  PUNISHMENTS,
  DEFAULT_LIMITS,
  COLORS,
  EMOJIS,
  FLOOR_ROLE_NAME
};
