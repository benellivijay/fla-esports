const https = require('node:https');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const targetDir = path.join(__dirname, '..', 'assets', 'memes');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const memes = [
  {
    name: 'chihuahua.gif',
    url: 'https://media1.tenor.com/m/7d36d26786c5512b918b9554a9d701e6/tenor.gif'
  },
  {
    name: 'rock.gif',
    url: 'https://media1.tenor.com/m/5aK01x_k96gAAAAC/rock-sus.gif'
  },
  {
    name: 'side_eye.gif',
    url: 'https://media1.tenor.com/m/68L3_d5Y30YAAAAC/side-eye-dog.gif'
  },
  {
    name: 'monkey.gif',
    url: 'https://media1.tenor.com/m/g9H0N3y-X-wAAAAC/monkey-side-eye.gif'
  },
  {
    name: 'cat_stare.gif',
    url: 'https://media1.tenor.com/m/h9vE50gA4xIAAAAC/cat-stare.gif'
  }
];

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed with status: ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    });
    req.on('error', err => {
      fs.unlink(dest, () => null);
      reject(err);
    });
  });
}

async function run() {
  for (const m of memes) {
    const dest = path.join(targetDir, m.name);
    try {
      await downloadFile(m.url, dest);
      console.log(`Downloaded ${m.name} (${fs.statSync(dest).size} bytes)`);
    } catch (e) {
      console.error(`Failed ${m.name}: ${e.message}`);
    }
  }
}

run();
