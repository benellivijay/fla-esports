const https = require('https');
const http = require('http');

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

const { Client, GatewayIntentBits } = require('discord.js');
const env = require('./src/config/env');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.on('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  const avatarUrl = 'https://cdn.discordapp.com/attachments/1539666507582148709/1543557889648492584/Screenshot_2026-08-02_001822.png?ex=6a954dce&is=6a93fc4e&hm=c91965e7074852da849ea920813002ed72a9f106d71f7d1f9c19566eef286300&';
  try {
    console.log('Downloading image via https...');
    const buffer = await downloadImageBuffer(avatarUrl);
    console.log('Downloaded image buffer:', buffer.length, 'bytes');
    await client.user.setAvatar(buffer);
    console.log('SUCCESS! Updated bot avatar to:', client.user.displayAvatarURL());
  } catch (err) {
    console.error('FAILED:', err.message);
  }
  client.destroy();
});

client.login(env.BOT_TOKEN);
