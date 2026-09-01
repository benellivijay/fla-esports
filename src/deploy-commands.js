const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const env = require('./config/env');
const Logger = require('./utils/logger');

const commands = [];

function loadCommandData(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory()) {
      loadCommandData(fullPath);
    } else if (file.name.endsWith('.js')) {
      const command = require(fullPath);
      if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
      }
    }
  }
}

loadCommandData(path.join(__dirname, 'commands'));

const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);

(async () => {
  try {
    Logger.info(`Started refreshing ${commands.length} application (/) commands.`);

    // 1. Wipe duplicate guild-specific commands so only 1 copy appears
    const targetGuilds = ['1540696396884090950', '793788884168605767'];
    if (env.GUILD_ID && !targetGuilds.includes(env.GUILD_ID)) {
      targetGuilds.push(env.GUILD_ID);
    }

    for (const gId of targetGuilds) {
      try {
        await rest.put(
          Routes.applicationGuildCommands(env.CLIENT_ID, gId),
          { body: [] }
        );
        Logger.info(`Cleaned up duplicate guild commands for guild ${gId}.`);
      } catch (gErr) {
        Logger.warn(`Could not clear guild commands for ${gId}: ${gErr.message}`);
      }
    }

    // 2. Set clean single Global commands
    const globalData = await rest.put(
      Routes.applicationCommands(env.CLIENT_ID),
      { body: commands }
    );
    Logger.success(`Successfully reloaded ${globalData.length} application (/) commands globally.`);
  } catch (error) {
    Logger.error(`Error deploying slash commands: ${error.message}`);
  }
})();
