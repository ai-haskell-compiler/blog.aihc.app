// Reproduce the status-report artwork: node scripts/status-2026-10.mjs
// Values are the README progress counters at aihc commit on 2026-10-06.
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
  const mark = `<defs><clipPath id="mark-inner"><polygon points="18,18 62,18 40,88"/></clipPath></defs>
    <g fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round">
      <path d="M24 54 Q40 36 56 54" clip-path="url(#mark-inner)" stroke-linecap="butt"/>
      <path d="M18 18 L40 88 L62 18"/><path d="M64 88 L79.1 40"/>
      <circle cx="86" cy="18" r="6" fill="#fff" stroke="none"/>
    </g>`;
  const rows = [
    { name: 'Preprocess', pass: 1, total: 1, label: 'done' },
    { name: 'Parse', pass: 1, total: 1, label: 'done' },
    { name: 'Resolve', pass: 122, total: 122, label: '122 / 122' },
    { name: 'Type check', pass: 376, total: 381, label: '376 / 381' },
    { name: 'Desugar', pass: 866, total: 917, label: '866 / 917' },
    { name: 'Codegen', pass: 237, total: 237, label: '237 / 237' },
    { name: 'ghc-prim shim', pass: 785, total: 5013, label: '785 / 5,013' },
    { name: 'base', pass: 2173, total: 10061, label: '2,173 / 10,061' },
    { name: 'Self-host', pass: 77, total: 77, label: '77 / 77 packages' },
  ];
  for (const card of [true]) {
    const height = card ? 840 : 1000;
    const rowH = card ? 48 : 66;
    const chartY = card ? 270 : 340;
    const x0 = 360, plotWidth = 900;
    const footerY = chartY + rows.length * rowH + (card ? 36 : 60);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="${height}" viewBox="0 0 1600 ${height}">
      <title>AIHC pipeline status, October 2026</title>
      <desc>Fixture pass rates and export coverage per compiler stage. Preprocess, parse, resolve, codegen and self-host complete; type check 98.7%; desugar 94.4%; ghc-prim 15.7%; base 21.6%.</desc>
      <rect width="1600" height="${height}" fill="#faf8f3"/>
      <rect y="${height - 10}" width="1600" height="10" fill="#5e5086"/>
      <g transform="translate(80 62)"><rect width="78" height="78" rx="18" fill="#5e5086"/><g transform="translate(9 9) scale(.6)">${mark}</g></g>
      <g font-family="Inter Variable, Inter, sans-serif" fill="#1d1a17">
        <text x="180" y="94" font-size="28" font-weight="600">AI Haskell Compiler</text>
        <text x="180" y="129" font-size="22" fill="#6b655d">STATUS REPORT / OCTOBER 2026</text>
        <text x="1520" y="106" font-size="25" text-anchor="end" fill="#5e5086">aihc.app</text>
        <text x="80" y="231" font-family="Newsreader Variable, Newsreader, serif" font-size="${card ? 64 : 72}" letter-spacing="-1">Compiles itself. Not yet Template Haskell.</text>
        ${rows.map((row, i) => {
          const y = chartY + i * rowH;
          const frac = row.pass / row.total;
          const full = frac >= 0.999;
          return `<text x="${x0 - 30}" y="${y + rowH * 0.62}" text-anchor="end" font-size="${card ? 26 : 30}" font-weight="600" fill="${full ? '#5e5086' : '#6b655d'}">${row.name}</text>
            <rect x="${x0}" y="${y + 8}" width="${plotWidth}" height="${rowH - 16}" rx="8" fill="#e6e0d6"/>
            <rect x="${x0}" y="${y + 8}" width="${Math.max(6, frac * plotWidth)}" height="${rowH - 16}" rx="8" fill="${full ? '#5e5086' : frac > 0.5 ? '#8f7fb8' : '#b0a69b'}"/>
            <text x="${x0 + plotWidth + 24}" y="${y + rowH * 0.62}" font-size="${card ? 24 : 27}" fill="#1d1a17">${row.label}</text>`;
        }).join('')}
        <line x1="80" x2="1520" y1="${footerY - 10}" y2="${footerY - 10}" stroke="#e6e0d6" stroke-width="2"/>
        <text x="80" y="${footerY + 26}" font-size="${card ? 22 : 24}" fill="#6b655d">Fixture pass rates and implemented exports from the aihc README · 2026-10-06 · self-host is the 77-package closure of aihc</text>
        <text x="1520" y="${height - 35}" font-size="22" text-anchor="end" fill="#5e5086">Typed by robots, designed by a human.</text>
      </g>
    </svg>`;
    const stem = `public/images/aihc-status-2026-10${card ? '-card' : ''}`;
    await writeFile(`${stem}.svg`, svg);
    const png = new Resvg(svg, {
      font: { fontFiles, loadSystemFonts: false, defaultFontFamily: 'Inter Variable' },
      ...(card ? { fitTo: { mode: 'width', value: 1200 } } : {}),
    }).render().asPng();
    await writeFile(`${stem}.png`, png);
    console.log(`${stem}.png: ${(png.length / 1024).toFixed(0)} KiB`);
  }
} finally {
  await rm(dir, { recursive: true, force: true });
}
