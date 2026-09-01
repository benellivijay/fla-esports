const https = require('node:https');

const candidates = [
  'https://i.giphy.com/unFLKoAV3oirqZo097.gif',
  'https://i.giphy.com/H5C8CevNMbpBqNqFjl.gif',
  'https://i.giphy.com/3o72F8t9TDi2xVnxOE.gif',
  'https://i.giphy.com/PUBxelzbChUTK.gif',
  'https://i.giphy.com/3o84U6421OOWegpQvm.gif',
  'https://i.giphy.com/l3q2K5jinAlChoCLS.gif',
  'https://i.giphy.com/tfUW8mhiFoc8.gif'
];

function check(url) {
  return new Promise(resolve => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 3000 }, res => {
      resolve({ url, status: res.statusCode, contentType: res.headers['content-type'] });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

async function main() {
  const results = await Promise.all(candidates.map(check));
  console.log(JSON.stringify(results.filter(Boolean)));
  process.exit(0);
}

main();
