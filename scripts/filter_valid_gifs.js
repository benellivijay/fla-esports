const https = require('node:https');

const candidateIds = [
  'H5C8CevNMbpBqNqFjl', // Monkey puppet
  '3o72F8t9TDi2xVnxOE', // Nick Young
  'PUBxelzbChUTK',
  'l3q2K5jinAlChoCLS',
  'tfUW8mhiFoc8',
  '6nWhy3ulBL7GSCvKw6',
  'WrNfErAnGV7lm',
  'a93jwI0wkWTQs',
  '13CoXDiaCcCoyk',
  'l3vR8IAtvPQuDgOHu',
  '3oKIPnAiaMCws8nOsE', // Popcorn
  '26n6WywqIAZs0IzCM', // Anime shock
  'd10dMmzqCYqQ0',      // Cat stare
  'ICOgUNjpvO0PC',      // Cat side eye
  '10JhviFuU2gWS6',     // Spongebob shock
  '3o84U6421OOWegpQvm', // The rock
  '26ghbWoXv3G6YPpm8',
  'xT0xeuOy2Fcl9vDGiA',
  'wID3zXURLH1jrjCcZy',
  'g01ZnwAUvutuK8GIQn',
  'QMHoU66sBXCAU',      // This is fine dog
  'eKrgVyZ7zLvJCPPQ9n', // Leonardo DiCaprio pointing
  'l41lI4bYmcsPJX9Go',  // Gordon Ramsay idiot sandwich
  '3ohzdYJK1wAdPWVk88', // Judge Judy
  'y41T6TrWXLSE',       // Cat typing
  'Ju7l5y9osyymQ'       // Rickroll
];

function checkId(id) {
  const url = `https://media.giphy.com/media/${id}/giphy.gif`;
  return new Promise(resolve => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 3000 }, res => {
      let size = 0;
      res.on('data', c => size += c.length);
      res.on('end', () => {
        // Giphy unavailable placeholder is EXACTLY 239321 bytes or 0 bytes
        const isValid = res.statusCode === 200 && size > 5000 && size !== 239321;
        resolve(isValid ? { id, url, size } : null);
      });
    }).on('error', () => resolve(null));
  });
}

async function main() {
  const results = await Promise.all(candidateIds.map(checkId));
  const valid = results.filter(Boolean);
  console.log(`Found ${valid.length} 100% genuine active meme GIFs (excluding placeholders):`);
  console.log(JSON.stringify(valid, null, 2));
}

main();
