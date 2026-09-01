const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');

const targetDir = path.join(__dirname, '..', 'assets', 'memes');

const testUrls = [
  // Giphy downsized / direct
  'https://media0.giphy.com/media/unFLKoAV3oirqZo097/giphy.gif',
  'https://media1.giphy.com/media/H5C8CevNMbpBqNqFjl/giphy.gif',
  'https://media2.giphy.com/media/3o72F8t9TDi2xVnxOE/giphy.gif',
  'https://media3.giphy.com/media/PUBxelzbChUTK/giphy.gif',
  'https://media4.giphy.com/media/3o84U6421OOWegpQvm/giphy.gif',
  'https://media0.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif',
  'https://media1.giphy.com/media/tfUW8mhiFoc8/giphy.gif',
  // Wikimedia Commons reaction gifs
  'https://upload.wikimedia.org/wikipedia/commons/2/2c/Rotating_earth_%28large%29.gif',
  // GitHub Raw open source reaction memes
  'https://raw.githubusercontent.com/Anish-Lakhani/Discord-Meme-Bot/master/memes/1.jpg',
  'https://raw.githubusercontent.com/Anish-Lakhani/Discord-Meme-Bot/master/memes/2.jpg'
];

async function check(url) {
  return new Promise(resolve => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      let size = 0;
      res.on('data', c => size += c.length);
      res.on('end', () => {
        resolve({ url, status: res.statusCode, size, type: res.headers['content-type'] });
      });
    }).on('error', e => resolve({ url, error: e.message }));
  });
}

async function main() {
  for (const u of testUrls) {
    const r = await check(u);
    console.log(JSON.stringify(r));
  }
}

main();
