# Compiler parallelism experiment

The October 20 post compares how GHC and AIHC schedule the modules of
`text-2.1.4` on one machine. Both compilers build the same 54 Haskell
modules: the `pure-haskell` cabal flag is set on both sides, so neither
compiles the `simdutf` C++ sources. Every other setting is the compiler's
default. The measurements were made on an Apple M4 Pro MacBook (12 cores)
with GHC 9.12.4, cabal-install 3.14.2.0, and AIHC commit
`c0d6acbff33576dea8bffc9eded08b6d7c32d2f9`.

## GHC

`cabal build lib:text` runs one `ghc --make` for the library. cabal-install
does not pass `-j` to GHC by default, and the `text.cabal` file sets `-O2`.
The GHC timeline comes from timestamping the `[ n of 54] Compiling` lines.
A module ends when the next one starts; the last module ends at
`Linking...`. The clock starts when cabal runs `ghc --make`, so the stretch
before the first module (dependency analysis and interface loading) is part
of the GHC total. A second series adds `--ghc-options=-O0` for comparison.

```sh
mkdir ghc && cd ghc && cabal get text-2.1.4
printf 'packages: text-2.1.4\npackage text\n  flags: +pure-haskell\n' > cabal.project
cd .. && sh scripts/compiler-parallelism/measure-ghc.sh ghc runs o2-1
sh scripts/compiler-parallelism/measure-ghc.sh ghc runs o0-1 --ghc-options=-O0
```

## AIHC

`aihc install` runs one task graph with one worker per capability
(`getNumCapabilities`, with `-N` in the RTS options). Each module gets a
parse task; each strongly connected component gets a resolve, type-check
and backend task that wait only on the units they import.

The graph records when every task starts and ends, but without the module
names. `aihc-task-trace.patch` adds a local-only trace: with
`AIHC_TASK_TRACE=FILE`, the graph appends one line per task with its
worker, kind, start and end (monotonic nanoseconds), and the installer names
each task's module(s). Apply the patch to the pinned commit, build
`exe:aihc`, and run from a directory that links `core-libs` to the checkout.
Install `text-2.1.4` once to fill the store with its dependencies; the
measured runs then use `--reinstall`, which rebuilds `text` alone.

```sh
mkdir -p work && ln -s /absolute/aihc/core-libs work/core-libs
sh scripts/compiler-parallelism/measure-aihc.sh /absolute/aihc-with-trace work store runs 1
```

## Series and output

Five rounds alternate GHC (package default), AIHC, and GHC at `-O0`. Nothing
else runs during a round. `parse-runs.py` turns the logs and traces into
`public/benchmarks/text-compile-parallelism-m4-pro.json`, with every run and
the index of the median run by total time:

```sh
python3 scripts/compiler-parallelism/parse-runs.py runs c0d6acbff33576dea8bffc9eded08b6d7c32d2f9 public/benchmarks/text-compile-parallelism-m4-pro.json
FFMPEG=/absolute/ffmpeg node scripts/compiler-parallelism/artwork.mjs
```

The animation is a 1920×1080 H.264 loop. Bars are the measured task
intervals of the median runs; nothing in the chart is drawn from a model.
Without `FFMPEG` the script writes only the poster and link card.
