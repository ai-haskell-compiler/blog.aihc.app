import { readFile, writeFile } from 'node:fs/promises';
import { Resvg } from '@resvg/resvg-js';
const root = new URL('../../', import.meta.url);
const data = JSON.parse(await readFile(new URL('public/benchmarks/object-emission-m4-pro.json', root), 'utf8'));
const rows = data.summary.filter(r => r.functions === 5000);
const max = Math.max(...rows.map(r => r.asm_total_ms));
const colors = ['#5e5086', '#b3a28c'];
let body = '';
for (const [i, row] of rows.entries()) {
  const y = 320 + i * 220;
  const name = i === 0 ? 'ARM64 / Mach-O' : 'AMD64 / ELF';
  body += `<text x="80" y="${y}" font-size="30" font-weight="700">${name}</text>`;
  for (const [j, mode] of ['direct', 'asm'].entries()) {
    const yy = y + 35 + j * 68;
    const value = row[`${mode}_total_ms`];
    body += `<text x="80" y="${yy+33}" font-size="25">${mode === 'direct' ? 'Direct object' : 'Text + assembler'}</text><rect x="365" y="${yy}" width="${Math.max(3,value/max*830)}" height="46" rx="4" fill="${colors[j]}"/><text x="${385+value/max*830}" y="${yy+32}" font-size="26" font-weight="600">${value.toFixed(1)} ms</text>`;
  }
  body += `<text x="1490" y="${y+82}" text-anchor="end" font-size="39" font-weight="700" fill="#5e5086">${row.speedup.toFixed(1)}×</text>`;
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="850" viewBox="0 0 1600 850"><title>Object output elapsed time, 5,000 generated functions</title><rect width="1600" height="850" fill="#faf8f3"/><rect y="840" width="1600" height="10" fill="#5e5086"/><g font-family="Arial,sans-serif" fill="#292333"><text x="80" y="85" font-size="28" fill="#5e5086">AI HASKELL COMPILER · PERFORMANCE NOTES / 03</text><text x="80" y="174" font-size="67" font-weight="700">Skip the assembly round trip.</text><text x="80" y="225" font-size="28">M4 Pro · 5,000 generated functions · median of nine runs · lower is better</text>${body}<text x="80" y="775" font-size="24" fill="#6b655d">Object output only. Same instruction stream. Clang integrated assembler. ELF cross-assembled on macOS.</text></g></svg>`;
await writeFile(new URL('public/images/object-emission-throughput.svg', root), svg);
await writeFile(new URL('public/images/object-emission-throughput.png', root), new Resvg(svg).render().asPng());
