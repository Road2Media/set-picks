/**
 * Spoiler-free Phish IQ share card (#1276).
 * No song titles, no question text, no answers.
 *
 * Run: `node scripts/generate-phish-iq-og.mjs`
 */
import path from 'path';
import { fileURLToPath } from 'url';

import sharp from 'sharp';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const W = 1200;
const H = 630;
const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="58%" stop-color="#134e4a"/>
      <stop offset="100%" stop-color="#0369a1"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <text x="80" y="230" fill="#5eead4" font-family="DejaVu Sans, Liberation Sans, sans-serif" font-size="36" font-weight="700" letter-spacing="4">PHISH IQ</text>
  <text x="80" y="320" fill="#ffffff" font-family="DejaVu Sans, Liberation Sans, sans-serif" font-size="64" font-weight="700">A free daily Phish quiz</text>
  <text x="80" y="400" fill="#e2e8f0" font-family="DejaVu Sans, Liberation Sans, sans-serif" font-size="32">Five questions. A new quiz every day.</text>
  <text x="80" y="530" fill="#94a3b8" font-family="DejaVu Sans, Liberation Sans, sans-serif" font-size="24">Setlist Pick'Em. No answers on this card.</text>
</svg>`;

const png = path.join(root, 'public/branding/phish-iq-og.png');
const jpg = path.join(root, 'public/branding/phish-iq-og.jpg');

await sharp(Buffer.from(svg)).png().toFile(png);
await sharp(png).jpeg({ quality: 90, mozjpeg: true }).toFile(jpg);
console.log('Wrote', path.relative(root, png));
console.log('Wrote', path.relative(root, jpg));
