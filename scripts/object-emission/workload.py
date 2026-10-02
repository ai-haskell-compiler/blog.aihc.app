"""Deterministic LIR corpus. No source parsing is inside the timer."""
from pathlib import Path


def generate(count):
    lines = ['extern func @sink(i64) -> i64 cc c',
             'export data @bias align 8 = { i64 7 }']
    for i in range(count):
        lines += [f'export func @bench{i}(%x: i64) -> i64 cc c {{', 'entry:',
                  '  %b = load i64 [@bias] align 8', '  %v0 = add i64 %x, %b']
        for j in range(1, 25):
            op = 'xor' if j % 2 else 'add'
            lines += [f'  %v{j} = {op} i64 %v{j-1}, {j+17}']
        lines += ['  %r = call @sink(%v24)', '  return %r', '}']
    return '\n'.join(lines) + '\n'


if __name__ == '__main__':
    import sys
    path = Path(sys.argv[1])
    path.mkdir(parents=True, exist_ok=True)
    for count in (1, 100, 5000):
        (path / f'{count}.lir').write_text(generate(count))
