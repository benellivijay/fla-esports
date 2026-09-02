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

if (fs.existsSync(src)) {
  copyFolderSync(src, dstPublic);
  copyFolderSync(src, dstDist);
  console.log('Copied admin build to /public and /dist successfully!');
}
