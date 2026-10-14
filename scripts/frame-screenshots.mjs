// Puts app screenshots inside a phone frame (status bar, rounded screen, camera
// hole, side buttons) for the README and store listings.
//
//   node scripts/frame-screenshots.mjs <outDir> <name>=<screenshot> ...
//
// Each screenshot is a plain capture of the app's screen at any size; it is
// scaled to one width, and the status bar takes the colour of its top row.
import sharp from 'sharp';

const SW = 736;   // screen width
const SB = 64;    // status bar height
const R = 64;     // screen corner radius
const B = 20;     // bezel
const PAD = 8;    // room for the side buttons
const OUT_WIDTH = 720;

const [outDir, ...pairs] = process.argv.slice(2);
if (!outDir || pairs.length === 0) {
  console.error('Usage: node scripts/frame-screenshots.mjs <outDir> <name>=<screenshot> ...');
  process.exit(1);
}

const statusBar = (fill, ink) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${SW}" height="${SB}">
  <rect width="100%" height="100%" fill="${fill}"/>
  <text x="44" y="42" font-family="Segoe UI, Inter, Arial, sans-serif" font-size="25" font-weight="600" fill="${ink}">9:41</text>
  <circle cx="${SW / 2}" cy="32" r="13" fill="#0b0b0c" stroke="#1d1d20" stroke-width="3"/>
  <g fill="${ink}" transform="translate(${SW - 150} 20)">
    <rect x="0" y="16" width="5" height="8" rx="1"/><rect x="8" y="11" width="5" height="13" rx="1"/>
    <rect x="16" y="6" width="5" height="18" rx="1"/><rect x="24" y="1" width="5" height="23" rx="1"/>
    <path d="M44 9a20 20 0 0 1 26 0l-3 3.4a15.5 15.5 0 0 0-20 0z M49.5 15a12 12 0 0 1 15 0L57 24z"/>
    <rect x="82" y="3" width="36" height="19" rx="5" fill="none" stroke="${ink}" stroke-width="2.4"/>
    <rect x="86" y="7" width="24" height="11" rx="2"/><rect x="120" y="9" width="3" height="7" rx="1.5"/>
  </g>
</svg>`);

const body = (bw, bh) => {
  const cw = bw + 2 * PAD, ch = bh + 2 * PAD;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cw}" height="${ch}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#3a3a3e"/><stop offset=".5" stop-color="#1b1b1e"/><stop offset="1" stop-color="#34343a"/>
  </linearGradient></defs>
  <rect x="${cw - PAD - 2}" y="${PAD + 300}" width="${PAD + 2}" height="110" rx="3" fill="#2a2a2e"/>
  <rect x="${cw - PAD - 2}" y="${PAD + 460}" width="${PAD + 2}" height="190" rx="3" fill="#2a2a2e"/>
  <rect x="${PAD}" y="${PAD}" width="${bw}" height="${bh}" rx="${R + B}" fill="url(#g)"/>
  <rect x="${PAD + 3}" y="${PAD + 3}" width="${bw - 6}" height="${bh - 6}" rx="${R + B - 3}" fill="#08080a"/>
</svg>`);
};

for (const pair of pairs) {
  const [name, src] = pair.split('=');
  const shot = await sharp(src).resize({ width: SW }).png().toBuffer();
  const { height: shotH } = await sharp(shot).metadata();
  const { data } = await sharp(shot).extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
  const [r, g, b] = data;
  const fill = `rgb(${r},${g},${b})`;
  const ink = r * 0.299 + g * 0.587 + b * 0.114 > 140 ? '#111' : '#fff';

  const SH = SB + shotH;
  const screen = await sharp({ create: { width: SW, height: SH, channels: 4, background: fill } })
    .composite([{ input: statusBar(fill, ink), top: 0, left: 0 }, { input: shot, top: SB, left: 0 }])
    .png().toBuffer();
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${SW}" height="${SH}"><rect width="${SW}" height="${SH}" rx="${R}" fill="#fff"/></svg>`);
  const rounded = await sharp(screen).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  const framed = await sharp(body(SW + 2 * B, SH + 2 * B)).composite([{ input: rounded, top: PAD + B, left: PAD + B }]).png().toBuffer();
  const out = `${outDir}/${name}.png`;
  const info = await sharp(framed).resize({ width: OUT_WIDTH }).png({ compressionLevel: 9 }).toFile(out);
  console.log(`${out} ${info.width}x${info.height} ${Math.round(info.size / 1024)}KB`);
}
