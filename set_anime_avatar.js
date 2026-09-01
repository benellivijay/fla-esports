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
  // Anime girl avatar from developer portal / user
  const animeAvatarUrl = 'https://cdn.discordapp.com/attachments/1520868354695368814/1543565059576430692/57248c148b59bfd521eef799cbc30788.jpg?ex=6a95547c&is=6a9402fc&hm=e53cb31cc83ef55ca6831e95e58edb4ae0a4ded353e539628010a9d495f6ff9f&';
  try {
    console.log('Downloading anime girl image via https...');
    const buffer = await downloadImageBuffer(animeAvatarUrl);
    console.log('Downloaded image buffer:', buffer.length, 'bytes');
    await client.user.setAvatar(buffer);
    console.log('SUCCESS! Updated bot avatar to Anime Girl:', client.user.displayAvatarURL());
  } catch (err) {
    console.error('FAILED:', err.message);
  }
  client.destroy();
});

client.login(env.BOT_TOKEN);
