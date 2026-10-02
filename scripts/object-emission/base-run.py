"""Measure the complete frozen aihc-base corpus, one object per module."""
import datetime
import hashlib
import json
import platform
import statistics
import subprocess
import sys
from pathlib import Path

bench, corpus, output, work = map(Path, sys.argv[1:5])
manifest = json.loads(Path('public/benchmarks/aihc-base-object-corpus.json').read_text())
for item in manifest['modules']:
    assert hashlib.sha256((corpus/item['path']).read_bytes()).hexdigest() == item['sha256']
assert len(list(corpus.rglob('*.lir'))) == len(manifest['modules'])
work.mkdir(parents=True, exist_ok=True)
result = {'measured_at_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
          'hardware': subprocess.check_output(['sysctl','-n','machdep.cpu.brand_string'],text=True).strip(),
          'os': platform.platform(), 'target': 'arm64-apple-macos',
          'emitter_source_commit': manifest['base_source_commit'],
          'corpus_manifest': '/benchmarks/aihc-base-object-corpus.json',
          'corpus_archive_sha256': manifest['archive_sha256'],
          'modules': len(manifest['modules']), 'empty_modules': manifest['empty_modules'],
          'functions': manifest['total_functions'], 'lir_bytes': manifest['total_lir_bytes'],
          'ghc': subprocess.check_output(['ghc','--numeric-version'],text=True).strip(),
          'clang': subprocess.check_output(['clang','--version'],text=True).strip(),
          'printer_adjustments': '32-bit FMOV uses W registers. Constant loads use the encoder shortest MOVZ/MOVN/MOVK/ORR sequence instead of LDR literal pools. Read-only relocatable data uses __DATA,__const. Darwin temporary labels use L instead of .L.',
          'method': 'Complete aihc-base 4.21.2.0, compiled for apple-arm64 at -O0. '
                    'All 270 module outputs included. Empty modules write zero bytes in both modes, without an assembler invocation. Nine alternating-order pairs after one warmup per mode. '
                    'Fresh process per pass. One module stream at a time, fully forced before its timer. '
                    'Sum of per-module elapsed object-output time. GHC -O2 backend and harness, single capability, -A16m. '
                    'Includes output writes to warm filesystem cache, without fsync. '
                    'Text path includes printing and one Clang integrated assembler invocation per nonempty module. '
                    'Excludes front-end work, LIR parsing, instruction selection, preflight GC, harness startup, linking and validation.',
          'samples': []}


def run(mode, pair=None):
    directory = work / mode
    values = subprocess.check_output([str(bench),'arm64-apple-macos',mode,str(corpus),str(directory),'+RTS','-A16m','-RTS'],text=True).split()
    sample = {'mode':mode,'pair':pair,'emit_ms':float(values[0]),'assembler_ms':float(values[1]),'total_ms':float(values[0])+float(values[1]),'object_bytes':int(values[2])}
    return sample


for mode in ('direct','asm'):
    print('Warmup '+mode,flush=True)
    print(json.dumps(run(mode)),flush=True)
for pair in range(9):
    for mode in (('direct','asm') if pair%2==0 else ('asm','direct')):
        sample=run(mode,pair)
        result['samples'].append(sample)
        print(json.dumps(sample),flush=True)
        output.write_text(json.dumps(result,indent=2)+'\n')
result['summary']={}
for mode in ('direct','asm'):
    samples=[s for s in result['samples'] if s['mode']==mode]
    result['summary'][mode]={metric:statistics.median([s[metric] for s in samples]) for metric in ('emit_ms','assembler_ms','total_ms')}
    result['summary'][mode]['range_ms']=[min(s['total_ms'] for s in samples),max(s['total_ms'] for s in samples)]
result['summary']['speedup']=result['summary']['asm']['total_ms']/result['summary']['direct']['total_ms']
output.write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result['summary']),flush=True)
