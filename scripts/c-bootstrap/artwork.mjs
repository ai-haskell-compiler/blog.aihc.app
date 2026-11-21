// Renders the artwork of the C bootstrap post from
// public/benchmarks/c-bootstrap-m4-pro.json: a 1200x630 link card, a
// 1080x1920 poster, and a vertical 1080x1920 H.264 loop for phones.
// `npm run render` runs this. The video uses the pinned ffmpeg-static
// binary, or the FFmpeg named by the FFMPEG environment variable.
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { decompress } from 'wawoff2';
import { Resvg } from '@resvg/resvg-js';
import ffmpegStatic from 'ffmpeg-static';

const root = new URL('../../', import.meta.url);
const out = new URL('public/images/', root);
const data = JSON.parse(await readFile(new URL('public/benchmarks/c-bootstrap-m4-pro.json', root), 'utf8'));

const cLines = data.interpreter.c_lines;
const ccSeconds = data.interpreter.build_wall_s;
const modules = data.aihc.modules;
const haskellLines = data.aihc.lines;
const build = data.self_build;
const files = build.identical_object_files;

const ink = '#1d1a17', muted = '#6b655d', paper = '#faf8f3', purple = '#5e5086', gold = '#b07a2a', green = '#39775b', line = '#e6e0d6';
const serif = 'font-family="Newsreader Variable, Newsreader, serif"';
const sans = 'font-family="Inter Variable, Inter, sans-serif"';
const mono = 'font-family="Inter Variable, Inter, sans-serif" font-feature-settings="\'tnum\'"';
const mark = (id) => `<defs><clipPath id="${id}"><polygon points="18,18 62,18 40,88"/></clipPath></defs>
  <g fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round">
    <path d="M24 54 Q40 36 56 54" clip-path="url(#${id})" stroke-linecap="butt"/>
    <path d="M18 18 L40 88 L62 18"/><path d="M64 88 L79.1 40"/>
    <circle cx="86" cy="18" r="6" fill="#fff" stroke="none"/>
  </g>`;

const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const ease = (p) => 1 - Math.pow(1 - clamp(p), 3);
const thousands = (n) => Math.round(n).toLocaleString('en-US');
// ---------------------------------------------------------------- link card

function card() {
  const box = (x, w, title, sub, highlight) => `
    <rect x="${x}" y="250" width="${w}" height="120" rx="18" fill="${highlight ? '#efeaf7' : '#ffffff'}" stroke="${highlight ? purple : line}" stroke-width="3"/>
    <text x="${x + w / 2}" y="305" ${serif} font-size="38" text-anchor="middle" fill="${highlight ? purple : ink}">${title}</text>
    <text x="${x + w / 2}" y="342" ${sans} font-size="17" text-anchor="middle" fill="${muted}">${sub}</text>`;
  const arrow = (x, label) => `
    <line x1="${x}" x2="${x + 70}" y1="310" y2="310" stroke="${muted}" stroke-width="3"/>
    <polygon points="${x + 70},310 ${x + 58},303 ${x + 58},317" fill="${muted}"/>
    <text x="${x + 35}" y="296" ${sans} font-size="14" text-anchor="middle" fill="${muted}">${label}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<title>GHC not required: AIHC bootstraps from a C compiler</title>
<desc>A C compiler compiles a Haskell interpreter of ${thousands(cLines)} lines of C99. The interpreter runs AIHC from source, and that AIHC builds a native AIHC. All ${thousands(files)} object files are byte for byte those of a native AIHC building the same sources.</desc>
<rect width="1200" height="630" fill="${paper}"/>
<rect y="622" width="1200" height="8" fill="${purple}"/>
<g transform="translate(60 44)"><rect width="58" height="58" rx="13" fill="${purple}"/><g transform="translate(7 7) scale(.44)">${mark('card-mark')}</g></g>
<g ${sans}>
  <text x="134" y="68" font-size="21" font-weight="600" fill="${ink}">AI Haskell Compiler</text>
  <text x="134" y="94" font-size="16" fill="${muted}">BOOTSTRAPPING FROM C, WITHOUT GHC</text>
  <text x="1140" y="78" font-size="19" text-anchor="end" fill="${purple}">aihc.app</text>
  <text x="1140" y="592" font-size="17" text-anchor="end" fill="${purple}">Typed by robots, designed by a human.</text>
</g>
<text x="60" y="176" ${serif} font-size="64" letter-spacing="-1" fill="${ink}">GHC not required.</text>
${box(60, 200, 'cc', 'any C99 compiler', false)}${arrow(260, 'compiles')}
${box(330, 250, 'Interpreter', `${thousands(cLines)} lines of C`, false)}${arrow(580, 'runs')}
${box(650, 200, 'AIHC', 'from source', true)}${arrow(850, 'builds')}
${box(920, 220, 'AIHC', 'native binary', true)}
<path d="M750 376 v26 h280 v-26" fill="none" stroke="${purple}" stroke-width="3"/>
<text x="890" y="428" ${sans} font-size="20" font-weight="600" text-anchor="middle" fill="${purple}">no GHC in the chain</text>
<g ${sans} font-size="22" fill="${ink}">
  <text x="60" y="520"><tspan font-weight="600">${thousands(files)} object files</tspan> byte for byte those of a native AIHC</text>
  <text x="760" y="520"><tspan font-weight="600" fill="${gold}">${build.packages} packages</tspan> in ${build.cpu_hours} h of CPU</text>
</g>
</svg>`;
}

// ------------------------------------------------------------ vertical video

const W = 1080, H = 1920, fps = 30;
// Acts of the loop, in seconds. Each act brings in one part of the picture.
const acts = [
  { name: 'problem', length: 2.6, caption: ['Only GHC could compile AIHC.', 'Every AIHC binary descended from GHC.'] },
  { name: 'cc', length: 2.2, caption: ['Not any more. Start with a C compiler.', ''] },
  { name: 'interpreter', length: 3.6, caption: ['Compile a small Haskell interpreter.', `${thousands(cLines)} lines of C99, built in ${ccSeconds.toFixed(1)} s.`] },
  { name: 'source', length: 3.6, caption: ['It runs AIHC straight from source.', `${modules} modules, ${thousands(haskellLines)} lines of Haskell.`] },
  { name: 'native', length: 3.0, caption: ['The interpreted AIHC builds AIHC.', `${build.packages} packages. Out comes a native compiler.`] },
  { name: 'proof', length: 4.2, caption: ['Slow is fine. Different is not.', 'Every object file matches a native AIHC.'] },
  { name: 'cost', length: 4.0, caption: ['It only has to be fast enough once.', `${build.cpu_hours} hours of processor time.`] },
  { name: 'final', length: 3.4, caption: ['A C compiler in. AIHC out. No GHC.', 'Read the deep-dive at blog.aihc.app'] },
];
const duration = acts.reduce((sum, act) => sum + act.length, 0);
const startOf = Object.fromEntries(acts.map((act, i) => [act.name, acts.slice(0, i).reduce((s, a) => s + a.length, 0)]));

const cards = [
  { act: 'cc', title: 'A C compiler', sub: 'cc -std=c99 -pedantic', arrow: 'compiles' },
  { act: 'interpreter', title: 'aihc-bootstrap', sub: (t) => `Haskell interpreter · ${thousands(cLines * ease((t - startOf.interpreter) / 2.2))} lines of C`, arrow: 'runs' },
  { act: 'source', title: 'AIHC, interpreted', sub: (t) => `${Math.round(modules * ease((t - startOf.source) / 2.2))} of ${modules} modules, from source`, arrow: 'builds' },
  { act: 'native', title: 'AIHC, native', sub: 'a compiler that then compiles itself', highlight: true },
];

function frame(time) {
  const t = time % duration;
  let act = acts[acts.length - 1];
  for (const a of acts) if (t >= startOf[a.name]) act = a;
  const into = t - startOf[act.name];
  const fade = clamp(into / 0.35);

  let body = '';
  // Chain of cards, one per act, stacked downwards.
  const cx = 540, cw = 860, ch = 156, cy0 = 516, pitch = 222;
  cards.forEach((c, i) => {
    const p = clamp((t - startOf[c.act]) / 0.5);
    if (p <= 0) return;
    const e = ease(p), y = cy0 + i * pitch + (1 - e) * 26;
    const sub = typeof c.sub === 'function' ? c.sub(t) : c.sub;
    body += `<g opacity="${e.toFixed(3)}">`;
    if (i > 0) {
      const ay = cy0 + (i - 1) * pitch + ch;
      body += `<line x1="${cx}" x2="${cx}" y1="${ay + 8}" y2="${ay + 46}" stroke="${muted}" stroke-width="4"/>`;
      body += `<polygon points="${cx},${ay + 58} ${cx - 10},${ay + 42} ${cx + 10},${ay + 42}" fill="${muted}"/>`;
      body += `<text x="${cx + 26}" y="${ay + 42}" ${sans} font-size="27" fill="${muted}">${cards[i - 1].arrow}</text>`;
    }
    body += `<rect x="${cx - cw / 2}" y="${y}" width="${cw}" height="${ch}" rx="24" fill="${c.highlight ? '#efeaf7' : '#ffffff'}" stroke="${c.highlight ? purple : line}" stroke-width="4"/>`;
    body += `<text x="${cx}" y="${y + 72}" ${serif} font-size="60" text-anchor="middle" fill="${c.highlight ? purple : ink}">${c.title}</text>`;
    body += `<text x="${cx}" y="${y + 120}" ${mono} font-size="30" text-anchor="middle" fill="${muted}">${sub}</text>`;
    body += '</g>';
  });

  // Proof: one square per object file, checked against a native AIHC's.
  const proofT = t - startOf.proof;
  if (proofT > 0) {
    const cols = 95, cell = 9, size = 7, gx = (W - cols * cell + (cell - size)) / 2, gy = 1452;
    const checked = Math.round(files * clamp(proofT / 3.0));
    const o = ease(proofT / 0.4).toFixed(3);
    body += `<g opacity="${o}">`;
    body += `<text x="${gx}" y="${gy - 24}" ${mono} font-size="30" font-weight="600" fill="${checked === files ? green : ink}">${thousands(checked)} of ${thousands(files)} object files identical</text>`;
    body += `<text x="${gx}" y="${gy + Math.ceil(files / cols) * cell + 34}" ${sans} font-size="26" fill="${muted}">${build.identical_archives} archives and the executable too</text>`;
    for (let i = 0; i < files; i++) {
      const x = gx + (i % cols) * cell, y = gy + Math.floor(i / cols) * cell;
      body += `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="2" fill="${i < checked ? green : '#e6e0d6'}"/>`;
    }
    body += '</g>';
  }

  // Cost: what the build takes.
  const costT = t - startOf.cost;
  if (costT > 0) {
    const stats = [[`${build.cpu_hours} h`, 'processor time'], [`${build.longest_chain_hours} h`, 'longest chain'], [`${build.peak_memory_gb} GB`, 'peak, one process']];
    stats.forEach(([value, label], i) => {
      const o = ease((costT - i * 0.5) / 0.5);
      if (o <= 0) return;
      const x = 110 + i * 300;
      body += `<g opacity="${o.toFixed(3)}"><text x="${x}" y="1746" ${serif} font-size="72" letter-spacing="-1" fill="${purple}">${value}</text>`;
      body += `<text x="${x}" y="1790" ${sans} font-size="27" fill="${muted}">${label}</text></g>`;
    });
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<title>GHC not required: AIHC bootstraps from a C compiler</title>
<desc>A C compiler compiles aihc-bootstrap, a Haskell interpreter of ${thousands(cLines)} lines of C99. The interpreter runs AIHC from source, and that AIHC builds a native AIHC. All ${thousands(files)} object files are byte for byte those of a native AIHC building the same sources. The build takes ${build.cpu_hours} hours of processor time.</desc>
<rect width="${W}" height="${H}" fill="${paper}"/>
<rect y="${H - 12}" width="${W}" height="12" fill="${purple}"/>
<g transform="translate(70 84)"><rect width="76" height="76" rx="17" fill="${purple}"/><g transform="translate(9 9) scale(.58)">${mark('video-mark')}</g></g>
<text x="170" y="134" ${sans} font-size="32" font-weight="600" fill="${ink}">AI Haskell Compiler</text>
<text x="70" y="266" ${serif} font-size="84" letter-spacing="-1.5" fill="${ink}">GHC</text>
<text x="70" y="354" ${serif} font-size="84" letter-spacing="-1.5" fill="${purple}">not required.</text>
<g opacity="${fade.toFixed(3)}">
  <text x="70" y="424" ${sans} font-size="34" font-weight="600" fill="${ink}">${act.caption[0]}</text>
  <text x="70" y="470" ${mono} font-size="31" fill="${muted}">${act.caption[1]}</text>
</g>
<text x="${W - 70}" y="134" ${sans} font-size="28" text-anchor="end" fill="${purple}">aihc.app</text>
${body}
<text x="${W / 2}" y="${H - 36}" ${sans} font-size="23" text-anchor="middle" fill="${muted}">${build.packages} packages at -O 0 · ${build.hackage_packages} from Hackage · sources pinned by SHA-256</text>
</svg>`;
}

// ------------------------------------------------------------------- output

// The site's own fonts are bundled so CI renders the same pixels as a laptop.
const fontDir = await mkdtemp(join(tmpdir(), 'c-bootstrap-fonts-'));
try {
  const fontFiles = [];
  for (const file of [
    'node_modules/@fontsource-variable/newsreader/files/newsreader-latin-opsz-normal.woff2',
    'node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
  ]) {
    const target = join(fontDir, file.split('/').pop().replace('.woff2', '.ttf'));
    await writeFile(target, Buffer.from(await decompress(await readFile(new URL(file, root)))));
    fontFiles.push(target);
  }
  const render = (svg) => new Resvg(svg, { font: { fontFiles, loadSystemFonts: false, defaultFontFamily: 'Inter Variable' } }).render().asPng();

  const social = card();
  await writeFile(new URL('c-bootstrap-card.svg', out), social);
  await writeFile(new URL('c-bootstrap-card.png', out), render(social));

  const poster = frame(duration - 0.1);
  await writeFile(new URL('c-bootstrap-phone-poster.svg', out), poster);
  await writeFile(new URL('c-bootstrap-phone-poster.png', out), render(poster));

  const ffmpeg = process.env.FFMPEG || ffmpegStatic;
  if (ffmpeg && !process.argv.includes('--stills')) {
    const encoder = spawn(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-vcodec', 'png', '-framerate', String(fps), '-i', 'pipe:0', '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', new URL('c-bootstrap-phone.mp4', out).pathname], { stdio: ['pipe', 'inherit', 'inherit'] });
    const completed = once(encoder, 'exit');
    for (let i = 0; i < Math.round(duration * fps); i++) {
      const png = render(frame(i / fps));
      if (!encoder.stdin.write(png)) await once(encoder.stdin, 'drain');
    }
    encoder.stdin.end();
    const [code] = await completed;
    if (code !== 0) throw new Error(`FFmpeg exited ${code}`);
  }
  if (process.argv.includes('--frames')) {
    for (const act of acts) await writeFile(join(tmpdir(), `c-bootstrap-${act.name}.png`), render(frame(startOf[act.name] + act.length - 0.05)));
  }
} finally {
  await rm(fontDir, { recursive: true, force: true });
}
console.log(`card, poster${process.argv.includes('--stills') ? '' : ' and video'} written; loop ${duration.toFixed(1)} s`);
