const { getDb } = require('../dist/database/db');

const db = getDb();
console.log('Cleaning up remaining test tournament records...');

db.prepare(`
  DELETE FROM tournament_entries 
  WHERE tournament_id IN (
    SELECT id FROM tournaments WHERE title = 'Admin Test Cup'
  )
`).run();

db.prepare(`
  DELETE FROM tournaments WHERE title = 'Admin Test Cup'
`).run();

console.log('Remaining Clean Tournaments in Database:');
const remaining = db.prepare('SELECT id, title, status, mode, map, prize_pool, created_at FROM tournaments ORDER BY created_at DESC').all();
console.table(remaining);
