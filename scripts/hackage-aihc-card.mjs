// Renders the 1200x630 link card for the hackage.aihc.app post: the text-2.1.4
// package page on hackage.aihc.app (left) and hackage.haskell.org (right),
// split by the same divider the in-post comparison slider uses. The sides are
// swapped relative to the post so each half shows its own most typical part.
// Run with `node scripts/hackage-aihc-card.mjs` after replacing the screenshots.
import { Resvg } from '@resvg/resvg-js';
import { decompress } from 'wawoff2';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const fonts = ['node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2'];
const dir = await mkdtemp(join(tmpdir(), 'card-fonts-'));
const fontFiles = [];
for (const woff2 of fonts) {
  const ttf = join(dir, woff2.split('/').pop().replace('.woff2', '.ttf'));
  await writeFile(ttf, Buffer.from(await decompress(await readFile(woff2))));
  fontFiles.push(ttf);
}

const image = async name => `data:image/png;base64,${(await readFile(`public/images/hackage-aihc/${name}.png`)).toString('base64')}`;
const left = await image('pkg-aihc');
const right = await image('pkg-haskell');

// Screenshots are 2560x1600 (1280x800 CSS px at 2x). Show them at 1200x750, cropped to 630.
const split = 600;
const label = (x, anchor, text) => `
  <g font-family="Inter Variable, Inter, sans-serif" font-size="22" font-weight="600">
    <rect x="${anchor === 'end' ? x - 236 : x}" y="566" width="236" height="40" rx="20" fill="#1d1a17" fill-opacity="0.82"/>
    <text x="${anchor === 'end' ? x - 118 : x + 118}" y="593" text-anchor="middle" fill="#ffffff">${text}</text>
  </g>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <clipPath id="left"><rect width="${split}" height="630"/></clipPath>
    <clipPath id="right"><rect x="${split}" width="${1200 - split}" height="630"/></clipPath>
  </defs>
  <rect width="1200" height="630" fill="#faf8f3"/>
  <image href="${right}" xlink:href="${right}" width="1200" height="750" clip-path="url(#right)"/>
  <image href="${left}" xlink:href="${left}" width="1200" height="750" clip-path="url(#left)"/>
  <rect x="${split - 2}" width="4" height="630" fill="#ffffff"/>
  <circle cx="${split}" cy="315" r="26" fill="#5e5086" stroke="#ffffff" stroke-width="4"/>
  <path d="M${split - 6} 305 L${split - 14} 315 L${split - 6} 325 M${split + 6} 305 L${split + 14} 315 L${split + 6} 325" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  ${label(24, 'start', 'hackage.aihc.app')}
  ${label(1176, 'end', 'hackage.haskell.org')}
</svg>`;

const png = new Resvg(svg, { font: { fontFiles, loadSystemFonts: false, defaultFontFamily: 'Inter Variable' } }).render().asPng();
await writeFile('public/images/hackage-aihc-card.png', png);
console.log(`wrote public/images/hackage-aihc-card.png (${(png.length / 1024).toFixed(0)} kB)`);
