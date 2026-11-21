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
<desc>A C compiler compiles a Haskell interpreter of ${thousands(cLines)} lines of C99. The interpreter runs AIHC from source, and that AIHC builds a native AIHC. The result is byte for byte identical to an AIHC built by a native AIHC.</desc>
<rect width="1200" height="630" fill="${paper}"/>
<rect y="622" width="1200" height="8" fill="${purple}"/>
<g transform="translate(60 44)"><rect width="58" height="58" rx="13" fill="${purple}"/><g transform="translate(7 7) scale(.44)">${mark('card-mark')}</g></g>
<g ${sans}>
  <text x="134" y="68" font-size="21" font-weight="600" fill="${ink}">AI Haskell Compiler</text>
  <text x="134" y="94" font-size="16" fill="${muted}">BOOTSTRAPPING FROM SOURCE</text>
  <text x="1140" y="78" font-size="19" text-anchor="end" fill="${purple}">aihc.app</text>
  <text x="1140" y="592" font-size="17" text-anchor="end" fill="${purple}">Typed by robots, designed by a human.</text>
</g>
<text x="60" y="176" ${serif} font-size="64" letter-spacing="-1" fill="${ink}">GHC not required.</text>
${box(60, 200, 'cc', 'buildable from a seed', false)}${arrow(260, 'compiles')}
${box(330, 250, 'Interpreter', `${thousands(cLines)} lines of C`, false)}${arrow(580, 'runs')}
${box(650, 200, 'AIHC', 'from source', true)}${arrow(850, 'builds')}
${box(920, 220, 'AIHC', 'native binary', true)}
<text x="600" y="424" ${sans} font-size="22" font-weight="600" text-anchor="middle" fill="${purple}">Every link is built from source. No pre-compiled executables.</text>
<text x="60" y="520" ${sans} font-size="24" fill="${ink}">The AIHC that comes out is <tspan font-weight="600">byte for byte identical</tspan> to one built by a native AIHC.</text>
</svg>`;
}

// ------------------------------------------------------------ vertical video

const W = 1080, H = 1920, fps = 30;
// When each part of the picture arrives, in seconds. Nothing leaves again:
// the last frame is the whole diagram.
const T = { ghc: 0.6, aihc: 4.2, seed: 8.6, cc: 10.4, interpreter: 12.8, join: 16.4, same: 19.6 };
const duration = 25;
const cx = 290, tx = 566;                    // diagram column, text column
const ghcRing = { y: 560, r: 96 }, aihcRing = { y: 920, r: 112 };
const boxes = { interpreter: { y: 1250, h: 112 }, cc: { y: 1440, h: 100 }, seed: { y: 1616, h: 92 } };

const shown = (t, at, length = 0.5) => ease((t - at) / length);

// A circle with an arrowhead on it and a dot going round: something that needs itself.
function ring(time, { y, r }, label, stroke, fill, dot) {
  const head = -0.6, hx = cx + r * Math.cos(head), hy = y + r * Math.sin(head);
  const tan = [-Math.sin(head), Math.cos(head)], nor = [Math.cos(head), Math.sin(head)];
  const pt = (along, across) => `${(hx + tan[0] * along + nor[0] * across).toFixed(1)},${(hy + tan[1] * along + nor[1] * across).toFixed(1)}`;
  const angle = time * 2.2, dx = cx + r * Math.cos(angle), dy = y + r * Math.sin(angle);
  return `<circle cx="${cx}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="6"/>
<polygon points="${pt(20, 0)} ${pt(-8, 15)} ${pt(-8, -15)}" fill="${stroke}"/>
<circle cx="${dx.toFixed(1)}" cy="${dy.toFixed(1)}" r="11" fill="${dot}"/>
<text x="${cx}" y="${y + 20}" ${serif} font-size="62" text-anchor="middle" fill="${stroke === purple ? purple : ink}">${label}</text>`;
}

function arrow(y0, y1, label, { dashed = false, side = 'right', color = muted } = {}) {
  // Drawn from (cx, y0) to (cx, y1); y1 above y0 points up.
  const dir = Math.sign(y1 - y0);
  return `<line x1="${cx}" x2="${cx}" y1="${y0}" y2="${y1 - dir * 14}" stroke="${color}" stroke-width="5"${dashed ? ' stroke-dasharray="10 10"' : ''}/>
<polygon points="${cx},${y1} ${cx - 12},${y1 - dir * 20} ${cx + 12},${y1 - dir * 20}" fill="${color}"/>
<text x="${side === 'right' ? cx + 24 : cx - 24}" y="${(y0 + y1) / 2 + 9}" ${sans} font-size="26" text-anchor="${side === 'right' ? 'start' : 'end'}" fill="${color}">${label}</text>`;
}

function box({ y, h }, title, sub) {
  const w = 400;
  return `<rect x="${cx - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="20" fill="#ffffff" stroke="${line}" stroke-width="4"/>
<text x="${cx}" y="${y - 2}" ${serif} font-size="44" text-anchor="middle" fill="${ink}">${title}</text>
<text x="${cx}" y="${y + 32}" ${mono} font-size="23" text-anchor="middle" fill="${muted}">${sub}</text>`;
}

// A note in the text column: a bold line and a few plain ones.
function note(y, bold, lines, color = ink) {
  return `<text x="${tx}" y="${y}" ${sans} font-size="33" font-weight="600" fill="${color}">${bold}</text>` +
    lines.map((l, i) => `<text x="${tx}" y="${y + 44 + i * 38}" ${sans} font-size="28" fill="${muted}">${l}</text>`).join('');
}

const group = (opacity, content) => (opacity <= 0 ? '' : `<g opacity="${opacity.toFixed(3)}">${content}</g>`);

function frame(time) {
  const t = Math.min(time, duration);
  const joined = shown(t, T.join, 0.8);       // 0 before the interpreter reaches AIHC, 1 after
  const old = 1 - 0.62 * joined;              // the GHC route fades, but stays

  let body = '';
  // The old way in: GHC, which needs GHC, compiles the first AIHC.
  body += group(shown(t, T.ghc) * old, ring(time, ghcRing, 'GHC', '#8a8378', '#ffffff', gold));
  body += group(shown(t, T.ghc + 0.7), note(516, 'GHC is written in Haskell.', ['It takes a GHC to build GHC.', 'The only way into that loop', 'is a pre-compiled binary.']));
  body += group(shown(t, T.aihc) * old, arrow(ghcRing.y + ghcRing.r + 10, aihcRing.y - aihcRing.r - 8, 'compiles', { side: 'left', dashed: joined > 0.5 }));
  body += group(shown(t, T.aihc + 0.4), ring(time, aihcRing, 'AIHC', joined > 0.5 ? purple : ink, joined > 0.5 ? '#efeaf7' : '#ffffff', purple));
  body += group(shown(t, T.aihc + 1.0), note(868, 'So is AIHC.', ['AIHC builds AIHC, but the', 'first one had to come out', 'of that GHC binary.']));

  // The new way in, from the bottom up: seed, C compiler, interpreter.
  body += group(shown(t, T.seed), box(boxes.seed, 'Seed', 'a few hundred bytes'));
  body += group(shown(t, T.cc), arrow(boxes.seed.y - boxes.seed.h / 2 - 6, boxes.cc.y + boxes.cc.h / 2 + 6, 'bootstraps') + box(boxes.cc, 'C compiler', 'built from source'));
  body += group(shown(t, T.cc + 0.6), note(1452, 'C has a way in.', ['A C compiler can be built', 'from a seed: machine code', 'small enough to read.']));
  body += group(shown(t, T.interpreter), arrow(boxes.cc.y - boxes.cc.h / 2 - 6, boxes.interpreter.y + boxes.interpreter.h / 2 + 6, 'compiles') + box(boxes.interpreter, 'Interpreter', `${thousands(cLines)} lines of C`));
  body += group(shown(t, T.interpreter + 0.6), note(1222, 'A Haskell interpreter in C.', ['It runs AIHC from source,', 'and that AIHC builds', 'a native AIHC.']));
  body += group(joined, arrow(boxes.interpreter.y - boxes.interpreter.h / 2 - 6, aihcRing.y + aihcRing.r + 10, 'runs', { color: purple }));
  body += group(joined, `<rect x="${cx + 26}" y="${(ghcRing.y + ghcRing.r + aihcRing.y - aihcRing.r) / 2 - 24}" width="196" height="48" rx="24" fill="${purple}"/>
<text x="${cx + 124}" y="${(ghcRing.y + ghcRing.r + aihcRing.y - aihcRing.r) / 2 + 9}" ${sans} font-size="25" font-weight="600" text-anchor="middle" fill="#ffffff">not required</text>`);
  body += group(shown(t, T.join + 0.6), note(1076, 'The loop has a new way in.', ['Every step is built from source.'], purple));

  // The result.
  body += group(shown(t, T.same), `<line x1="70" x2="${W - 70}" y1="1716" y2="1716" stroke="${line}" stroke-width="3"/>
<circle cx="112" cy="1794" r="38" fill="${green}"/><path d="M93 1795 l13 14 l26 -30" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
<text x="176" y="1786" ${sans} font-size="36" font-weight="600" fill="${ink}">Byte for byte the same AIHC</text>
<text x="176" y="1828" ${sans} font-size="27" fill="${muted}">as one built by a native AIHC, executable and all.</text>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<title>GHC not required: an interpreter in C breaks AIHC's bootstrap loop</title>
<desc>GHC is written in Haskell and takes a GHC to build, so the only way into that loop is a pre-compiled binary. AIHC is written in Haskell too, and the first AIHC had to come out of that GHC binary. Now a C compiler, which can itself be bootstrapped from a seed of a few hundred bytes, compiles an interpreter of ${thousands(cLines)} lines of C. The interpreter runs AIHC from source, and that AIHC builds a native AIHC, byte for byte the same as one built by a native AIHC. GHC is not required.</desc>
<rect width="${W}" height="${H}" fill="${paper}"/>
<rect y="${H - 12}" width="${W}" height="12" fill="${purple}"/>
<g transform="translate(70 84)"><rect width="76" height="76" rx="17" fill="${purple}"/><g transform="translate(9 9) scale(.58)">${mark('video-mark')}</g></g>
<text x="170" y="134" ${sans} font-size="32" font-weight="600" fill="${ink}">AI Haskell Compiler</text>
<text x="${W - 70}" y="134" ${sans} font-size="28" text-anchor="end" fill="${purple}">blog.aihc.app</text>
<text x="70" y="318" ${serif} font-size="112" letter-spacing="-2.5" fill="${ink}">GHC <tspan fill="${purple}">not required.</tspan></text>
<text x="70" y="388" ${sans} font-size="31" fill="${muted}">How a compiler written in Haskell gets built from source.</text>
${body}
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
    for (const [name, at] of Object.entries(T)) await writeFile(join(tmpdir(), `c-bootstrap-${name}.png`), render(frame(at + 2.2)));
  }
} finally {
  await rm(fontDir, { recursive: true, force: true });
}
console.log(`card, poster${process.argv.includes('--stills') ? '' : ' and video'} written; loop ${duration.toFixed(1)} s`);
