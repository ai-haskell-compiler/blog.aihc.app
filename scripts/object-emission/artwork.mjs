import { readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { Resvg } from '@resvg/resvg-js';
const root = new URL('../../', import.meta.url);
const out = new URL('public/images/', root);
const result = JSON.parse(await readFile(new URL('public/benchmarks/aihc-base-object-emission-intel-nuc.json', root), 'utf8'));
const manifest = JSON.parse(await readFile(new URL('public/benchmarks/aihc-base-object-corpus.json', root), 'utf8'));
const modules = manifest.modules.filter(m => m.bytes).map(m => m.path.split('/').at(-1).replace(/\.o\.lir$/, ''));
const directSeconds = result.summary.direct.total_ms / 1000;
const asmSeconds = result.summary.asm.total_ms / 1000;
const duration = 14;
const fps = 30;
const ink = '#292333', purple = '#5e5086', green = '#39775b', gold = '#c48c41';
const text = (x,y,value,size=40,fill=ink,weight=500,anchor='middle') => `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" font-weight="${weight}" fill="${fill}">${value}</text>`;
const arrow = (x,y,length=44) => `<path d="M${x} ${y} v${length} m-10 -10 l10 10 10-10" fill="none" stroke="#b8afa1" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`;
const page = (x,y,label,color=purple,scale=1) => `<g transform="translate(${x} ${y}) scale(${scale})"><rect x="-40" y="-32" width="80" height="64" rx="9" fill="#fffdf8" stroke="${color}" stroke-width="3"/>${text(0,10,label,29,color,700)}</g>`;
const robot = (x,y,color,phase=0) => `<g transform="translate(${x} ${y})" stroke="${ink}" stroke-width="4" stroke-linejoin="round"><path d="M-61 6 Q-96 ${-22+phase*10} -87 -38 M61 6 Q96 ${-22-phase*10} 87 -38" fill="none"/><rect x="-64" y="-48" width="128" height="98" rx="25" fill="${color}"/><path d="M0 -48 v-20"/><circle cy="-73" r="7" fill="#edb45b"/><circle cx="-26" cy="-11" r="7" fill="${ink}"/><circle cx="26" cy="-11" r="7" fill="${ink}"/><path d="M-19 17 Q0 33 19 17" fill="none"/><path d="M-33 50 l-13 16 h-16 M33 50 l13 16 h16" fill="none"/></g>`;
function stack(x,y,count,color) {
  const ready = count === modules.length;
  let body = '';
  for (let i=3;i>=0;i--) body += `<rect x="${x-67+i*8}" y="${y-38-i*7}" width="134" height="70" rx="10" fill="${ready?'#e4f0e8':'#fffdf8'}" stroke="${color}" stroke-width="3"/>`;
  return body + text(x+4,y+8,'.o',43,color,700) + (ready ? `<circle cx="${x+85}" cy="${y-37}" r="23" fill="${green}"/><path d="m${x+73} ${y-37} 9 9 16-18" fill="none" stroke="white" stroke-width="4"/>` : '');
}
function lane(x,direct,elapsed,time) {
  const seconds = direct ? directSeconds : asmSeconds;
  const progress = Math.max(0,Math.min(1,elapsed/seconds));
  const count = Math.floor(progress*modules.length);
  const color = direct ? purple : gold;
  const center = x+238;
  const moduleName = modules[Math.min(count,modules.length-1)];
  const shortName = moduleName.length>27 ? moduleName.slice(0,25)+'…' : moduleName;
  const working = elapsed>0 && progress<1;
  const wiggle = working ? Math.sin(time*13) : 0;
  let body = `<rect x="${x}" y="354" width="476" height="652" rx="28" fill="${direct?'#f0eafa':'#f3ece1'}"/>`;
  body += text(center,409,direct?'Direct → .o':'Via ASM',53,color,750);
  body += text(center,451,progress===1?'All modules written':shortName,32,ink,600);
  body += robot(center,535,direct?'#c9b7e5':'#efc68d',wiggle);
  body += text(center,638,direct?'ELF writer':'Print .s',40,ink,650);
  if (direct) {
    body += text(center,687,'Encode + write',35,purple,650);
    body += arrow(center,715,36);
  } else {
    body += arrow(center,652,29);
    body += `<rect x="${x+69}" y="697" width="338" height="75" rx="18" fill="#efc68d" stroke="${ink}" stroke-width="3"/>`;
    body += text(center,748,'Clang ×176',40,ink,650);
    if (working) body += page(center+143,678,'.s',gold,0.64);
  }
  if (working) {
    const packet = (time*(direct?3.5:1.2))%1;
    const tokenY = direct ? 678+packet*130 : 779+packet*42;
    body += page(center+145,tokenY,direct?'IR':'.o',color,0.48);
  }
  body += stack(center,837,count,color);
  body += text(center,909,`${count} / ${modules.length} objects`,38,ink,650);
  body += `<rect x="${x+34}" y="932" width="408" height="12" rx="6" fill="#d8d0c3"/><rect x="${x+34}" y="932" width="${408*progress}" height="12" rx="6" fill="${color}"/>`;
  body += text(center,990,`${Math.max(0,Math.min(seconds,elapsed)).toFixed(2)} s`,57,color,750);
  return body;
}
export function frame(time) {
  const elapsed = Math.max(0,time-1);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350"><title>aihc-base: direct object output is ${result.summary.speedup.toFixed(1)} times faster on Intel Linux</title><desc>The same 270 module outputs take ${directSeconds.toFixed(2)} seconds directly or ${asmSeconds.toFixed(2)} seconds through assembly text and 176 Clang invocations. 94 empty modules are treated equally. Object output only. Module progress is illustrated.</desc><rect width="1080" height="1350" fill="#faf8f3"/><g font-family="Arial,sans-serif">${text(540,65,'AI HASKELL COMPILER',34,purple,650)}${text(540,158,'Compiling aihc-base',76,ink,750)}${text(540,217,'270 module outputs · same LIR',42,ink,600)}<rect x="44" y="243" width="992" height="83" rx="20" fill="#e8e2d7"/>${text(540,278,'Instructions ready. Output clock starts.',36,ink,600)}${text(540,311,'Data.List  ·  GHC.Base  ·  Control.Monad',31,'#6b655d')}${lane(44,false,elapsed,time)}${lane(560,true,elapsed,time)}${text(540,1100,`${result.summary.speedup.toFixed(1)}× faster`,94,purple,750)}${text(540,1155,'at object output',43,ink,650)}${text(540,1203,'Intel i7-8705G · Linux / ELF · 94 empty outputs',32,'#6b655d')}${text(540,1254,'Measured totals. Module progress illustrated.',32,'#6b655d')}${text(540,1301,'Direct output needs ELF + Mach-O writers.',34,purple,600)}</g></svg>`;
}
const poster = frame(12);
await writeFile(new URL('object-pipelines-phone-poster.svg',out),poster);
await writeFile(new URL('object-pipelines-phone-poster.png',out),new Resvg(poster).render().asPng());
// Keep a separate landscape preview for blog link cards.
const social = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#faf8f3"/><g font-family="Arial,sans-serif">${text(60,75,'AI HASKELL COMPILER',28,purple,650,'start')}${text(60,170,'Compiling aihc-base',66,ink,750,'start')}${text(60,282,`${result.summary.speedup.toFixed(1)}× faster`,100,purple,750,'start')}${text(60,345,'at object output',41,ink,650,'start')}${text(60,421,`Direct ELF: ${directSeconds.toFixed(2)} s`,40,purple,650,'start')}${text(60,480,`ASM + Clang: ${asmSeconds.toFixed(2)} s`,40,ink,650,'start')}${text(60,574,'270 module outputs · Intel i7-8705G · Linux',30,'#6b655d',500,'start')}${robot(955,244,'#c9b7e5')}${arrow(955,326,72)}${stack(955,470,176,purple)}</g></svg>`;
await writeFile(new URL('object-pipelines-poster.png',out),new Resvg(social).render().asPng());
// Optional FFmpeg export. Static posters need no video tools.
if (process.env.FFMPEG) {
  const encoder = spawn(process.env.FFMPEG,['-y','-loglevel','error','-f','image2pipe','-vcodec','png','-framerate',String(fps),'-i','pipe:0','-an','-c:v','libx264','-preset','medium','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',new URL('object-pipelines-phone.mp4',out).pathname],{stdio:['pipe','inherit','inherit']});
  const completed = once(encoder,'exit');
  for(let i=0;i<duration*fps;i++) {
    const png = new Resvg(frame(i/fps)).render().asPng();
    if(!encoder.stdin.write(png)) await once(encoder.stdin,'drain');
  }
  encoder.stdin.end();
  const [code] = await completed;
  if(code!==0) throw new Error(`FFmpeg exited ${code}`);
}
