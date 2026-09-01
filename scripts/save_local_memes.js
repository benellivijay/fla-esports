const fs = require('node:fs');
const path = require('node:path');

const targetDir = path.join(__dirname, '..', 'assets', 'memes');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const memes = [
  { name: 'dwight.gif', url: 'https://i.giphy.com/unFLKoAV3oirqZo097.gif' },
  { name: 'monkey.gif', url: 'https://i.giphy.com/H5C8CevNMbpBqNqFjl.gif' },
  { name: 'rock.gif', url: 'https://i.giphy.com/3o84U6421OOWegpQvm.gif' },
  { name: 'confused.gif', url: 'https://i.giphy.com/3o72F8t9TDi2xVnxOE.gif' },
  { name: 'cat_glare.gif', url: 'https://i.giphy.com/PUBxelzbChUTK.gif' },
  { name: 'blinking.gif', url: 'https://i.giphy.com/l3q2K5jinAlChoCLS.gif' },
  { name: 'shocked_cat.gif', url: 'https://i.giphy.com/tfUW8mhiFoc8.gif' }
];

async function download() {
  for (const item of memes) {
    const filePath = path.join(targetDir, item.name);
    try {
      const res = await fetch(item.url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!res.ok) {
        console.error(`Failed ${item.name}: ${res.status}`);
        continue;
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(filePath, buffer);
      console.log(`Saved ${item.name} (${buffer.length} bytes)`);
    } catch (err) {
      console.error(`Error saving ${item.name}: ${err.message}`);
    }
  }
}

download();
