"""Compare ELF instruction streams and symbols, then execute both base archives."""
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

work, bundle, compiler, result_path = map(Path, sys.argv[1:5])
manifest = json.loads(Path('public/benchmarks/aihc-base-object-corpus.json').read_text())


def instructions(path):
    output = subprocess.check_output(['llvm-objdump', '-d', '--no-show-raw-insn', str(path)], text=True)
    values = []
    for line in output.splitlines():
        if not re.match(r'^\s+[0-9a-f]+:\s', line):
            continue
        value = line.split(':', 1)[1].strip()
        if re.match(r'^nop\w*\b', value):
            continue
        value = re.sub(r'\s+#.*|\s+<.*', '', value)
        value = re.sub(r'^((?:j\w+|callq?)\s+)0x[0-9a-f]+', r'\1<branch>', value)
        value = re.sub(r'-?0x[0-9a-f]+\(%rip\)', '(%rip)', value)
        value = ' '.join(value.split())
        value = re.sub(r'^(sh[lr]q|sarq) (%\w+)$', r'\1 $0x1, \2', value)
        values.append(value)
    return values


def symbols(path):
    output = subprocess.check_output(['llvm-nm', '-g', str(path)], text=True)
    return sorted(' '.join(line.split()[-2:]) for line in output.splitlines())


for i, item in enumerate(manifest['modules']):
    direct, asm = [work/mode/f'{i}.o' for mode in ('direct', 'asm')]
    if item['bytes'] == 0:
        assert direct.read_bytes() == asm.read_bytes() == b''
        continue
    left, right = instructions(direct), instructions(asm)
    if left != right:
        for j, (a, b) in enumerate(zip(left, right)):
            if a != b:
                print('First difference:', item['path'], j, a, b, flush=True)
                break
        raise AssertionError(f"Instruction mismatch: {item['path']} ({len(left)} vs {len(right)})")
    assert symbols(direct) == symbols(asm), 'Symbol mismatch: '+item['path']
link = json.loads((bundle/'link.json').read_text())
base_archive = next(p for p in link['archives'] if p.endswith('-libaihc-base.a'))
original = bundle/base_archive
members = subprocess.check_output(['ar', '-t', str(original)], text=True).splitlines()
wrappers = [p for p in members if p.endswith('.capi.o')]
wrap_dir = work/'capi'
wrap_dir.mkdir(exist_ok=True)
subprocess.run(['ar', '-x', str(original), *wrappers], cwd=wrap_dir, check=True)
expected = '338350\n[1,2,3,5,8]\n1267650600228229401496703205376\n3.75\n"AIHC BASE"\n'
outputs = {}
for mode in ('direct', 'asm'):
    destination = work/f'bundle-{mode}'
    shutil.copytree(bundle, destination, dirs_exist_ok=True)
    archive = destination/base_archive
    archive.unlink()
    objects = [work/mode/f'{i}.o' for i, item in enumerate(manifest['modules']) if item['bytes'] > 0]
    subprocess.run(['ar', '-rcs', str(archive), *map(str, objects), *map(str, wrap_dir.glob('*.o'))], check=True)
    executable = work/f'smoke-{mode}'
    subprocess.run([str(compiler), 'link-exe', str(destination), '-o', str(executable)], check=True)
    outputs[mode] = subprocess.check_output([str(executable)], text=True)
    assert outputs[mode] == expected, 'Smoke output mismatch: '+mode
result = json.loads(result_path.read_text())
result['validation'] = {
    'modules_checked': len(manifest['modules']),
    'nonempty_elf_objects_checked': len(manifest['modules'])-manifest['empty_modules'],
    'empty_outputs_equal': True,
    'normalized_decoded_instructions_equal': True,
    'instruction_normalization': 'Normalize implicit one-bit shifts. Ignore alignment NOPs, branch destination addresses, RIP-relative displacements and symbol annotations. ELF section layout and branch encodings differ. This does not independently verify every relocation or branch target.',
    'external_symbols_equal': True,
    'capi_wrappers_excluded_from_timing': len(wrappers),
    'linked_and_executed_both_complete_archives': True,
    'smoke_source': 'scripts/object-emission/BaseSmoke.hs',
    'smoke_expected_output': expected, 'smoke_outputs': outputs}
result_path.write_text(json.dumps(result, indent=2)+'\n')
print(json.dumps(result['validation'], indent=2))
