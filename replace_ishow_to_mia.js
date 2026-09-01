const fs = require('fs');
const path = require('path');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Replace case variations in text/comments/embeds:
  // "ISHOW" -> "𝐌𝐢𝐚 ⚚" (or "Mia" in commands/logs)
  // "ishow" -> "Mia"
  // "Ishow" -> "Mia"

  // Special cases:
  content = content.replace(/Auto setup via ISHOW Logging/g, 'Auto setup via Mia Logging');
  content = content.replace(/Auto setup via ishow Logging/g, 'Auto setup via Mia Logging');
  content = content.replace(/via ISHOW Logging/g, 'via Mia Logging');
  content = content.replace(/ISHOW \/\/ SERVER BRANDING/g, '𝐌𝐢𝐚 ⚚ // SERVER BRANDING');
  content = content.replace(/ISHOW/g, '𝐌𝐢𝐚 ⚚');
  content = content.replace(/ishow/g, 'Mia');
  content = content.replace(/Ishow/g, 'Mia');

  // Fix any accidental mangled paths or standard words if needed
  content = content.replace(/https:\/\/discord\.gg\/Mia/g, 'https://discord.gg/mia');
  content = content.replace(/https:\/\/Miabot\.xyz/g, 'https://miabot.xyz');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${filePath}`);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git') {
        walkDir(fullPath);
      }
    } else if (file.endsWith('.js') || file.endsWith('.sql')) {
      processFile(fullPath);
    }
  }
}

walkDir(path.join(__dirname, 'src'));
console.log('Finished updating files to Mia!');
