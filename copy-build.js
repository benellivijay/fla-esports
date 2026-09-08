const fs = require('fs');
const path = require('path');

function copyFolderSync(from, to) {
  if (!fs.existsSync(to)) fs.mkdirSync(to, { recursive: true });
  fs.readdirSync(from).forEach(element => {
    const stat = fs.lstatSync(path.join(from, element));
    if (stat.isFile()) {
      fs.copyFileSync(path.join(from, element), path.join(to, element));
    } else if (stat.isDirectory()) {
      copyFolderSync(path.join(from, element), path.join(to, element));
    }
  });
}

const src = path.join(__dirname, 'admin_dashboard', 'out');
const dstPublic = path.join(__dirname, 'public');
const dstDist = path.join(__dirname, 'dist');
const dstBackendPublic = path.join(__dirname, 'backend', 'public');
const dstBackendDistPublic = path.join(__dirname, 'backend', 'dist', 'public');

if (fs.existsSync(src)) {
  copyFolderSync(src, dstPublic);
  copyFolderSync(src, dstDist);
  copyFolderSync(src, dstBackendPublic);
  copyFolderSync(src, dstBackendDistPublic);
  console.log('Copied admin build to /public, /dist, and /backend/public successfully!');
}

const gdriveSrc = path.join(__dirname, 'backend', 'gdrive_storage');
const gdriveDst = path.join(__dirname, 'gdrive_storage');
if (fs.existsSync(gdriveSrc)) {
  copyFolderSync(gdriveSrc, gdriveDst);
  console.log('Mirrored backend/gdrive_storage to root /gdrive_storage successfully!');
}

const seedSrc = path.join(__dirname, 'backend', 'data', 'seed_ff_esports.db');
const seedDst = path.join(__dirname, 'data', 'seed_ff_esports.db');
if (fs.existsSync(seedSrc)) {
  const seedDstDir = path.dirname(seedDst);
  if (!fs.existsSync(seedDstDir)) fs.mkdirSync(seedDstDir, { recursive: true });
  fs.copyFileSync(seedSrc, seedDst);
  console.log('Mirrored backend/data/seed_ff_esports.db to root /data/seed_ff_esports.db successfully!');
}

