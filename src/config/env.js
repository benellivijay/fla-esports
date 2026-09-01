require('dotenv').config();

module.exports = {
  DISCORD_TOKEN: process.env.DISCORD_TOKEN || '',
  CLIENT_ID: process.env.CLIENT_ID || '',
  GUILD_ID: process.env.GUILD_ID || '',
  DEFAULT_PREFIX: process.env.DEFAULT_PREFIX || '!',
  EMBED_COLOR: process.env.EMBED_COLOR || '#5865F2',
  DATABASE_PATH: process.env.DATABASE_PATH || './data/Mia.sqlite'
};
