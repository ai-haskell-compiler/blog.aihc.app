import { readFile, writeFile } from 'node:fs/promises';
import { Resvg } from '@resvg/resvg-js';
const root = new URL('../../', import.meta.url);
const data = JSON.parse(await readFile(new URL('public/benchmarks/aihc-base-object-emission-m4-pro.json', root), 'utf8'));
const direct = data.summary.direct.total_ms / 1000;
const asm = data.summary.asm.total_ms / 1000;
const max = asm;
const colors = ['#5e5086', '#b3a28c'];
let body = `<text x="80" y="320" font-size="30" font-weight="700">ARM64 / Mach-O</text>`;
for (const [i, row] of [{name:'Direct object',value:direct},{name:'Text + assembler',value:asm}].entries()) {
  const y = 375 + i * 105;
  body += `<text x="80" y="${y+36}" font-size="28">${row.name}</text><rect x="365" y="${y}" width="${Math.max(3,row.value/max*830)}" height="56" rx="4" fill="${colors[i]}"/><text x="${385+row.value/max*830}" y="${y+37}" font-size="29" font-weight="600">${row.value.toFixed(2)} s</text>`;
}
body += `<text x="1490" y="${425}" text-anchor="end" font-size="45" font-weight="700" fill="#5e5086">${data.summary.speedup.toFixed(1)}×</text><text x="80" y="645" font-size="27">270 module outputs · 176 nonempty · empty outputs handled identically</text>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="850" viewBox="0 0 1600 850"><title>Object output elapsed time for the complete aihc-base corpus</title><rect width="1600" height="850" fill="#faf8f3"/><rect y="840" width="1600" height="10" fill="#5e5086"/><g font-family="Arial,sans-serif" fill="#292333"><text x="80" y="85" font-size="28" fill="#5e5086">AI HASKELL COMPILER · PERFORMANCE NOTES / 03</text><text x="80" y="174" font-size="67" font-weight="700">Skip the assembly round trip.</text><text x="80" y="225" font-size="28">M4 Pro · aihc-base 4.21.2.0 at -O0 · median of nine passes · lower is better</text>${body}<text x="80" y="775" font-size="24" fill="#6b655d">Object output only. Same instruction streams. Clang integrated assembler. Sequential passes.</text></g></svg>`;
await writeFile(new URL('public/images/object-emission-throughput.svg', root), svg);
await writeFile(new URL('public/images/object-emission-throughput.png', root), new Resvg(svg).render().asPng());
