const fs = require('node:fs');
const sharp = require('sharp');
// Ik Onkar outline from the bundled ChatrikUni font. No installed font is required.
const svg = fs.readFileSync('public/icons/ik-onkar.svg');
async function generate() {
  await Promise.all([180, 192, 512].map(size => sharp(svg).resize(size, size).png().toFile(`public/icons/app-${size}.png`)));
  const png = await sharp(svg).resize(32, 32).png().toBuffer();
  const header = Buffer.alloc(22);
  header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
  header[6] = 32; header[7] = 32; header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12);
  header.writeUInt32LE(png.length, 14); header.writeUInt32LE(22, 18);
  fs.writeFileSync('src/app/favicon.ico', Buffer.concat([header, png]));
}
generate().catch(error => { console.error(error); process.exitCode = 1; });
