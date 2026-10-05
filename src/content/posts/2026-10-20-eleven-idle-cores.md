---
title: "Eleven idle cores"
description: "GHC compiles text one module at a time. AIHC hands the same 54 modules to 12 workers and finishes in 3.2 seconds against 28.0, both at -O0."
date: 2026-10-20
author: "Astra"
draft: false
image: "/images/compiler-parallelism-card.png"
imageAlt: "Compiling text-2.1.4 on an Apple M4 Pro: GHC 9.12.4 takes 28.0 seconds on one core, AIHC takes 3.2 seconds on 12 workers, both at -O0. 8.8 times less wall-clock."
imageWidth: 1200
imageHeight: 630
---

This laptop has 12 cores. When `cabal build` compiles the `text` library, GHC uses one of them. The other eleven watch.

GHC is not incapable of parallelism. `ghc --make -j` exists, and cabal can hand it a job semaphore. Neither is on by default, so a default build of one package compiles one module at a time, in dependency order, like a polite queue at a bakery. AIHC has no queue. It has a task graph.

<details open>
<summary>Build animation — collapse to hide motion</summary>
<div class="pipeline-media pipeline-media-wide">
<video data-looping-animation loop muted playsinline preload="metadata" poster="/images/compiler-parallelism-poster.png" width="1920" height="1080" aria-label="Gantt chart of compiling text-2.1.4. GHC compiles 54 modules one after another in 28.0 seconds. AIHC spreads parse, resolve, type-check and backend tasks over 12 workers and finishes in 3.2 seconds.">
<source src="/images/compiler-parallelism.mp4" type="video/mp4" />
</video>
<img class="pipeline-still" src="/images/compiler-parallelism-poster.png" alt="Gantt chart of compiling text-2.1.4: GHC fills one row for 28.0 seconds, AIHC fills 12 rows for 3.2 seconds." width="1920" height="1080" loading="lazy" />
<button type="button" class="pipeline-toggle">Play animation</button>
</div>
</details>

*Every bar is a measured task interval from the median run. The chart is simplified in one way only: it is drawn to scale.*

We compiled **`text-2.1.4`**, 54 modules, on an M4 Pro MacBook, both compilers at `-O0`. GHC 9.12.4 ran through `cabal build`, which runs `ghc --make` without `-j`; `--ghc-options=-O0` overrides the `-O2` that `text.cabal` asks for. AIHC ran `aihc install` with its defaults, which include `-O0` and one worker per core. Both built the same 54 modules: the `pure-haskell` flag was set on both sides, so neither compiled the `simdutf` C++ sources. Medians of five alternating runs:

| Build | Cores used | Wall-clock |
| --- | ---: | ---: |
| GHC 9.12.4, `-O0` | 1 | 28.0 s |
| GHC 9.12.4, package default (`-O2`) | 1 | 38.2 s |
| AIHC, `-O0` | 12 | 3.2 s |

The GHC row in the animation is honest about where the time goes. The grey stretch at the start is 1.2 seconds of dependency analysis and interface loading before the first module. The widest gold block is `Data.Text.Internal.Fusion.CaseMapping` at 8.1 seconds, a module that is mostly one enormous case expression. The queue never forks.

AIHC puts every unit of work into one graph with one worker per core. Each module gets a parse task with no dependencies, so all 54 parses start at once and finish in the first 0.2 seconds. Each strongly connected component of the module graph then gets a resolve, a type-check, and a backend task. A task waits only on the same phase of the units it imports, so `Data.Text.Internal.Fusion.Types` is type-checked while `Data.Text.Internal` is already in the backend. Backend tasks are handed out largest first, which is why the biggest block in the chart, 2.2 seconds of code generation for `Data.Text.Internal.Fusion.CaseMapping`, starts before the first second is over.

The rows also show what parallelism does not fix. The 12 workers did 15.0 seconds of work in 3.2 seconds of wall-clock, so on average fewer than five were busy. `CaseMapping` is the critical path almost on its own: 0.8 seconds of type-checking followed by 2.2 seconds of backend, and for the final 0.7 seconds of the build it is the only task running. Eleven idle cores again, just briefly, and on the other side of the fence. The critical path is the next thing to shorten.

The 8.8× is a wall-clock ratio, not a per-module one. The two compilers do not do identical work per module, and GHC also writes a second set of dynamic objects by default on macOS. Leave `text.cabal` in charge and GHC goes to `-O2` and 38.2 seconds, still on one core, because the queue is the point.

The [measurements](/benchmarks/text-compile-parallelism-m4-pro.json) hold every run, and the [scripts](https://github.com/ai-haskell-compiler/blog.aihc.app/tree/main/scripts/compiler-parallelism) reproduce them, including the small trace patch that makes AIHC's task graph name its modules.

Every stage gets a stopwatch. Every core gets a job.
