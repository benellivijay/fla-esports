const fs = require('fs');
const path = require('path');
const db = require('./src/database/db');

console.log('=== STARTING COMPREHENSIVE COMMAND & SYSTEM AUDIT ===\n');

let totalCommands = 0;
let passedCommands = 0;
let errors = [];

function getFiles(dir, files = []) {
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getFiles(fullPath, files);
    } else if (file.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  return files;
}

const commandFiles = getFiles(path.join(__dirname, 'src', 'commands'));

for (const file of commandFiles) {
  const relPath = path.relative(__dirname, file);
  totalCommands++;
  try {
    const cmd = require(file);

    // Some helper files (like ReactionRoleEditor.js) are sub-modules
    if (!cmd.data && !cmd.execute && path.basename(file) === 'ReactionRoleEditor.js') {
      console.log(`[PASS] ${relPath} (Helper Component Module)`);
      passedCommands++;
      continue;
    }

    if (!cmd.data) {
      throw new Error(`Missing 'data' (SlashCommandBuilder) export.`);
    }
    if (!cmd.data.name) {
      throw new Error(`'data' missing 'name'.`);
    }
    if (!cmd.data.description) {
      throw new Error(`'data' missing 'description'.`);
    }
    if (typeof cmd.execute !== 'function') {
      throw new Error(`Missing or invalid 'execute' function export.`);
    }

    console.log(`[PASS] /${cmd.data.name.padEnd(16)} -> ${relPath}`);
    passedCommands++;
  } catch (err) {
    console.error(`[FAIL] ${relPath}: ${err.message}`);
    errors.push({ file: relPath, error: err.message, stack: err.stack });
  }
}

console.log(`\n=== COMMAND SUMMARY: ${passedCommands}/${totalCommands} PASSED ===`);

if (errors.length > 0) {
  console.error('\nErrors detected:');
  console.error(errors);
  process.exit(1);
} else {
  console.log('\nAll commands verified successfully with 0 errors!');
  process.exit(0);
}
