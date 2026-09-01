const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');

const targetDir = path.join(__dirname, '..', 'assets', 'memes');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// Clean list of verified, direct CDN URLs with no hotlink blockers
const gifSources = [
  {
    name: 'monkey_side_eye.gif',
    url: 'https://media.tenor.com/g9H0N3y-X-wAAAAC/monkey-side-eye.gif'
  },
  {
    name: 'dog_side_eye.gif',
    url: 'https://media.tenor.com/68L3_d5Y30YAAAAC/side-eye-dog.gif'
  },
  {
    name: 'rock_eyebrow.gif',
    url: 'https://media.tenor.com/5aK01x_k96gAAAAC/rock-sus.gif'
  },
  {
    name: 'cat_judging.gif',
    url: 'https://media.tenor.com/C31iF7_F_eAAAAAC/cat-judging-you.gif'
  },
  {
    name: 'chihuahua_shocked.gif',
    url: 'https://media.tenor.com/fUe0FwA6D-IAAAAC/chihuahua-shocked.gif'
  },
  {
    name: 'blinking_white_guy.gif',
    url: 'https://media.tenor.com/x0Z661bKk9cAAAAC/blinking-white-guy.gif'
  },
  {
    name: 'confused_travolta.gif',
    url: 'https://media.tenor.com/N_w9c4qQO3sAAAAC/confused-john-travolta.gif'
  },
  {
    name: 'shocked_pikachu.gif',
    url: 'https://media.tenor.com/g1Wq1z-f_pMAAAAC/shocked-pikachu.gif'
  }
];

function download(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        if (buffer.length < 5000) {
          return reject(new Error(`File too small: ${buffer.length} bytes`));
        }
        // Verify GIF header 'GIF89a' or 'GIF87a'
        const header = buffer.slice(0, 6).toString();
        if (!header.startsWith('GIF')) {
          return reject(new Error(`Not a valid GIF: header ${header}`));
        }
        fs.writeFileSync(dest, buffer);
        resolve(buffer.length);
      });
    }).on('error', reject);
  });
}

async function main() {
  // Clear old bad files
  const oldFiles = fs.readdirSync(targetDir);
  for (const f of oldFiles) {
    fs.unlinkSync(path.join(targetDir, f));
  }

  console.log('--- Downloading Fresh Clean Meme GIFs ---');
  const validFiles = [];
  for (const item of gifSources) {
    const dest = path.join(targetDir, item.name);
    try {
      const size = await download(item.url, dest);
      console.log(`✔ SUCCESS: ${item.name} (${Math.round(size / 1024)} KB)`);
      validFiles.push(item.name);
    } catch (e) {
      console.error(`✘ FAILED: ${item.name}: ${e.message}`);
    }
  }

  console.log('\nValid downloaded files:', JSON.stringify(validFiles));
}

main();
