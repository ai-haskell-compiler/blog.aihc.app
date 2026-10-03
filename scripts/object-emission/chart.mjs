import { readFile, writeFile } from 'node:fs/promises';
import { Resvg } from '@resvg/resvg-js';
const root = new URL('../../', import.meta.url);
const cases = await Promise.all([
  ['aihc-base-object-emission-m4-pro.json', 'Apple M4 Pro · ARM64 / Mach-O'],
  ['aihc-base-object-emission-intel-nuc.json', 'Intel i7-8705G · AMD64 / ELF · Linux'],
].map(async ([file, label]) => ({
  label,
  data: JSON.parse(await readFile(new URL(`public/benchmarks/${file}`, root), 'utf8')),
})));
const max = Math.max(...cases.map(({ data }) => data.summary.asm.total_ms / 1000));
const colors = ['#5e5086', '#b3a28c'];
let body = '';
for (const [index, { label, data }] of cases.entries()) {
  const top = 300 + index * 310;
  body += `<text x="80" y="${top}" font-size="30" font-weight="700">${label}</text>`;
  for (const [i, row] of [
    { name: 'Direct object', value: data.summary.direct.total_ms / 1000 },
    { name: 'Text + assembler', value: data.summary.asm.total_ms / 1000 },
  ].entries()) {
    const y = top + 40 + i * 85;
    const width = Math.max(3, row.value / max * 830);
    body += `<text x="80" y="${y + 36}" font-size="28">${row.name}</text><rect x="365" y="${y}" width="${width}" height="56" rx="4" fill="${colors[i]}"/><text x="${385 + width}" y="${y + 37}" font-size="29" font-weight="600">${row.value.toFixed(2)} s</text>`;
  }
  body += `<text x="1490" y="${top + 78}" text-anchor="end" font-size="45" font-weight="700" fill="#5e5086">${data.summary.speedup.toFixed(1)}×</text>`;
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1030" viewBox="0 0 1600 1030"><title>Object output elapsed time for the complete aihc-base corpus on two hosts</title><rect width="1600" height="1030" fill="#faf8f3"/><rect y="1020" width="1600" height="10" fill="#5e5086"/><g font-family="Arial,sans-serif" fill="#292333"><text x="80" y="85" font-size="28" fill="#5e5086">AI HASKELL COMPILER · PERFORMANCE NOTES / 03</text><text x="80" y="174" font-size="67" font-weight="700">Skip the assembly round trip.</text><text x="80" y="225" font-size="28">aihc-base 4.21.2.0 at -O0 · median of nine passes · common time scale · lower is better</text>${body}<text x="80" y="880" font-size="27">270 module outputs · 176 nonempty · empty outputs handled identically</text><text x="80" y="965" font-size="24" fill="#6b655d">Object output only. Same frozen LIR corpus. Local Clang integrated assembler. Sequential passes.</text></g></svg>`;
await writeFile(new URL('public/images/object-emission-throughput.svg', root), svg);
await writeFile(new URL('public/images/object-emission-throughput.png', root), new Resvg(svg).render().asPng());
