"""Turn the GHC logs and AIHC traces into one benchmark JSON.

Usage: parse-runs.py RUNSDIR AIHC_COMMIT OUTPUT_JSON
"""
import glob
import json
import os
import re
import sys
S = sys.argv[1]
runs = S

def parse_ghc(path):
    lines = [(float(l[:11]), l[11:].rstrip('\n')) for l in open(path) if re.match(r'\s*\d+\.\d+ ', l)]
    start = next(t for t, l in lines if 'Running: ' in l and ' --make ' in l)
    mods = []
    for t, l in lines:
        m = re.match(r'\s*\[\s*(\d+) of (\d+)\] Compiling (\S+)', l)
        if m: mods.append({'name': m.group(3), 'start_s': t})
    link = next(t for t, l in lines if l.strip() == 'Linking...')
    for i, m in enumerate(mods):
        m['end_s'] = mods[i+1]['start_s'] if i+1 < len(mods) else link
    for m in mods:
        m['start_s'] = round(m['start_s'] - start, 4); m['end_s'] = round(m['end_s'] - start, 4)
    return {'ghc_start_s': 0.0, 'first_module_s': mods[0]['start_s'], 'link_s': round(link - start, 4), 'total_s': round(link - start, 4), 'modules': mods}

KIND = {'TaskParse': 'parse', 'TaskResolve': 'resolve', 'TaskTypeCheck': 'typecheck', 'TaskBackend': 'backend', 'TaskPackage': 'package'}
def parse_aihc(path):
    names, tasks = {}, []
    for l in open(path):
        p = l.split()
        if not p: continue
        if p[0] == 'N': names[int(p[1])] = p[2] if len(p) > 2 else ''
        elif p[0] == 'T': tasks.append({'worker': int(p[1]), 'kind': KIND[p[2]], 'id': int(p[3]), 'start': int(p[4]), 'end': int(p[5])})
    t0 = min(t['start'] for t in tasks); t1 = max(t['end'] for t in tasks)
    out = []
    for t in sorted(tasks, key=lambda t: t['start']):
        label = names.get(t['id'], '')
        if t['kind'] == 'parse': label = re.sub(r'^.*?/src/', '', label).removesuffix('.hs').replace('/', '.')
        out.append({'worker': t['worker'], 'kind': t['kind'], 'modules': [m for m in label.split(',') if m], 'start_s': round((t['start']-t0)/1e9, 4), 'end_s': round((t['end']-t0)/1e9, 4)})
    return {'total_s': round((t1-t0)/1e9, 4), 'workers': max(t['worker'] for t in tasks), 'tasks': out}

def pick_median(rs):
    totals = sorted((r['total_s'], i) for i, r in enumerate(rs))
    return totals[len(totals)//2][1]

ghc = [parse_ghc(p) for p in sorted(glob.glob(os.path.join(runs, 'ghc-o0-*.log')))]
ghc2 = [parse_ghc(p) for p in sorted(glob.glob(os.path.join(runs, 'ghc-o2-*.log')))]
aihc = [parse_aihc(p) for p in sorted(glob.glob(os.path.join(runs, 'aihc-*.trace')))]
result = {
  'package': 'text-2.1.4', 'flags': {'pure-haskell': True, 'simdutf': False}, 'module_count': 54,
  'host': {'cpu': 'Apple M4 Pro', 'cores': 12, 'performance_cores': 8, 'efficiency_cores': 4, 'os': 'macOS (Darwin 25.6.0)'},
  'ghc': {'version': '9.12.4', 'cabal_version': '3.14.2.0', 'command': 'cabal build lib:text --ghc-options=-O0 (no -j; cabal passes --make -dynamic-too)', 'median_run': pick_median(ghc), 'runs': ghc},
  'ghc_O2': {'command': 'cabal build lib:text (package ghc-options -O2)', 'median_run': pick_median(ghc2) if ghc2 else None, 'runs': ghc2},
  'aihc': {'commit': sys.argv[2], 'command': 'aihc install text-2.1.4 --target apple-arm64 (default -O0, workers = getNumCapabilities with -N)', 'median_run': pick_median(aihc), 'runs': aihc},
}
json.dump(result, open(sys.argv[3], 'w'), indent=1)
for name, rs in (('ghc -O0', ghc), ('ghc -O2', ghc2), ('aihc', aihc)):
    print(name, [r['total_s'] for r in rs])
