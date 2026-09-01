import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const testDir = __dirname;
const files = fs.readdirSync(testDir).filter(f => f.endsWith('.test.js'));

console.log(`\n🚀 Running all ${files.length} test suites...\n`);

let totalPassedSuites = 0;

for (const file of files) {
  console.log(`\n========================================`);
  console.log(`▶ Running Suite: ${file}`);
  console.log(`========================================`);
  try {
    execSync(`node "${path.join(testDir, file)}"`, { stdio: 'inherit' });
    totalPassedSuites++;
  } catch (error) {
    console.error(`❌ Suite failed: ${file}`);
    process.exit(1);
  }
}

console.log(`\n🎉 ALL ${totalPassedSuites}/${files.length} TEST SUITES PASSED CLEANLY!\n`);
