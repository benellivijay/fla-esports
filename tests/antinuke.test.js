/**
 * ishow Bot - Automated Verification Test Suite
 */

const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

// Set in-memory or test database
process.env.DATABASE_PATH = ':memory:';

const db = require('../src/database/db');
const antinukeManager = require('../src/database/managers/AntinukeManager');
const moderationManager = require('../src/database/managers/ModerationManager');
const giveawayManager = require('../src/database/managers/GiveawayManager');
const featureManager = require('../src/database/managers/FeatureManager');
const guildManager = require('../src/database/managers/GuildManager');
const antinukeEngine = require('../src/antinuke/AntinukeEngine');
const spamTracker = require('../src/automod/SpamTracker');
const SafetyChecker = require('../src/antinuke/SafetyChecker');
const { ANTINUKE_CATEGORIES, PUNISHMENTS } = require('../src/config/constants');
const Logger = require('../src/utils/logger');

async function runTests() {
  console.log('\n=============================================');
  console.log('🧪 Running ishow Automated Test Suite');
  console.log('=============================================\n');

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`\x1b[32m✔ PASS:\x1b[0m ${name}`);
      passed++;
    } catch (err) {
      console.error(`\x1b[31m✖ FAIL:\x1b[0m ${name}`);
      console.error(`  Error: ${err.message}`);
      failed++;
    }
  }

  // 1. Database Schema & Managers Test
  test('Database initialization and default table creation', () => {
    const table = db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='guild_settings'");
    assert(table, 'Table guild_settings should exist');
  });

  test('AntinukeManager default limits population and retrieval', () => {
    const guildId = 'test_guild_123';
    const config = antinukeManager.getConfig(guildId);
    assert.strictEqual(config.enabled, 1, 'Antinuke should be enabled by default');

    const banLimit = antinukeManager.getLimit(guildId, ANTINUKE_CATEGORIES.BAN);
    assert.strictEqual(banLimit.limit_count, 3, 'Default ban limit should be 3');
    assert.strictEqual(banLimit.time_window_seconds, 10, 'Default ban window should be 10s');
    assert.strictEqual(banLimit.punishment, PUNISHMENTS.BAN, 'Default ban punishment should be ban');
  });

  test('AntinukeManager custom limits update', () => {
    const guildId = 'test_guild_123';
    antinukeManager.setLimit(guildId, ANTINUKE_CATEGORIES.BAN, 5, 20, PUNISHMENTS.KICK);
    const updated = antinukeManager.getLimit(guildId, ANTINUKE_CATEGORIES.BAN);
    assert.strictEqual(updated.limit_count, 5);
    assert.strictEqual(updated.time_window_seconds, 20);
    assert.strictEqual(updated.punishment, PUNISHMENTS.KICK);
  });

  test('Whitelist and Extra Owner persistence', () => {
    const guildId = 'test_guild_123';
    const userId = 'user_999';

    assert.strictEqual(antinukeManager.isWhitelisted(guildId, userId), false);
    antinukeManager.addWhitelist(guildId, userId, 'admin_111');
    assert.strictEqual(antinukeManager.isWhitelisted(guildId, userId), true);

    const list = antinukeManager.getWhitelist(guildId);
    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0].user_id, userId);

    antinukeManager.removeWhitelist(guildId, userId);
    assert.strictEqual(antinukeManager.isWhitelisted(guildId, userId), false);

    // Extra owner
    antinukeManager.addExtraOwner(guildId, userId, 'owner_001');
    assert.strictEqual(antinukeManager.isExtraOwner(guildId, userId), true);
    antinukeManager.removeExtraOwner(guildId, userId);
    assert.strictEqual(antinukeManager.isExtraOwner(guildId, userId), false);
  });

  // 2. Antinuke Sliding Window Engine Test
  test('AntinukeEngine sliding-window limit trigger for unwhitelisted member', () => {
    const guildId = 'test_guild_456';
    const rogueUser = 'rogue_user_1';

    antinukeManager.setLimit(guildId, ANTINUKE_CATEGORIES.BAN, 3, 10, PUNISHMENTS.BAN);

    // Action 1
    const res1 = antinukeEngine.recordAction(guildId, rogueUser, ANTINUKE_CATEGORIES.BAN);
    assert.strictEqual(res1.triggered, false);
    assert.strictEqual(res1.count, 1);

    // Action 2
    const res2 = antinukeEngine.recordAction(guildId, rogueUser, ANTINUKE_CATEGORIES.BAN);
    assert.strictEqual(res2.triggered, false);
    assert.strictEqual(res2.count, 2);

    // Action 3 -> Should trigger!
    const res3 = antinukeEngine.recordAction(guildId, rogueUser, ANTINUKE_CATEGORIES.BAN);
    assert.strictEqual(res3.triggered, true);
    assert.strictEqual(res3.limitCount, 3);
    assert.strictEqual(res3.punishment, PUNISHMENTS.BAN);
  });

  test('Antinuke SafetyChecker correctly identifies exemptions', async () => {
    const mockGuild = {
      id: 'test_guild_exemption',
      ownerId: 'server_owner_id',
      client: { user: { id: 'bot_id' } }
    };

    // Owner check
    const ownerExempt = await SafetyChecker.checkExemption(mockGuild, { id: 'server_owner_id' });
    assert.strictEqual(ownerExempt.exempt, true);
    assert.strictEqual(ownerExempt.reason, 'Guild Owner');

    // Bot check
    const botExempt = await SafetyChecker.checkExemption(mockGuild, { id: 'bot_id' });
    assert.strictEqual(botExempt.exempt, true);
    assert.strictEqual(botExempt.reason, 'Bot action');

    // Whitelisted user check
    antinukeManager.addWhitelist(mockGuild.id, 'whitelisted_user_id', 'server_owner_id');
    const wlExempt = await SafetyChecker.checkExemption(mockGuild, { id: 'whitelisted_user_id' });
    assert.strictEqual(wlExempt.exempt, true);
    assert.strictEqual(wlExempt.reason, 'Whitelisted User');

    // Random user check
    const normalCheck = await SafetyChecker.checkExemption(mockGuild, { id: 'random_user_id' });
    assert.strictEqual(normalCheck.exempt, false);
  });

  // 3. Automod & Spam Tracker Test
  test('SpamTracker burst rate limit detection', () => {
    const guildId = 'test_guild_spam';
    const userId = 'spammer_1';

    // 4 fast messages -> not spamming yet
    for (let i = 0; i < 4; i++) {
      assert.strictEqual(spamTracker.isSpamming(guildId, userId, 5, 2000), false);
    }

    // 5th message -> flagged as spam
    assert.strictEqual(spamTracker.isSpamming(guildId, userId, 5, 2000), true);
  });

  // 4. Giveaways Manager Test
  test('GiveawayManager lifecycle (create, enter, leave, end)', () => {
    const guildId = 'test_guild_gw';
    const msgId = 'gw_msg_001';

    giveawayManager.createGiveaway({
      guildId,
      channelId: 'ch_001',
      messageId: msgId,
      prize: 'Discord Nitro 1 Month',
      winnersCount: 1,
      endTime: Date.now() + 60000,
      hostId: 'host_01'
    });

    const gw = giveawayManager.getGiveaway(msgId);
    assert.strictEqual(gw.prize, 'Discord Nitro 1 Month');
    assert.strictEqual(gw.ended, 0);

    // Add participants
    giveawayManager.addParticipant(msgId, 'user_a');
    giveawayManager.addParticipant(msgId, 'user_b');
    const gwAfter = giveawayManager.getGiveaway(msgId);
    assert.strictEqual(gwAfter.participants.length, 2);

    // Remove participant
    giveawayManager.removeParticipant(msgId, 'user_a');
    const gwRemoved = giveawayManager.getGiveaway(msgId);
    assert.strictEqual(gwRemoved.participants.length, 1);
    assert.strictEqual(gwRemoved.participants[0], 'user_b');

    // End giveaway
    giveawayManager.endGiveaway(msgId);
    const gwEnded = giveawayManager.getGiveaway(msgId);
    assert.strictEqual(gwEnded.ended, 1);
  });

  // 5. Verify All Slash Commands Load Cleanly
  test('Verify all slash command files compile without errors', () => {
    const commandsDir = path.join(__dirname, '..', 'src', 'commands');
    let count = 0;

    function verifyDir(dir) {
      const files = fs.readdirSync(dir, { withFileTypes: true });
      for (const file of files) {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory()) {
          verifyDir(fullPath);
        } else if (file.name.endsWith('.js')) {
          const cmd = require(fullPath);
          assert(cmd.data, `Command ${file.name} missing data property`);
          assert(typeof cmd.execute === 'function', `Command ${file.name} missing execute function`);
          count++;
        }
      }
    }

    verifyDir(commandsDir);
    assert(count >= 15, `Expected at least 15 commands, found ${count}`);
    console.log(`    (Verified ${count} slash command definitions)`);
  });

  console.log('\n=============================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('=============================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
