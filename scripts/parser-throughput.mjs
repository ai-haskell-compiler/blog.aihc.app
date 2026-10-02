// Reproduce the blog/X artwork: node scripts/parser-throughput.mjs
// Throughput is the reciprocal of recorded relative parsing time (higher is better).
// Source: aihc-parser d9bef4c93df67b253008dda878e2cefecc4dc569, BENCHMARKS.md.
// Reported measurement commit: af5afc8d852e242f826f4302d98cbf52fc7eebe8.
import { Resvg } from '@resvg/resvg-js';
import { decompress } from 'wawoff2';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = await mkdtemp(join(tmpdir(), 'parser-chart-fonts-'));
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
  // Two independent layouts keep labels readable without cropping the chart.
  for (const card of [false, true]) {
    const height = card ? 800 : 900;
    const chartY = card ? 340 : 390;
    const footerY = card ? 681 : 754;
    const x0 = 340, plotWidth = 900, max = 2;
    const rows = [{ name: 'aihc-parser', value: 1 / 0.53, color: '#5e5086' }, { name: 'GHC', value: 1.00, color: '#b0a69b' }];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="${height}" viewBox="0 0 1600 ${height}">
      <title>aihc-parser versus GHC: Stackage parsing throughput</title>
      <desc>Relative parsing throughput: aihc-parser 1.89x, GHC (ghc-lib-parser) 1.00x.</desc>
      <rect width="1600" height="${height}" fill="#faf8f3"/>
      <rect y="${height - 10}" width="1600" height="10" fill="#5e5086"/>
      <g transform="translate(80 62)"><rect width="78" height="78" rx="18" fill="#5e5086"/><g transform="translate(9 9) scale(.6)">${mark}</g></g>
      <g font-family="Inter Variable, Inter, sans-serif" fill="#1d1a17">
        <text x="180" y="94" font-size="28" font-weight="600">AI Haskell Compiler</text>
        <text x="180" y="129" font-size="22" fill="#6b655d">PERFORMANCE NOTES / 02</text>
        <text x="1520" y="106" font-size="25" text-anchor="end" fill="#5e5086">aihc.app</text>
        <text x="80" y="231" font-family="Newsreader Variable, Newsreader, serif" font-size="76" letter-spacing="-1">Parsing is only the start.</text>
        <text x="82" y="282" font-size="28" fill="#6b655d">Haskell parsing · Stackage LTS 24.36 · 55,698 files</text>
        <rect x="1220" y="179" width="300" height="112" rx="18" fill="#eee9f7"/>
        <text x="1370" y="234" text-anchor="middle" font-size="43" font-weight="600" fill="#5e5086">1.9×</text>
        <text x="1370" y="268" text-anchor="middle" font-size="21" fill="#5e5086">parsing throughput</text>
        <text x="${x0}" y="${chartY - 30}" font-size="23" fill="#6b655d">Parsing throughput relative to GHC · higher is better</text>
        ${[0, 0.5, 1, 1.5, 2].map(v => `<line x1="${x0 + v / max * plotWidth}" x2="${x0 + v / max * plotWidth}" y1="${chartY}" y2="${chartY + 223}" stroke="#e6e0d6" stroke-width="2"/>
          <text x="${x0 + v / max * plotWidth}" y="${chartY + 263}" text-anchor="middle" font-size="22" fill="#6b655d">${v.toFixed(1)}</text>`).join('')}
        ${rows.map((row, i) => `<text x="${x0 - 36}" y="${chartY + 56 + i * 126}" text-anchor="end" font-size="34" font-weight="600" fill="${i ? '#6b655d' : '#5e5086'}">${row.name}</text>
          <rect x="${x0}" y="${chartY + 10 + i * 126}" width="${row.value / max * plotWidth}" height="72" rx="8" fill="${row.color}"/>
          <text x="${x0 + row.value / max * plotWidth + 22}" y="${chartY + 58 + i * 126}" font-size="40" font-weight="600">${row.value.toFixed(2)}×</text>`).join('')}
        <line x1="80" x2="1520" y1="${footerY - 27}" y2="${footerY - 27}" stroke="#e6e0d6" stroke-width="2"/>
        <text x="80" y="${footerY + 9}" font-size="24" fill="#6b655d">Nearly twice the throughput. Still only one stage.</text>
        <text x="80" y="${footerY + 46}" font-size="22" fill="#6b655d">Source: aihc-parser / BENCHMARKS.md</text>
        <text x="1520" y="${height - 35}" font-size="22" text-anchor="end" fill="#5e5086">Fast compilation needs fast type-checking, too.</text>
      </g>
    </svg>`;
    const stem = `public/images/aihc-parser-throughput${card ? '-card' : ''}`;
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
