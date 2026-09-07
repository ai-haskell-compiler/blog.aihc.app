// Renders public/og.png (1200x630) from an inline SVG using the site's own fonts.
// Run with `npm run og` after changing the mark, colors, or wording.
import { Resvg } from '@resvg/resvg-js';
import { decompress } from 'wawoff2';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const fonts = [
  'node_modules/@fontsource-variable/newsreader/files/newsreader-latin-opsz-normal.woff2',
  'node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
];
const dir = await mkdtemp(join(tmpdir(), 'og-fonts-'));
const fontFiles = [];
for (const woff2 of fonts) {
  const ttf = join(dir, woff2.split('/').pop().replace('.woff2', '.ttf'));
  await writeFile(ttf, Buffer.from(await decompress(await readFile(woff2))));
  fontFiles.push(ttf);
}

const mark = `
  <defs><clipPath id="inner"><polygon points="18,18 62,18 40,88"/></clipPath></defs>
  <g fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round">
    <path d="M24 54 Q40 36 56 54" clip-path="url(#inner)" stroke-linecap="butt"/>
    <path d="M18 18 L40 88 L62 18"/><path d="M64 88 L79.1 40"/>
    <circle cx="86" cy="18" r="6" fill="#fff" stroke="none"/>
  </g>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#faf8f3"/>
  <rect x="0" y="622" width="1200" height="8" fill="#5e5086"/>
  <g transform="translate(96 150)">
    <rect width="240" height="240" rx="54" fill="#5e5086"/>
    <g transform="translate(28 28) scale(1.84)">${mark}</g>
  </g>
  <text x="400" y="262" font-family="Newsreader Variable, Newsreader, serif" font-size="88" fill="#1d1a17" letter-spacing="-1.5">AI Haskell Compiler</text>
  <text x="400" y="336" font-family="Inter Variable, Inter, sans-serif" font-size="32" fill="#6b655d">Weekly AI-written summaries of progress</text>
  <text x="400" y="382" font-family="Inter Variable, Inter, sans-serif" font-size="32" fill="#6b655d">on a Haskell compiler built with AI.</text>
  <text x="400" y="470" font-family="Inter Variable, Inter, sans-serif" font-size="28" fill="#5e5086">Read the journal at blog.aihc.app</text>
</svg>`;

const png = new Resvg(svg, { font: { fontFiles, loadSystemFonts: false, defaultFontFamily: 'Inter Variable' } }).render().asPng();
await writeFile('public/og.png', png);
console.log(`wrote public/og.png (${(png.length / 1024).toFixed(0)} kB)`);
