import { writeFile } from 'node:fs/promises';
import { Resvg } from '@resvg/resvg-js';
const root = new URL('../../', import.meta.url);
const out = new URL('public/images/', root);
const robot = (x,y,label,color) => `<g transform="translate(${x} ${y})" stroke="#292333" stroke-width="3" stroke-linejoin="round"><path d="M-48 10 Q-72 0 -62 -24 M48 10 Q71 2 64 -22" fill="none"/><rect x="-47" y="-60" width="94" height="76" rx="19" fill="${color}"/><path d="M0 -60 v-15"/><circle cy="-79" r="5" fill="#edb45b"/><circle cx="-19" cy="-27" r="5"/><circle cx="19" cy="-27" r="5"/><path d="M-13 -10 Q0 2 13 -10" fill="none"/><path d="M-25 16 l-8 19 h-12 M25 16 l8 19 h12" fill="none"/><text y="67" text-anchor="middle" stroke="none" fill="#292333" font-size="23" font-weight="600">${label}</text></g>`;
const paper = `<rect x="-20" y="-26" width="40" height="52" rx="5" fill="#fffdf8" stroke="#292333" stroke-width="2"/><path d="M-10 -12 h20 M-10 -2 h20 M-10 8 h13" fill="none" stroke="#5e5086" stroke-width="3"/>`;
const box = (x,y,text) => `<g transform="translate(${x} ${y})"><rect x="-58" y="-32" width="116" height="64" rx="12" fill="#f0eafa" stroke="#292333" stroke-width="3"/><text text-anchor="middle" y="8" font-size="25" font-weight="600">${text}</text></g>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720">
<title>Skip the assembly text round trip</title><desc>Top: instructions pass through an assembly printer, a text file, and an assembler before reaching an object file. Bottom: a direct writer produces either ELF or Mach-O. The animation repeats every six seconds. Timing is schematic.</desc>
<style>text{font-family:Inter,Arial,sans-serif;fill:#292333}.travel{animation:travel 6s linear infinite}.direct{animation:direct 6s linear infinite}.done{animation:done 6s linear infinite}@keyframes travel{0%,8%{transform:translate(110px,248px)}30%{transform:translate(340px,248px)}50%{transform:translate(590px,248px)}74%{transform:translate(820px,248px)}92%,100%{transform:translate(1080px,248px)}}@keyframes direct{0%,8%{transform:translate(110px,510px)}28%{transform:translate(470px,510px)}45%,100%{transform:translate(990px,510px)}}@keyframes done{0%,44%{opacity:0}45%,100%{opacity:1}}@media(prefers-reduced-motion:reduce){.travel,.direct,.done{animation:none}.travel{transform:translate(590px,248px)}.direct{transform:translate(760px,510px)}.done{opacity:1}}</style>
<rect width="1200" height="720" rx="24" fill="#faf8f3"/>
<text x="55" y="67" font-size="39" font-weight="700">One destination. Fewer stops.</text><text x="55" y="105" font-size="21" fill="#6b655d">Object generation · schematic, not a timing scale</text>
<path d="M80 248 H1100 M80 510 H920 M920 510 L1025 455 M920 510 L1025 565" fill="none" stroke="#c9bfae" stroke-width="8" stroke-linecap="round"/>
<text x="55" y="162" font-size="20" font-weight="700">VIA ASSEMBLY TEXT</text><text x="55" y="424" font-size="20" font-weight="700" fill="#5e5086">DIRECT TO OBJECT</text>
${box(110,248,'code')}${robot(340,222,'printer','#efc68d')}${box(590,248,'.s')}${robot(820,222,'assembler','#efc68d')}${box(1080,248,'.o')}
${box(110,510,'code')}${robot(470,484,'object writer','#c9b7e5')}${box(1080,455,'ELF')}${box(1080,565,'Mach-O')}
<g class="travel">${paper}</g><g class="direct">${paper}</g>
<g class="done"><circle cx="825" cy="615" r="17" fill="#527a59"/><path d="m817 615 6 6 11-13" fill="none" stroke="white" stroke-width="3"/><text x="852" y="623" font-size="21">ready for the linker</text></g>
<text x="55" y="685" font-size="21">The shortcut needs a writer for each object format.</text></svg>`;
await writeFile(new URL('object-pipelines.svg', out), svg);
const staticSvg = svg.replace(/<style>[\s\S]*?<\/style>/, '<style>text{font-family:Arial,sans-serif;fill:#292333}</style>').replace(/<g class="(travel|direct)">[\s\S]*?<\/g>/g, '');
await writeFile(new URL('object-pipelines-poster.png', out), new Resvg(staticSvg).render().asPng());
