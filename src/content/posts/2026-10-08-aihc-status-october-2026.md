---
title: "AIHC in October 2026: what it is, what works, what doesn't"
description: "A status report on the AI-written Haskell compiler. It compiles itself to a byte-identical binary. Template Haskell compiles and then fails at run time. Runtime is 2× behind GHC."
date: 2026-10-08
authors:
  - Claude
  - Lemmih
draft: false
image: "/images/aihc-status-2026-10-card.png"
imageAlt: "AIHC pipeline status, October 2026. Preprocess, parse, resolve, type-check and codegen are complete or nearly complete. ghc-prim and base shims are at 16% and 22% of exports. All 77 self-hosting packages install."
imageWidth: 1200
imageHeight: 630
---

AIHC is a Haskell compiler written by AI agents under human direction. It started in March 2026. As of this month it compiles itself, and the result compiles itself again to a byte-identical binary. It compiles `aeson`. It compiles the MicroHs compiler, which then also compiles itself. Template Haskell compiles and then fails at run time, the runtime is single-threaded, and at `-O2` the programs it produces run about 2× slower than GHC's. This post is the long version of that paragraph.

Everything here is dated October 7, 2026. The numbers come from the [README](https://github.com/ai-haskell-compiler/aihc), which regenerates them in CI, so the live page will drift from this post. That is the point of dating it.

## What AIHC is trying to be

Three goals, in priority order.

**GHC-compatible.** Nearly every package on Hackage is written for GHC. Not Haskell 2010 plus a few extensions, but GHC: `GHC.Prim`, `GHC.Exts`, `GHC.Generics`, unboxed tuples, the lot. A compiler that only accepts the language report can compile the language report and not much else. So AIHC accepts GHC's extensions and ships shims for the `GHC.*` modules. The target is the most recent GHC release, which is vague on purpose: GHC moves, and chasing a pinned version would mean falling behind Hackage. If `cabal install` works with current GHC, it should work with AIHC.

**Faster to run than GHC, in the places GHC is slow by design.** Three of them:

- *Multi-threaded compilation by default.* GHC compiles one module at a time unless you ask otherwise. AIHC schedules parse, resolve, type-check, and backend tasks over every core it can find. [We wrote that one up](/posts/2026-10-20-eleven-idle-cores/).
- *Whole-program optimization.* GHC optimizes one module at a time and leans on inlining across interface files. AIHC sees the whole program before it generates code. This is on today at `-O2` and `-Os`.
- *End-to-end ownership.* AIHC has its own preprocessor, parser, type checker, optimizer, object emitter, and runtime. No stage shells out to a tool it cannot change. When the preprocessor is the bottleneck, [we fix the preprocessor](/posts/2026-10-01-every-stage-counts/). When writing assembly text and parsing it back is the bottleneck, [we stop doing that](/posts/2026-10-13-skip-the-assembly-round-trip/).

**Reusable.** The compiler is a set of libraries ([aihc-cpp](https://github.com/ai-haskell-compiler/aihc-cpp), [aihc-parser](https://github.com/ai-haskell-compiler/aihc-parser), `aihc-resolve`, `aihc-tc`, and so on). Each one is meant to be usable without the rest.

What AIHC is not trying to be: a drop-in `ghc` binary with identical flags, error messages, or `.hi` files. Compatibility is at the level of source code and packages, not the command line.

## Why AI agents

I have written a Haskell compiler before. [LHC](https://github.com/Lemmih/lhc) got a long way on Haskell 2010 and stalled where every one-person Haskell compiler stalls: the point where "compatible with GHC" turns into reimplementing fifteen years of extensions, a `base` library with ten thousand exports, and a runtime that supports STM. I could not finish that by hand. Nobody can. But I know exactly how I want this compiler to work, down to the data structures, and it turns out that is the part agents cannot supply and the part I am good at.

So the division of labor is: I hold the architecture and review every change. Agents write the code. ChatGPT, Claude Opus, and Qwen-Coder all contribute, and all three are still in use. Agents also write the test fixtures, the benchmarks, the design documents, and, yes, this blog.

If you want the one-line version: the compiler is designed by a human and typed by robots.

## What works

**It compiles itself, twice.** GHC-built AIHC compiles AIHC. That AIHC compiles AIHC again. The two outputs are byte-for-byte identical. This is the standard three-stage bootstrap test, and it is a stronger claim than "the packages install": it means the compiler is deterministic and that nothing in the self-compiled binary is subtly wrong in a way that changes codegen.

The self-hosting list is the full dependency closure of the compiler: 77 packages from `OneTuple` up to `aihc`, all installing. It includes the packages people actually worry about: `bytestring`, `text`, `containers`, `vector`, `unordered-containers`, `mtl`, `transformers`, `parsec`, `megaparsec`, `optparse-applicative`, `QuickCheck`, `async`, `stm`, `time`, `directory`, `process`, `unix`.

**It compiles aeson.** `aeson` was [the goal for September](/posts/2026-10-02-aihc-highlights/) because it drags in `semigroupoids`, `witherable`, `scientific`, `th-abstraction`, and a lot of Generics. It installs.

**It compiles MicroHs, which compiles MicroHs.** Another Haskell compiler, written by a different person with different habits, compiles with AIHC. The AIHC-built MicroHs then compiles itself, byte-for-byte identical to the original. This is the closest thing we have to a test that was not written by us.

**Three backends.** Native machine code for AMD64 and ARM64, LLVM IR, and wasm32. Same GRIN-based middle end, same runtime, same garbage collector for all three. The native backend emits object files directly, with no assembler in the loop.

**A real runtime.** The runtime is C, about 0.4 MiB of it. The garbage collector is generational and incremental: the nursery path is a bump and a compare, each stop-the-world step has a bound that does not depend on the live heap, and the collector uses no threads and no atomics so the wasm32 backend runs the same code. Green threads and STM are implemented.

**Compile times.** At `-O0`, AIHC compiles the benchmark set in 0.16× GHC's wall-clock time on the native backend. That number is a geometric mean over 7 benchmarks on one machine and includes the parallelism win, so a single-core comparison would be less flattering. It is still the direction we want.

## What doesn't

**Template Haskell.** AIHC parses, type-checks, and compiles Template Haskell. Then the program fails at run time. So the feature exists in the pipeline and not in practice, which is the most frustrating kind of missing. Template Haskell is the single largest reason a Hackage package fails to build with AIHC today.

**Language features chosen by self-hosting.** Extensions were added in the order the compiler's own dependencies needed them. That order skipped `OrPatterns`, `Arrows`, and a tail of others. If your package uses something `aihc` itself does not, expect a parse or type error with a reasonably clear message and no fix.

**The runtime is single-threaded.** Green threads and STM run on one OS thread. `-threaded` does not exist.

**STM is preliminary.** The API is there and the self-hosting packages that depend on `stm` build and run. But a thread blocked in `retry` is not woken when the transactional variables it read are written, so a program that waits on STM waits for something else to wake it. There are probably more bugs of that kind. AIHC wants real STM. It is not a top priority this quarter.

**Runtime performance.** Lower is better, 1.00× is parity with GHC.

| Metric | Native | LLVM | Wasm |
| --- | ---: | ---: | ---: |
| Compile time `-O0` | 0.16× | 0.18× | 0.35× |
| Artifact size `-Os` | 0.09× | 0.11× | 0.57× |
| Runtime `-O1` | 11.8× | 11.8× | 27.6× |
| Runtime `-O2` | 2.05× | 2.11× | 4.13× |

Geometric mean over 7 benchmarks on an Apple M1 against GHC 9.14.1, commit [`9e7867a82`](https://github.com/ai-haskell-compiler/aihc/commit/9e7867a82020c2958b496ee14780bcfa0217a1d4), 2026-10-07. The Wasm column covers 6 benchmarks because MicroHs self-compilation is not measured there. GHC has no `-Os`, so the artifact-size row compares against GHC at `-O1`. Full history at [perf.aihc.app](https://perf.aihc.app/).

The `-O1` row looks like a typo. It is not. AIHC has three profiles it actually develops: `-O0` for compile speed, `-Os` for small binaries, `-O2` for fast ones. `-O1` is meant to balance all three and is by far the least developed, so today it is the worst of each. Use `-O2`. The `-O2` row is the real gap: 2× slower on native. That is the number to watch on [perf.aihc.app](https://perf.aihc.app/).

**`base` is a fifth of the way there.** Two thousand exports out of ten thousand. Packages that hit a missing one get a resolution error naming it, and the fix is usually a small PR, but there are eight thousand of those PRs left.

## Numbers

| | |
| --- | ---: |
| First commit | March 5, 2026 |
| Merged pull requests in `aihc` | 2,249 |
| Haskell source in `aihc` | 7.4 MiB |
| C source (runtime) | 0.4 MiB |
| Packages in the self-hosting closure | 77 |
| License | Unlicense |

Pull request count is for the main repository only. The preprocessor, parser, Cabal parser, Hackage client, and benchmarks live in their own repositories.

## What's next

1. **Fast enough to dogfood.** The near-term bar is developing AIHC with AIHC instead of GHC. Compile times already clear it. Runtime performance of the resulting compiler does not yet.
2. **Infrastructure that does not depend on GHC.** Documentation first: haddock.aihc.app will be generated entirely by AIHC's own tooling, with no GHC in the pipeline. The compiler is independent; the ecosystem around it is next.
3. **A multi-threaded runtime.** Green threads on one OS thread is where GHC was in 2004. The collector was designed without threads or atomics so it would be portable, which means it has to be redesigned to be parallel.
4. **`-O2` faster than GHC.** Not parity. Faster. Whole-program optimization is the lever, and it is already on; the remaining work is using it.

Template Haskell is not on this list. It will be on the list after this one.

## Following along

- Source: [github.com/ai-haskell-compiler/aihc](https://github.com/ai-haskell-compiler/aihc). The README's status tables regenerate on every merge.
- Performance history: [perf.aihc.app](https://perf.aihc.app/).
- Weekly notes: [this blog](/), every Friday.
- Chat: [Discord](https://discord.gg/uGWkhMCZrZ).
