// Reproduce the status-report card: node scripts/status-2026-10.mjs
// Shows the three-stage bootstrap described in the October 2026 status post.
import { Resvg } from '@resvg/resvg-js';
import { decompress } from 'wawoff2';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = await mkdtemp(join(tmpdir(), 'status-fonts-'));
try {
  const fontFiles = [];
  for (const file of [
    'node_modules/@fontsource-variable/newsreader/files/newsreader-latin-opsz-normal.woff2',
    'node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
  ]) {
    const target = join(dir, file.split('/').pop().replace('.woff2', '.ttf'));
    await writeFile(target, Buffer.from(await decompress(await readFile(file))));
    fontFiles.push(target);
  }
  await mkdir('public/images', { recursive: true });

  const P = '#5e5086', INK = '#1d1a17', MUTED = '#6b655d', LINE = '#e6e0d6', BG = '#faf8f3', BROWN = '#b07a2a';
  const serif = 'font-family="Newsreader Variable, Newsreader, serif"';
  const sans = 'font-family="Inter Variable, Inter, sans-serif"';
  const mark = `<defs><clipPath id="mark-inner"><polygon points="18,18 62,18 40,88"/></clipPath></defs>
    <g fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round">
      <path d="M24 54 Q40 36 56 54" clip-path="url(#mark-inner)" stroke-linecap="butt"/>
      <path d="M18 18 L40 88 L62 18"/><path d="M64 88 L79.1 40"/>
      <circle cx="86" cy="18" r="6" fill="#fff" stroke="none"/>
    </g>`;

  const box = (x, label, sub, highlight) => `
    <rect x="${x}" y="250" width="200" height="120" rx="18" fill="${highlight ? '#efeaf7' : '#ffffff'}" stroke="${highlight ? P : LINE}" stroke-width="3"/>
    <text x="${x + 100}" y="305" ${serif} font-size="40" text-anchor="middle" fill="${highlight ? P : INK}">${label}</text>
    <text x="${x + 100}" y="342" ${sans} font-size="17" text-anchor="middle" fill="${MUTED}">${sub}</text>`;
  const arrow = (x) => `
    <line x1="${x}" x2="${x + 70}" y1="310" y2="310" stroke="${MUTED}" stroke-width="3"/>
    <polygon points="${x + 70},310 ${x + 58},303 ${x + 58},317" fill="${MUTED}"/>
    <text x="${x + 35}" y="296" ${sans} font-size="14" text-anchor="middle" fill="${MUTED}">compiles</text>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <title>AIHC status, October 2026: it compiles itself, twice</title>
    <desc>GHC compiles AIHC stage 1, which compiles stage 2, which compiles stage 3. Stages 2 and 3 are byte-for-byte identical. 77 packages self-host; aeson and MicroHs build. Not yet: Template Haskell, -threaded, -O2 parity with GHC.</desc>
    <rect width="1200" height="630" fill="${BG}"/>
    <rect y="622" width="1200" height="8" fill="${P}"/>
    <g transform="translate(60 44)"><rect width="58" height="58" rx="13" fill="${P}"/><g transform="translate(7 7) scale(.44)">${mark}</g></g>
    <g ${sans}>
      <text x="134" y="68" font-size="21" font-weight="600" fill="${INK}">AI Haskell Compiler</text>
      <text x="134" y="94" font-size="16" fill="${MUTED}">STATUS REPORT / OCTOBER 2026</text>
      <text x="1140" y="78" font-size="19" text-anchor="end" fill="${P}">aihc.app</text>
      <text x="1140" y="592" font-size="17" text-anchor="end" fill="${P}">Typed by robots, designed by a human.</text>
    </g>
    <text x="60" y="176" ${serif} font-size="64" letter-spacing="-1" fill="${INK}">It compiles itself. Twice.</text>
    ${box(60, 'GHC', '9.14.1', false)}${arrow(260)}
    ${box(330, 'AIHC', 'stage 1', false)}${arrow(530)}
    ${box(600, 'AIHC', 'stage 2', true)}${arrow(800)}
    ${box(870, 'AIHC', 'stage 3', true)}
    <path d="M700 376 v26 h370 v-26" fill="none" stroke="${P}" stroke-width="3"/>
    <text x="885" y="428" ${sans} font-size="20" font-weight="600" text-anchor="middle" fill="${P}">byte-for-byte identical</text>
    <g ${sans} font-size="22" fill="${INK}">
      <text x="60" y="520"><tspan font-weight="600">77</tspan> packages self-host</text>
      <text x="360" y="520"><tspan font-weight="600">aeson</tspan> and <tspan font-weight="600">MicroHs</tspan> build</text>
      <text x="690" y="520"><tspan font-weight="600" fill="${BROWN}">Not yet:</tspan> Template Haskell, -threaded, -O2 parity</text>
    </g>
  </svg>`;

  const stem = 'public/images/aihc-status-2026-10-card';
  await writeFile(`${stem}.svg`, svg);
  const png = new Resvg(svg, { font: { fontFiles, loadSystemFonts: false, defaultFontFamily: 'Inter Variable' } }).render().asPng();
  await writeFile(`${stem}.png`, png);
  console.log(`${stem}.png: ${(png.length / 1024).toFixed(0)} KiB`);
} finally {
  await rm(dir, { recursive: true, force: true });
}
