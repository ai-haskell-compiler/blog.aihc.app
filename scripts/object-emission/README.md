# Object output experiment

`Bench.hs` uses the existing assembly printers and object writers in AIHC.
No change to the compiler is necessary. The benchmark starts from the same
fully evaluated statement stream in each path. `workload.py` generates LIR
with exported functions, a data load, arithmetic, and an external call.

Use AIHC commit `c24d8798f04b8a62ad9ae84bca729922f87d9455`, GHC 9.12.4,
Python 3, Apple Clang, LLVM tools, and LLD. The measurements use an M4 Pro
MacBook. The ELF target is cross-assembled on macOS.

Use an AIHC development checkout with its Cabal dependencies installed.
From the blog checkout, compile the required backend modules and harness:

```sh
sh scripts/object-emission/build.sh /absolute/aihc /tmp/object-bench
```

The build uses GHC `-O2` for all required modules. It excludes unrelated
CLI and front-end modules. A fresh checkout can need
`cabal build lib:aihc --only-dependencies` first.

After the build completes, run this command in the blog checkout. Supply the
LLVM and LLD `bin` directories from the available Nix development environment.
Do not run other builds during the measurement.

```sh
python3 scripts/object-emission/run.py /tmp/object-bench/bench /absolute/aihc public/benchmarks/object-emission-m4-pro.json /absolute/llvm/bin /absolute/lld/bin
node scripts/object-emission/artwork.mjs
node scripts/object-emission/chart.mjs
```

The runner takes one untimed warmup per mode, then nine pairs with alternating
order. Each sample uses a fresh process with `+RTS -A16m`. Input parsing,
instruction selection, register allocation, statement evaluation, and an
explicit GC occur before the timer. The timer includes encoding or text
printing, output file writes, and the Clang invocation for the text path.
Clang uses its integrated assembler. The direct path does not invoke it.
File writes use a warm cache without `fsync`. These are elapsed times, not
CPU times or complete Haskell compilation times.

The preflight printer traversal forces each stream before the timer. Separate
`NOINLINE` functions prevent its text from being shared with the timed
printer. Each process emits only one measured object, so it cannot reuse an
object from an earlier iteration.

Validation compares decoded instructions and external symbols. It removes
local symbol annotations and unresolved call target addresses from the
instruction comparison. On ARM64, both objects link with a C harness and all
functions execute with independently calculated expected results. On ELF,
LLD resolves both objects against a C definition of the external function.
ELF executables are not run on the macOS host. Validation occurs after timing.
Object files need not match byte for byte: local names, symbol tables, and
section layouts differ.

The JSON contains all samples, medians, ranges, file sizes, corpus hashes,
tool versions, and validation results. The synthetic corpus isolates object
output. It does not establish a whole-compiler speedup or cover every
instruction, relocation, debugging feature, or object-format requirement.

The six-second SVG is a schematic loop, not a visualization of measured time.
It honors reduced-motion settings. The PNG is a static social preview.
