"""Usage: python3 run.py BENCH AIHC OUTPUT_JSON [LLVM_BIN] [LLD_BIN]."""
import datetime
import hashlib
import json
import platform
import statistics
import subprocess
import sys
import tempfile
from pathlib import Path
from workload import generate


def command(args, **kwargs):
    return subprocess.check_output(list(map(str, args)), text=True, **kwargs).strip()


def validate(directory, count, target, llvm, lld):
    direct, asm = [directory / f'{target}-{count}-{mode}.o' for mode in ('direct', 'asm')]
    # Compare decoded instructions without symbol annotations or file headers.
    # Both paths can use different local symbol names and section layouts.
    import re
    def instructions(path):
        output = command([llvm / 'llvm-objdump', '-d', '--no-show-raw-insn', path])
        return [re.sub(r'\b(callq?|jmp|b|bl)\s+0x[0-9a-f]+', r'\1 <relocation>',
                       re.sub(r'\s+;.*|\s+#\s.*|\s+<.*', '', line.split(':', 1)[1]).strip())
                for line in output.splitlines() if re.match(r'^\s+[0-9a-f]+:\s', line)]
    assert instructions(direct) == instructions(asm), 'Instruction mismatch'
    def symbols(path):
        return sorted(' '.join(line.split()[-2:]) for line in
                      command([llvm / 'llvm-nm', '-g', path]).splitlines())
    assert symbols(direct) == symbols(asm), 'External symbol mismatch'
    if target == 'arm64-apple-macos':
        source = ['#include <stdio.h>', 'long sink(long x) { return x + 11; }']
        source += [f'extern long bench{i}(long);' for i in range(count)]
        source += ['int main(void) { long sum = 0;']
        source += [f'sum += bench{i}({i % 97});' for i in range(count)]
        source += ['printf("%ld\\n", sum); return 0; }']
        harness = directory / f'check-{count}.c'
        harness.write_text('\n'.join(source))
        harness_obj = directory / f'check-{count}.o'
        command(['clang', '-c', harness, '-o', harness_obj])
        expected = 0
        for i in range(count):
            value = i % 97 + 7
            for j in range(1, 25):
                value = value ^ (j+17) if j % 2 else value + j+17
            expected += value + 11
        for mode, obj in [('direct', direct), ('asm', asm)]:
            exe = directory / f'check-{count}-{mode}'
            command(['clang', harness_obj, obj, '-o', exe])
            assert int(command([exe])) == expected, 'Execution mismatch'
        return {'instructions_equal': True, 'external_symbols_equal': True,
                'linked_and_executed_both': True, 'checksum': expected}
    # Resolve both the data GOT relocation and the external call with an ELF linker.
    source = directory / 'sink.c'
    source.write_text('long sink(long x) { return x + 11; }\n')
    sink = directory / 'sink.o'
    command(['clang', '-target', target, '-ffreestanding', '-c', source, '-o', sink])
    for mode, obj in [('direct', direct), ('asm', asm)]:
        linked = directory / f'elf-linked-{count}-{mode}'
        command([lld / 'ld.lld', '-e', 'bench0', obj, sink, '-o', linked])
        assert not command([llvm / 'llvm-nm', '-u', linked]), 'Unresolved ELF symbol'
    return {'instructions_equal': True, 'external_symbols_equal': True,
            'linked_both_without_unresolved_symbols': True, 'executed': False}


bench, aihc, output = map(Path, sys.argv[1:4])
llvm = Path(sys.argv[4])
lld = Path(sys.argv[5])
result = {
    'aihc_commit': command(['git', '-C', aihc, 'rev-parse', 'HEAD']),
    'aihc_tracked_changes': command(['git', '-C', aihc, 'diff', '--name-only']),
    'hardware': command(['sysctl', '-n', 'machdep.cpu.brand_string']),
    'os': platform.platform(), 'ghc': command(['ghc', '--numeric-version']),
    'clang': command(['clang', '--version']),
    'llvm': command([llvm / 'llvm-objdump', '--version']).splitlines()[0],
    'measured_at_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'build': 'Required backend modules and harness compiled directly from AIHC source with GHC -O2',
    'method': 'One untimed warmup per mode. Nine alternating-order pairs per workload. '
              'Fresh process for each measurement. Statement stream fully forced before timer. '
              'Default single-capability RTS, +RTS -A16m. Wall time includes output file writes. '
              'ASM total includes text printing and clang integrated assembler invocation. '
              'Parsing, register allocation, instruction selection, process startup of harness, '
              'linking, validation and fsync excluded. Warm filesystem cache. '
              'ELF cross-assembled on macOS, not a Linux-host timing.',
    'workload': 'Synthetic LIR: exported C-convention functions, each loads a data symbol, '
                'performs 25 arithmetic operations and calls an external C function. '
                'No Haskell front-end work. Not representative of all programs.',
    'samples': [], 'summary': [], 'validation': []}
with tempfile.TemporaryDirectory(prefix='aihc-object-benchmark-') as temp:
    directory = Path(temp)
    for target in ('arm64-apple-macos', 'x86_64-unknown-linux-gnu'):
        for count in (1, 100, 5000):
            source = directory / f'{count}.lir'
            source.write_text(generate(count))
            digest = hashlib.sha256(source.read_bytes()).hexdigest()
            def run(mode):
                obj = directory / f'{target}-{count}-{mode}.o'
                values = command([bench, target, mode, source, obj, '+RTS', '-A16m', '-RTS']).split()
                first, second, size = float(values[0]), float(values[1]), int(values[2])
                return {'target': target, 'functions': count, 'mode': mode,
                        'emit_ms': first, 'assembler_ms': second,
                        'total_ms': first + second, 'object_bytes': size,
                        'asm_bytes': obj.with_suffix('.o.s').stat().st_size if mode == 'asm' else None}
            for mode in ('direct', 'asm'):
                run(mode)
            for pair in range(9):
                for mode in (('direct', 'asm') if pair % 2 == 0 else ('asm', 'direct')):
                    sample = run(mode)
                    sample['pair'] = pair
                    result['samples'].append(sample)
            check = validate(directory, count, target, llvm, lld)
            result['validation'].append({'target': target, 'functions': count, **check})
            summary = {'target': target, 'functions': count, 'source_sha256': digest}
            for mode in ('direct', 'asm'):
                samples = [s for s in result['samples'] if s['target'] == target and
                           s['functions'] == count and s['mode'] == mode]
                for metric in ('emit_ms', 'assembler_ms', 'total_ms'):
                    values = [s[metric] for s in samples]
                    summary[f'{mode}_{metric}'] = statistics.median(values)
                    if metric == 'total_ms':
                        summary[f'{mode}_range_ms'] = [min(values), max(values)]
                summary[f'{mode}_object_bytes'] = samples[0]['object_bytes']
            summary['speedup'] = summary['asm_total_ms'] / summary['direct_total_ms']
            result['summary'].append(summary)
            print(json.dumps(summary), flush=True)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2) + '\n')
