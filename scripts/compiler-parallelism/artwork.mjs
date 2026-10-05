// Renders the compiler-parallelism animation (1920x1080 MP4 loop), its poster,
// and a 1200x630 link card from the measured text-2.1.4 compile traces.
// Run `node scripts/compiler-parallelism/artwork.mjs` for the still images, and
// `FFMPEG=/path/to/ffmpeg node scripts/compiler-parallelism/artwork.mjs` for the video.
import { readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { Resvg } from '@resvg/resvg-js';

const root = new URL('../../', import.meta.url);
const out = new URL('public/images/', root);
const result = JSON.parse(await readFile(new URL('public/benchmarks/text-compile-parallelism-m4-pro.json', root), 'utf8'));
const ghc = result.ghc.runs[result.ghc.median_run];
const aihc = result.aihc.runs[result.aihc.median_run];
const ghcTotal = ghc.total_s;
const aihcTotal = aihc.total_s;
const workers = aihc.workers;
const moduleCount = result.module_count;
const speedup = ghcTotal / aihcTotal;

const W = 1920, H = 1080, fps = 30;
const ink = '#292333', muted = '#6b655d', paper = '#faf8f3', purple = '#5e5086', gold = '#c48c41', green = '#39775b';
const kindFill = { package: '#cfc7bb', parse: '#ded5ee', resolve: '#bfaedd', typecheck: '#8f77ba', backend: purple };
const ghcFills = ['#e2b56e', '#c48c41'];
const x0 = 330, x1 = 1850;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const text = (x, y, value, size = 40, fill = ink, weight = 500, anchor = 'start') =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" font-weight="${weight}" fill="${fill}">${esc(String(value))}</text>`;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const ease = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);

// Axis extents: a tidy maximum just above each total.
const niceCeil = (v) => { const step = v > 20 ? 5 : v > 8 ? 2 : v > 4 ? 1 : 0.5; return Math.ceil(v / step) * step; };
const fullMax = niceCeil(ghcTotal + 0.5);
const zoomMax = niceCeil(aihcTotal + 0.2);

// Acts of the loop, in animation seconds.
const acts = [
  { name: 'intro', length: 0.8 },
  { name: 'ghc', length: 7 },      // GHC alone, full axis.
  { name: 'hold1', length: 0.8 },
  { name: 'both', length: 5 },     // Rematch: both from zero on the zoomed axis.
  { name: 'zoom', length: 2.2 },   // Zoom out while GHC keeps going.
  { name: 'final', length: 3.6 },
];
const duration = acts.reduce((sum, act) => sum + act.length, 0);

function state(time) {
  let t = time % duration;
  for (const act of acts) {
    if (t <= act.length) {
      const p = clamp(t / act.length, 0, 1);
      switch (act.name) {
        case 'intro': return { axisMax: fullMax, ghcT: 0, aihcT: null, caption: 'Same package. Same laptop. Two schedulers.' };
        case 'ghc': return { axisMax: fullMax, ghcT: p * ghcTotal, aihcT: null, caption: 'GHC: one module at a time, in dependency order.' };
        case 'hold1': return { axisMax: fullMax, ghcT: ghcTotal, aihcT: null, caption: 'GHC: one module at a time, in dependency order.' };
        case 'both': return { axisMax: zoomMax, ghcT: p * aihcTotal, aihcT: p * aihcTotal, caption: `Rematch. Zoomed in: ${workers} workers chew through the module graph.` };
        case 'zoom': {
          const e = ease(p);
          const axisMax = Math.exp(Math.log(zoomMax) + (Math.log(fullMax) - Math.log(zoomMax)) * e);
          return { axisMax, ghcT: aihcTotal + (ghcTotal - aihcTotal) * e, aihcT: aihcTotal, caption: 'Zooming out. GHC is still working.' };
        }
        default: return { axisMax: fullMax, ghcT: ghcTotal, aihcT: aihcTotal, caption: `${speedup.toFixed(1)}× less wall-clock for the same ${moduleCount} modules.` };
      }
    }
    t -= act.length;
  }
  return state(0);
}

const xOf = (sec, axisMax) => x0 + ((x1 - x0) * sec) / axisMax;

function axis(axisMax, y) {
  const step = axisMax > 20 ? 5 : axisMax > 8 ? 2 : axisMax > 4 ? 1 : 0.5;
  let body = `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="#b8afa1" stroke-width="3"/>`;
  for (let s = 0; s <= axisMax + 1e-9; s += step) {
    const x = xOf(s, axisMax);
    body += `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + 14}" stroke="#b8afa1" stroke-width="3"/>`;
    body += text(x, y + 52, `${Number.isInteger(s) ? s : s.toFixed(1)} s`, 30, muted, 500, 'middle');
  }
  return body;
}

function ghcBand(s) {
  const y = 232, rowY = 300, rowH = 96;
  const { ghcT, axisMax } = s;
  let body = text(40, y + 44, 'GHC 9.12.4', 46, gold, 750);
  body += text(40, y + 90, '1 module at a time', 30, muted, 500);
  body += `<rect x="${x0}" y="${rowY}" width="${x1 - x0}" height="${rowH}" rx="10" fill="#f3ece1"/>`;
  // Startup: dependency analysis and interface loading, before the first module.
  const startupEnd = ghc.modules[0].start_s;
  if (ghcT > 0) {
    const w = xOf(Math.min(ghcT, startupEnd), axisMax) - x0;
    body += `<rect x="${x0}" y="${rowY}" width="${Math.max(0, w)}" height="${rowH}" rx="10" fill="${kindFill.package}"/>`;
  }
  let current = null, done = 0;
  ghc.modules.forEach((m, i) => {
    if (ghcT <= m.start_s) return;
    const end = Math.min(ghcT, m.end_s);
    if (ghcT >= m.end_s) done++; else current = { ...m, index: i };
    const xa = xOf(m.start_s, axisMax), xb = xOf(end, axisMax);
    if (xb - xa > 0.5) body += `<rect x="${xa}" y="${rowY}" width="${xb - xa}" height="${rowH}" fill="${ghcFills[i % 2]}"/>`;
  });
  // A moving marker shows where the clock is.
  if (ghcT > 0 && ghcT < ghcTotal) {
    const x = xOf(ghcT, axisMax);
    if (x <= x1) body += `<rect x="${x - 3}" y="${rowY - 10}" width="6" height="${rowH + 20}" rx="3" fill="${ink}"/>`;
  }
  let status;
  if (ghcT <= 0) status = 'Waiting at the starting line.';
  else if (ghcT < startupEnd) status = 'Starting up: reading interfaces…';
  else if (current) status = `[${String(current.index + 1).padStart(2)} of ${moduleCount}] Compiling ${current.name}`;
  else if (ghcT >= ghcTotal) status = `All ${moduleCount} modules compiled. Linking…`;
  else status = `${done} of ${moduleCount} modules`;
  body += text(x0, y + 60, status, 36, ink, 600);
  body += text(x1, y + 60, `${Math.min(ghcT, ghcTotal).toFixed(1)} s`, 54, gold, 750, 'end');
  return body;
}

function aihcBand(s) {
  const y = 470, rowY = 540, rowH = 30, gap = 4;
  const { aihcT, axisMax } = s;
  let body = text(40, y + 44, 'AIHC', 46, purple, 750);
  body += text(40, y + 90, `${workers} workers`, 30, muted, 500);
  // Legend under the label.
  const legend = [['parse', 'parse'], ['resolve', 'resolve'], ['typecheck', 'type-check'], ['backend', 'backend']];
  legend.forEach(([kind, label], i) => {
    const ly = y + 150 + i * 44;
    body += `<rect x="40" y="${ly - 24}" width="30" height="30" rx="6" fill="${kindFill[kind]}"/>`;
    body += text(84, ly, label, 30, ink, 500);
  });
  for (let w = 0; w < workers; w++) {
    body += `<rect x="${x0}" y="${rowY + w * (rowH + gap)}" width="${x1 - x0}" height="${rowH}" rx="6" fill="#f0eafa"/>`;
  }
  let done = 0, active = 0;
  if (aihcT !== null) {
    for (const task of aihc.tasks) {
      if (aihcT <= task.start_s) continue;
      const end = Math.min(aihcT, task.end_s);
      if (task.kind === 'backend' && aihcT >= task.end_s) done += task.modules.length;
      if (aihcT < task.end_s && task.kind !== 'package') active++;
      const xa = xOf(task.start_s, axisMax), xb = xOf(end, axisMax);
      if (xb - xa > 0.4) body += `<rect x="${xa}" y="${rowY + (task.worker - 1) * (rowH + gap)}" width="${xb - xa}" height="${rowH}" fill="${kindFill[task.kind] ?? kindFill.package}"/>`;
    }
    if (aihcT > 0 && aihcT < aihcTotal) {
      const x = xOf(aihcT, axisMax);
      body += `<rect x="${x - 3}" y="${rowY - 10}" width="6" height="${workers * (rowH + gap) + 16}" rx="3" fill="${ink}"/>`;
    }
  }
  let status;
  if (aihcT === null) status = 'Waiting for its turn.';
  else if (aihcT <= 0) status = 'Ready.';
  else if (aihcT >= aihcTotal) status = `All ${moduleCount} modules compiled and archived.`;
  else status = `${done} of ${moduleCount} modules done · ${active} tasks running`;
  body += text(x0, y + 60, status, 36, ink, 600);
  body += text(x1, y + 60, aihcT === null ? '' : `${Math.min(aihcT, aihcTotal).toFixed(1)} s`, 54, purple, 750, 'end');
  // Final comparison in the space the short bars leave free.
  if (aihcT !== null && aihcT >= aihcTotal && s.axisMax >= fullMax - 1e-9) {
    const cx = (xOf(aihcTotal, axisMax) + x1) / 2 + 40;
    body += text(cx, rowY + 150, `${speedup.toFixed(1)}× less wall-clock`, 88, purple, 750, 'middle');
    body += text(cx, rowY + 215, `${aihcTotal.toFixed(1)} s against ${ghcTotal.toFixed(1)} s`, 44, ink, 600, 'middle');
    body += text(cx, rowY + 268, `Idle rows are idle cores. GHC left ${workers - 1} of them idle for the whole build.`, 30, muted, 500, 'middle');
  }
  return body;
}

export function frame(time) {
  const s = state(time);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<title>Compiling text-2.1.4: GHC on one core against AIHC on ${workers} workers</title>
<desc>Gantt chart of a measured build of the text library. GHC compiles ${moduleCount} modules one at a time in ${ghcTotal.toFixed(1)} seconds. AIHC runs parse, resolve, type-check and backend tasks across ${workers} workers and finishes in ${aihcTotal.toFixed(1)} seconds.</desc>
<rect width="${W}" height="${H}" fill="${paper}"/>
<g font-family="Arial,sans-serif">
${text(40, 72, 'AI HASKELL COMPILER', 32, purple, 650)}
${text(40, 150, `Compiling text-2.1.4 · ${moduleCount} modules`, 68, ink, 750)}
${text(40, 204, s.caption, 34, muted, 500)}
${ghcBand(s)}
${aihcBand(s)}
${axis(s.axisMax, 962)}
${text(40, 1050, `Apple M4 Pro, ${result.host.cores} cores · GHC: cabal default build (package -O2, no -j) · AIHC: default -O0 · real traces, medians of ${result.ghc.runs.length} runs`, 28, muted, 500)}
</g></svg>`;
}

const poster = frame(duration - 0.1);
await writeFile(new URL('compiler-parallelism-poster.svg', out), poster);
await writeFile(new URL('compiler-parallelism-poster.png', out), new Resvg(poster).render().asPng());

// Link card for social previews.
const social = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="${paper}"/>
<g font-family="Arial,sans-serif">
${text(60, 75, 'AI HASKELL COMPILER', 28, purple, 650)}
${text(60, 165, 'Compiling text-2.1.4', 66, ink, 750)}
${text(60, 275, `${speedup.toFixed(1)}× less wall-clock`, 92, purple, 750)}
${text(60, 335, `${moduleCount} modules · ${workers} workers against 1`, 40, ink, 650)}
${text(60, 415, `GHC 9.12.4: ${ghcTotal.toFixed(1)} s`, 40, gold, 650)}
${text(60, 470, `AIHC: ${aihcTotal.toFixed(1)} s`, 40, purple, 650)}
${text(60, 574, 'Apple M4 Pro · default settings · measured traces', 30, muted, 500)}
${(() => {
  // Miniature Gantt: one GHC row and the AIHC rows, to the same scale.
  const gx0 = 700, gx1 = 1140, scale = (gx1 - gx0) / fullMax;
  let body = `<rect x="${gx0}" y="150" width="${gx1 - gx0}" height="44" rx="6" fill="#f3ece1"/>`;
  ghc.modules.forEach((m, i) => { body += `<rect x="${gx0 + m.start_s * scale}" y="150" width="${(m.end_s - m.start_s) * scale}" height="44" fill="${ghcFills[i % 2]}"/>`; });
  for (let w = 0; w < workers; w++) body += `<rect x="${gx0}" y="${230 + w * 24}" width="${gx1 - gx0}" height="20" rx="4" fill="#f0eafa"/>`;
  for (const task of aihc.tasks) body += `<rect x="${gx0 + task.start_s * scale}" y="${230 + (task.worker - 1) * 24}" width="${Math.max(1.5, (task.end_s - task.start_s) * scale)}" height="20" fill="${kindFill[task.kind] ?? kindFill.package}"/>`;
  body += text(gx0, 136, 'GHC', 26, gold, 700) + text(gx0, 222, 'AIHC', 26, purple, 700);
  body += `<line x1="${gx0}" y1="530" x2="${gx1}" y2="530" stroke="#b8afa1" stroke-width="3"/>` + text(gx0, 566, '0 s', 26, muted, 500) + text(gx1, 566, `${fullMax} s`, 26, muted, 500, 'end');
  return body;
})()}
</g></svg>`;
await writeFile(new URL('compiler-parallelism-card.svg', out), social);
await writeFile(new URL('compiler-parallelism-card.png', out), new Resvg(social).render().asPng());

if (process.env.FFMPEG) {
  const encoder = spawn(process.env.FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-vcodec', 'png', '-framerate', String(fps), '-i', 'pipe:0', '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '21', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', new URL('compiler-parallelism.mp4', out).pathname], { stdio: ['pipe', 'inherit', 'inherit'] });
  const completed = once(encoder, 'exit');
  for (let i = 0; i < Math.round(duration * fps); i++) {
    const png = new Resvg(frame(i / fps)).render().asPng();
    if (!encoder.stdin.write(png)) await once(encoder.stdin, 'drain');
  }
  encoder.stdin.end();
  const [code] = await completed;
  if (code !== 0) throw new Error(`FFmpeg exited ${code}`);
}
console.log(`GHC ${ghcTotal.toFixed(2)} s, AIHC ${aihcTotal.toFixed(2)} s, ${speedup.toFixed(2)}x, loop ${duration.toFixed(1)} s`);
