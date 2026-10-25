const fs = require('node:fs');
const sharp = require('sharp');
// Geometric Sikhizm S, fully inside the maskable icon safe area.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="#0a0b10"/><rect x="76" y="76" width="360" height="360" rx="95" fill="#171b26" stroke="#fbbf24" stroke-width="8"/><path d="M328 176H218c-44 0-44 72 0 72h76c44 0 44 88 0 88H184" fill="none" stroke="#fbbf24" stroke-width="27" stroke-linecap="round"/><path d="M256 126v22m0 216v22" stroke="#fbbf24" stroke-width="8" stroke-linecap="round"/></svg>`;
fs.mkdirSync('public/icons', { recursive: true });
Promise.all([180,192,512].map(size => sharp(Buffer.from(svg)).resize(size,size).png().toFile(`public/icons/app-${size}.png`))).catch(error => { console.error(error); process.exitCode = 1; });
