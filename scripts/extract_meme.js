const fs = require('node:fs');
const path = require('node:path');

const srcPath = 'C:/Users/Admin/.gemini/antigravity/brain/6a242e80-ad5d-4d45-831f-e03ea849e961/.user_uploaded/media_1787515690199.png';
const targetDir = path.join(__dirname, '..', 'assets', 'memes');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

if (fs.existsSync(srcPath)) {
  fs.copyFileSync(srcPath, path.join(targetDir, 'warning_card_reference.png'));
  console.log('Copied user reference image successfully');
}
