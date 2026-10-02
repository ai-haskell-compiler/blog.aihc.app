"""Validate both complete Mach-O corpora, then link and run the smoke program."""
import json
import shutil
import subprocess
import sys
from pathlib import Path
from macho import canonical_code, external_symbols

work, bundle, compiler, result_path = map(Path, sys.argv[1:5])
manifest = json.loads(Path('public/benchmarks/aihc-base-object-corpus.json').read_text())
for i, item in enumerate(manifest['modules']):
    direct, asm = [work/mode/f'{i}.o' for mode in ('direct','asm')]
    if item['bytes'] == 0:
        assert direct.read_bytes() == asm.read_bytes() == b''
        continue
    assert canonical_code(direct) == canonical_code(asm), 'Code mismatch: '+item['path']
    assert external_symbols(direct) == external_symbols(asm), 'Symbol mismatch: '+item['path']
link = json.loads((bundle/'link.json').read_text())
base_archive = next(p for p in link['archives'] if p.endswith('-libaihc-base.a'))
original = bundle/base_archive
members = subprocess.check_output(['ar','-t',str(original)],text=True).splitlines()
wrappers = [p for p in members if p.endswith('.capi.o')]
wrap_dir = work/'capi'
wrap_dir.mkdir(exist_ok=True)
subprocess.run(['ar','-x',str(original),*wrappers],cwd=wrap_dir,check=True)
expected = '338350\n[1,2,3,5,8]\n1267650600228229401496703205376\n3.75\n"AIHC BASE"\n'
outputs = {}
for mode in ('direct','asm'):
    destination = work/f'bundle-{mode}'
    shutil.copytree(bundle,destination,dirs_exist_ok=True)
    archive = destination/base_archive
    archive.unlink()
    objects = [work/mode/f'{i}.o' for i, item in enumerate(manifest['modules']) if item['bytes'] > 0]
    subprocess.run(['ar','-rcs',str(archive),*map(str,objects),*map(str,wrap_dir.glob('*.o'))],check=True)
    executable = work/f'smoke-{mode}'
    subprocess.run([str(compiler),'link-exe',str(destination),'-o',str(executable)],check=True)
    outputs[mode] = subprocess.check_output([str(executable)],text=True)
    assert outputs[mode] == expected, 'Smoke output mismatch: '+mode
result = json.loads(result_path.read_text())
result['validation'] = {'modules_checked':len(manifest['modules']),
                        'nonempty_macho_objects_checked':len(manifest['modules'])-manifest['empty_modules'],
                        'empty_outputs_equal':True,
                        'canonical_instruction_bytes_equal':True,
                        'external_symbols_equal':True,
                        'branch_normalization':'Resolve same-object ARM64_BRANCH26 relocations before comparing code bytes. Clang can resolve these during assembly.',
                        'capi_wrappers_excluded_from_timing':len(wrappers),
                        'linked_and_executed_both_complete_archives':True,
                        'smoke_source':'scripts/object-emission/BaseSmoke.hs',
                        'smoke_expected_output':expected,'smoke_outputs':outputs}
result_path.write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result['validation'],indent=2))
