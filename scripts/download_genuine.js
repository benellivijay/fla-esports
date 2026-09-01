const fs = require('node:fs');
const path = require('node:path');

const targetDir = path.join(__dirname, '..', 'assets', 'memes');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const list = [
  { name: 'monkey_side_eye.gif', id: 'H5C8CevNMbpBqNqFjl' },
  { name: 'confused_nick_young.gif', id: '3o72F8t9TDi2xVnxOE' },
  { name: 'popcorn.gif', id: '3oKIPnAiaMCws8nOsE' },
  { name: 'spongebob_shocked.gif', id: 'l0HlvtIP80shup8pq' },
  { name: 'crying_laughing.gif', id: 'l0Exk8EUzSLsrErEQ' },
  { name: 'steve_harvey_shocked.gif', id: '26BRuo652Za3GnYX6' },
  { name: 'cat_shocked.gif', id: '3og0IKinzBGJx8pssU' },
  { name: 'homer_disappear.gif', id: 'jUwpNzg9IcyrK' },
  { name: 'shaq_wiggle.gif', id: 'l3vR8IAtvPQuDgOHu' }
];

async function main() {
  const verifiedFiles = [];
  for (const item of list) {
    const url = `https://i.giphy.com/${item.id}.gif`;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 239321 || buf.length < 5000) {
        console.log(`[SKIPPED PLACEHOLDER] ${item.name} (${buf.length} bytes)`);
        continue;
      }
      const dest = path.join(targetDir, item.name);
      fs.writeFileSync(dest, buf);
      console.log(`[SAVED REAL MEME] ${item.name} (${buf.length} bytes)`);
      verifiedFiles.push(item.name);
    } catch (e) {
      console.error(`Error on ${item.name}: ${e.message}`);
    }
  }

  console.log(`\nDONE! Verified real meme files (${verifiedFiles.length}):`, verifiedFiles);
  process.exit(0);
}

main();
