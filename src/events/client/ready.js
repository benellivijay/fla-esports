const Logger = require('../../utils/logger');
const vcStatUpdater = require('../../utils/VcStatUpdater');
const brandingManager = require('../../database/managers/BrandingManager');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    Logger.success(`Logged in as ${client.user.tag} (ID: ${client.user.id})`);
    Logger.info(`Connected to ${client.guilds.cache.size} servers serving ${client.guilds.cache.reduce((a, g) => a + g.memberCount, 0)} members.`);

    // Automatically sync bot username with Developer Portal application name if changed
    try {
      const app = await client.application.fetch();
      if (app && app.name && app.name !== client.user.username) {
        Logger.info(`Developer Portal app name is '${app.name}'. Updating bot username from '${client.user.username}' to '${app.name}'...`);
        await client.user.setUsername(app.name);
        Logger.success(`Successfully updated bot username to: ${client.user.tag}`);
      }
    } catch (err) {
      Logger.warn(`Could not auto-sync username with app name: ${err.message}`);
    }

    // Ensure each server has its configured branding nickname applied
    for (const guild of client.guilds.cache.values()) {
      try {
        const branding = brandingManager.getServerBranding(guild.id);
        const me = await guild.members.fetchMe();
        if (branding && branding.author_name && branding.author_name !== 'Mia' && branding.author_name !== '𝐌𝐢𝐚 ⚚') {
          if (me.nickname !== branding.author_name) {
            await me.setNickname(branding.author_name).catch(() => null);
          }
        } else if (me.nickname === 'ISHOW' || me.nickname === 'BLACK SHEEP') {
          await me.setNickname(null).catch(() => null);
        }
      } catch (nickErr) {
        Logger.warn(`Could not sync nickname in ${guild.name}: ${nickErr.message}`);
      }
    }

    // Apply persistent branding presence & status
    brandingManager.applyPresence(client);

    // Keep presence alive periodically
    setInterval(() => {
      brandingManager.applyPresence(client);
    }, 60000);

    // Start VC Stat channel name auto-updater
    vcStatUpdater.start(client);
  }
};
