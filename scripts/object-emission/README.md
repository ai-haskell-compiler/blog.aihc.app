# Object output experiment

`Bench.hs` uses the existing assembly printers and object writers in AIHC.
The real-corpus benchmark adapts a copy of the fixture printer without changing
the compiler checkout. Both paths start from the same fully evaluated
statement stream. The complete aihc-base experiment is described below.
`workload.py` retains the original generated-function comparison.

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

The original synthetic runner takes one untimed warmup per mode, then nine pairs with alternating
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
Object files need not match byte for byte. Local names, symbol tables,
relocations, and section layouts differ.

The synthetic experiment JSON contains all samples, medians, ranges, file sizes, corpus hashes,
tool versions, and validation results. The synthetic corpus isolates object
output. It does not establish a whole-compiler speedup or cover every
instruction, relocation, debugging feature, or object-format requirement.

The six-second SVG is a schematic loop, not a visualization of measured time.
It honors reduced-motion settings. The PNG is a static social preview.

## Complete aihc-base corpus

The primary article now uses all 270 Haskell module outputs of `aihc-base`
4.21.2.0, compiled at `-O0` for `apple-arm64`. There are 176 nonempty LIR
files and 94 empty files. The comparison includes every file. Empty modules
write zero-byte output files in both modes, without an assembler invocation. Six C API
wrappers are outside the Haskell object-output comparison.

The base sources come from commit `c24d8798f04b8a62ad9ae84bca729922f87d9455`.
The corpus manifest records the local compiler's exact build tree and binary
hash separately from that source commit. The downloadable LIR archive fixes
the exact measured inputs, so another measurement does not require that local
compiler binary. The backend source used by the harness is also pinned to
`c24d8798f04b8a62ad9ae84bca729922f87d9455`.

The corpus came from this command in the pinned source checkout:

```sh
aihc install core-libs/aihc-base --store /tmp/base-store --build-root /tmp/base-build --keep-native --target apple-arm64 -O0
```

To reproduce object-output timing from the captured corpus, build the harness
with `build.sh`, then run these commands from the blog checkout:

```sh
mkdir -p /tmp/base-corpus
tar -xzf public/benchmarks/aihc-base-object-corpus.tar.gz -C /tmp/base-corpus
python3 scripts/object-emission/base-run.py /tmp/object-bench/bench /tmp/base-corpus public/benchmarks/aihc-base-object-emission-m4-pro.json /tmp/base-output
node scripts/object-emission/chart.mjs
```

`base-run.py` checks every input against the manifest before measurement.
Each pass produces one object per module. It loads, selects, and forces one
module's instructions before that module's timer. It then adds all module
output times. It does not retain the whole package's instruction streams.
The text path invokes Clang once per module. These are sequential output
stage times, not an end-to-end package build or a parallel build measurement.

The fixture printer needed target-specific corrections for this corpus. `patch-printer.py`
creates a benchmark-only source copy. A 32-bit floating-point move uses a W
register, not an X register. Constant loads use the encoder's shortest
MOVZ/MOVN/MOVK/ORR sequence, rather than an LDR pseudo-instruction that can
create extra literal pools. Both paths therefore encode the same instructions.
Relocatable pointer data uses `__DATA,__const`, as the direct writer does.
Numbered Darwin branch labels start with `L`, rather than `.L`. Named data
symbols retain their names so the assembler can put them in the GOT. The script does not modify the AIHC checkout.

`base-validate.py` checks all 270 outputs. It compares the external symbols
and instruction bytes of the 176 nonempty modules. It checks that both paths
write zero-byte files for the other 94 modules. For a same-object function branch, it resolves ARM64_BRANCH26
relocations before comparison. Clang can resolve such a branch during assembly,
while AIHC leaves it for the linker. This is an object representation difference.
It does not mask or ignore other instruction differences.

The execution check replaces the base archive in an AIHC `build --no-link`
bundle with each regenerated corpus. It preserves the six original C API
wrapper objects. `BaseSmoke.hs` exercises list traversal, sorting, arbitrary
precision integer arithmetic, floating-point output, and character conversion.
Both versions must match an independently specified output.

To prepare a smoke bundle, copy `BaseSmoke.hs` into the source checkout that
created the installed base library. Use the matching local compiler:

```sh
aihc build BaseSmoke.hs --target apple-arm64 --store /tmp/base-store --workspace core-libs --build-root /tmp/base-build -O0 --no-link -o /tmp/base-smoke-bundle
```

For that smoke bundle, run:

```sh
python3 scripts/object-emission/base-validate.py /tmp/base-output /tmp/base-smoke-bundle /absolute/aihc-binary public/benchmarks/aihc-base-object-emission-m4-pro.json
```

The original generated-function experiment remains in
`object-emission-m4-pro.json`. Its reproduction runner is `run.py`. Its results
are historical, rather than the primary figures in the scheduled article.
