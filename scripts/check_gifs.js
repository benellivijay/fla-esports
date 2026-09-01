const https = require('node:https');

const testUrls = [
  'https://i.giphy.com/unFLKoAV3oirqZo097.gif',
  'https://i.giphy.com/H5C8CevNMbpBqNqFjl.gif',
  'https://i.giphy.com/3o72F8t9TDi2xVnxOE.gif',
  'https://i.giphy.com/PUBxelzbChUTK.gif',
  'https://i.giphy.com/3o84U6421OOWegpQvm.gif',
  'https://i.giphy.com/l3q2K5jinAlChoCLS.gif',
  'https://i.giphy.com/tfUW8mhiFoc8.gif',
  'https://i.giphy.com/26ghbWoXv3G6YPpm8.gif',
  'https://i.giphy.com/xT0xeuOy2Fcl9vDGiA.gif',
  'https://i.giphy.com/wID3zXURLH1jrjCcZy.gif',
  'https://i.giphy.com/g01ZnwAUvutuK8GIQn.gif',
  'https://i.giphy.com/6nWhy3ulBL7GSCvKw6.gif',
  'https://i.giphy.com/WrNfErAnGV7lm.gif',
  'https://i.giphy.com/a93jwI0wkWTQs.gif',
  'https://i.giphy.com/jUwpNzg9IcyrK.gif',
  'https://i.giphy.com/l3vR8IAtvPQuDgOHu.gif',
  'https://i.giphy.com/13CoXDiaCcCoyk.gif',
  'https://i.giphy.com/3og0IPb5OHDQ0NPc1W.gif',
  'https://i.giphy.com/3ohzdYJK1wAdPWVk88.gif',
  'https://i.giphy.com/l41lI4bYmcsPJX9Go.gif'
];

function checkUrl(url) {
  return new Promise(resolve => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 3000 }, res => {
      resolve(res.statusCode === 200 ? url : null);
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

async function main() {
  const results = await Promise.all(testUrls.map(checkUrl));
  const working = results.filter(Boolean);
  console.log(JSON.stringify(working));
  process.exit(0);
}

main();
