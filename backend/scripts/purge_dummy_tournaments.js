const fs = require('fs');
const path = require('path');
const { DatabaseManager } = require('../dist/database/db');

async function purge() {
  const db = DatabaseManager.getDb();

  // Ensure deleted_tournaments table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS deleted_tournaments (
      id TEXT PRIMARY KEY,
      deleted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_by TEXT
    );
  `);

  const registryPath = path.resolve(__dirname, '../gdrive_storage/tournaments_registry.json');
  const deletedPath = path.resolve(__dirname, '../gdrive_storage/deleted_tournaments.json');

  let registry = { count: 0, tournaments: [] };
  if (fs.existsSync(registryPath)) {
    registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  }

  // Real admin user id
  const REAL_ADMIN_ID = '7f843b65-0aef-4b21-a0a1-03ceaf5b2b52';

  const testTitlePatterns = [
    /^Championship Paid Solo/i,
    /^Free Community Cup$/i,
    /^Squad Championship Pro/i,
    /^Duo Battle Showdown/i,
    /^Squad Custom Roster Cup/i,
    /^Apex Bermuda Clash/i,
    /^Future Squad Championship/i,
    /^Live Active Match/i,
    /^Grand Free Fire Invitational/i,
    /^Admin Test Cup/i,
    /^Apex Solo Championship/i,
    /^Champions Cup Season/i,
    /^FF Max Championship 2026/i,
    /^Sniper Duel 1v1 Night/i,
    /^Headshot Only Battle Arena/i,
    /^Free Fire Weekend Clash/i,
    /^Bermuda Grand Solo/i,
    /^Purgatory Squad Rush/i,
    /#\d{6}/
  ];

  function isTestTournament(t) {
    if (!t) return false;
    if (t.created_by !== REAL_ADMIN_ID) return true;
    if (testTitlePatterns.some((p) => p.test(t.title))) return true;
    return false;
  }

  // 1. Gather all tournaments from SQLite and registry
  const dbTournaments = db.prepare('SELECT id, title, created_by FROM tournaments').all();
  const allKnownTournaments = new Map();

  for (const t of registry.tournaments || []) {
    allKnownTournaments.set(t.id, t);
  }
  for (const t of dbTournaments) {
    if (!allKnownTournaments.has(t.id)) {
      allKnownTournaments.set(t.id, t);
    }
  }

  const toPurge = [];
  const toKeep = [];

  for (const [id, t] of allKnownTournaments.entries()) {
    if (isTestTournament(t)) {
      toPurge.push(t);
    } else {
      toKeep.push(t);
    }
  }

  console.log(`Found ${allKnownTournaments.size} total tournaments:`);
  console.log(`- Genuine admin tournaments to keep: ${toKeep.length}`);
  console.log(`- Test mock tournaments to purge: ${toPurge.length}`);

  // 2. Existing deleted tombstones
  const deletedSet = new Set();
  const existingDeletedRows = db.prepare('SELECT id FROM deleted_tournaments').all();
  for (const r of existingDeletedRows) {
    deletedSet.add(r.id);
  }

  if (fs.existsSync(deletedPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(deletedPath, 'utf8'));
      const list = Array.isArray(parsed) ? parsed : (parsed.deleted_ids || []);
      for (const id of list) deletedSet.add(id);
    } catch (_) {}
  }

  // 3. Purge test tournaments from DB & add to deleted_tournaments
  for (const t of toPurge) {
    deletedSet.add(t.id);
    try { db.prepare('DELETE FROM tournament_entries WHERE tournament_id = ?').run(t.id); } catch (_) {}
    try { db.prepare('DELETE FROM match_results WHERE tournament_id = ?').run(t.id); } catch (_) {}
    try { db.prepare('DELETE FROM tournaments WHERE id = ?').run(t.id); } catch (_) {}
    try {
      db.prepare('INSERT OR IGNORE INTO deleted_tournaments (id, deleted_at, deleted_by) VALUES (?, CURRENT_TIMESTAMP, ?)').run(t.id, 'cleanup_purge_script');
    } catch (_) {}
  }

  // 4. Update deleted_tournaments.json
  const deletedList = Array.from(deletedSet);
  const deletedPayload = {
    version: '1.0',
    last_synced_at: new Date().toISOString(),
    folder_id: registry.folder_id || '1aR8N0GpxbdNFbY-u24iFvW145vjR0MhO',
    count: deletedList.length,
    deleted_ids: deletedList,
  };
  fs.writeFileSync(deletedPath, JSON.stringify(deletedPayload, null, 2), 'utf8');
  console.log(`Updated ${deletedPath} with ${deletedList.length} tombstoned IDs.`);

  // 5. Update tournaments_registry.json
  const keptRegistryList = (registry.tournaments || []).filter((t) => !deletedSet.has(t.id));
  const registryPayload = {
    version: '1.0',
    last_synced_at: new Date().toISOString(),
    folder_id: registry.folder_id || '1aR8N0GpxbdNFbY-u24iFvW145vjR0MhO',
    count: keptRegistryList.length,
    tournaments: keptRegistryList,
  };
  fs.writeFileSync(registryPath, JSON.stringify(registryPayload, null, 2), 'utf8');
  console.log(`Updated ${registryPath} with ${keptRegistryList.length} clean tournaments.`);

  console.log('\nKept Tournaments:');
  for (const t of keptRegistryList) {
    console.log(`- [${t.id}] ${t.title} (Status: ${t.status}, Created by: ${t.created_by})`);
  }
}

purge().catch((err) => {
  console.error('Error during purge:', err);
  process.exit(1);
});
