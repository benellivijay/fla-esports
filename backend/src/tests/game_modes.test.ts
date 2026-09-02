import { TournamentService } from '../modules/tournament/tournament.service';
import { getDb } from '../database/db';
import { v4 as uuidv4 } from 'uuid';

async function runGameModeTests() {
  console.log('🧪 Running Game Modes Integration Tests...\n');

  const db = getDb();
  let admin = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get() as any;
  let adminId: string;

  if (!admin) {
    adminId = uuidv4();
    db.prepare(`
      INSERT INTO users (id, email, username, role, status, is_phone_verified, is_email_verified)
      VALUES (?, 'testadmin@ffesports.com', 'testadmin', 'admin', 'active', 1, 1)
    `).run(adminId);
  } else {
    adminId = admin.id;
  }

  // Test 1: Create tournaments across different game modes
  console.log('Test 1: Create tournaments with specific game modes');
  const t1 = await TournamentService.createTournament(adminId, {
    title: 'FF Max Championship 2026',
    game_mode: 'ff_max',
    mode: 'solo',
    map: 'Bermuda',
    entryType: 'paid',
    entryFee: 50,
    prizePool: 2000,
    prizeDistribution: [{ rank: 1, amount: 1200 }, { rank: 2, amount: 800 }],
    maxSlots: 48,
    startTime: new Date(Date.now() + 3600000).toISOString(),
  });

  const t2 = await TournamentService.createTournament(adminId, {
    title: 'Sniper Duel 1v1 Night',
    game_mode: 'sniper_1v1',
    mode: 'solo',
    map: 'Kalahari',
    entryType: 'free',
    prizePool: 500,
    prizeDistribution: [{ rank: 1, amount: 500 }],
    maxSlots: 10,
    startTime: new Date(Date.now() + 7200000).toISOString(),
  });

  const t3 = await TournamentService.createTournament(adminId, {
    title: 'Headshot Only Battle Arena',
    game_mode: 'headshot_only',
    mode: 'squad',
    map: 'Purgatory',
    entryType: 'paid',
    entryFee: 100,
    prizePool: 5000,
    prizeDistribution: [{ rank: 1, amount: 3000 }, { rank: 2, amount: 2000 }],
    maxSlots: 48,
    startTime: new Date(Date.now() + 10800000).toISOString(),
  });

  if (t1.game_mode !== 'ff_max' || t2.game_mode !== 'sniper_1v1' || t3.game_mode !== 'headshot_only') {
    throw new Error('Tournament game_mode property was not saved or returned properly.');
  }
  console.log('? Test 1 Passed: Tournaments created with correct game modes.');

  // Test 2: Filter tournaments by game_mode = 'sniper_1v1'
  console.log('\nTest 2: Filter tournaments by game_mode');
  const sniperResults = await TournamentService.listTournaments({ game_mode: 'sniper_1v1' }, 'admin');
  const allSniper = sniperResults.tournaments.every((t) => t.game_mode === 'sniper_1v1');
  if (!allSniper || sniperResults.tournaments.length === 0) {
    throw new Error('Filtering by game_mode=sniper_1v1 failed.');
  }
  console.log(`? Test 2 Passed: Successfully filtered ${sniperResults.tournaments.length} sniper_1v1 tournaments.`);

  // Test 3: Multi-filter with entryType = 'paid' and game_mode = 'ff_max'
  console.log('\nTest 3: Multi-filter with entryType and game_mode');
  const ffMaxPaidResults = await TournamentService.listTournaments({ game_mode: 'ff_max', entryType: 'paid' }, 'admin');
  const matchesFilter = ffMaxPaidResults.tournaments.every((t) => t.game_mode === 'ff_max' && t.entry_type === 'paid');
  if (!matchesFilter || ffMaxPaidResults.tournaments.length === 0) {
    throw new Error('Multi-filtering by game_mode and entryType failed.');
  }
  console.log(`? Test 3 Passed: Successfully multi-filtered ${ffMaxPaidResults.tournaments.length} paid FF Max tournaments.`);

  // Test 4: Game mode stats aggregation
  console.log('\nTest 4: Verify getGameModeStats()');
  const stats = await TournamentService.getGameModeStats();
  if (stats.ff_max.totalCount < 1 || stats.sniper_1v1.totalCount < 1 || stats.headshot_only.totalCount < 1) {
    throw new Error('Game mode stats did not aggregate counts correctly.');
  }
  console.log('? Test 4 Passed: Game mode stats calculated accurately:', stats);

  console.log('\n?? ALL GAME MODE TESTS PASSED 100%!');
}

runGameModeTests().catch((err) => {
  console.error('? Test failed:', err);
  process.exit(1);
});
