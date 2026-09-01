const { Client, GatewayIntentBits } = require('discord.js');
const env = require('./src/config/env');
const brandingManager = require('./src/database/managers/BrandingManager');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.on('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  const avatarUrl = 'https://cdn.discordapp.com/attachments/1539666507582148709/1543557889648492584/Screenshot_2026-08-02_001822.png?ex=6a954dce&is=6a93fc4e&hm=c91965e7074852da849ea920813002ed72a9f106d71f7d1f9c19566eef286300&';
  console.log('Updating bot profile avatar to uploaded image...');
  const res = await brandingManager.updateBotAvatar(client, avatarUrl);
  console.log('Result:', res);
  client.destroy();
});

client.login(env.BOT_TOKEN);
