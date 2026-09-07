---
title: "AIHC in 28 days: faster library builds, lazy parsing, and a collector comeback"
description: "A reported 75-to-5-second base rebuild, deferred parser work, and the LLVM optimization that removed garbage collector roots."
date: 2026-09-04
draft: false
---

This first-Friday retrospective covers August 7 at 09:00 through September 4 at 09:00, Copenhagen time. It replaces the weekly edition with a 28-day view of `aihc` and `aihc-parser`.

The period connects several layers of the project: reusable compilation artifacts, much faster library builds, parser work deferred until needed, and a garbage collector restored with stronger tests. The most interesting details sit at the boundaries between those layers.

## A clean base rebuild drops from 75 seconds to under 5

The largest reported timing change comes from the library installation pipeline. A clean `aihc-base` rebuild went from **75.005 seconds to 4.850 seconds**, about **15.5 times faster**. Heap allocation fell from **164.6 GB to 17.7 GB**, while bytes copied by garbage collection fell from **44.4 GB to 1.27 GB**. These are measurements reported in the optimization PR, not fresh measurements for this article. The report does not specify the full hardware configuration, so they describe that workload rather than a universal speedup. [Measurements and implementation](https://github.com/ai-haskell-compiler/aihc/pull/1568).

The patch combines parallel execution with less repeated work. Independent compiler units run in parallel, with large units first to reduce the final wait. Prepared FC environments and import maps are reused. Package instance facts are stored once per package. Compact meta-variable maps and solution path compression reduce type-checker overhead. Empty modules skip native code generation.

An important check accompanies the timing: builds with `-N1` and `-N12` produced identical file hashes. Parallel execution changed the schedule without changing those output artifacts.

Another backend optimization reported total compilation time falling from **4.294 seconds to 2.969–2.999 seconds** in three runs. Two later runs reached 3.010 and 3.239 seconds under variable system load. Generated assembly shrank from **78.3 MB to 57.9 MB**. The changes share heap reservations across sequential stores, hoist reservations from case alternatives, and share closure-entry transfer stubs. These are separate measurements from the clean base rebuild above. [Backend results](https://github.com/ai-haskell-compiler/aihc/pull/1597).

## Separate compilation reaches the package command

Those improvements follow a month of work on reusable artifacts. August brought stored type interfaces, automatic dependency installation, and then one object per module and one archive per library. The archive design gives separately compiled modules deterministic linker symbols and keeps different targets' artifacts in separate directories. [Stored interfaces](https://github.com/ai-haskell-compiler/aihc/pull/1476), [dependency installation](https://github.com/ai-haskell-compiler/aihc/pull/1477), [incremental archives](https://github.com/ai-haskell-compiler/aihc/pull/1535).

By September 3, the renamed `aihc install` command could accept Hackage package names as well as local Cabal package directories. A bare name selects the preferred Hackage version; an explicit version requests that version. The PR reports these manual examples:

```sh
aihc install nats
aihc install nats-1.1.1
aihc install core-libs/aihc-prim
```

This gives the artifact work a visible entry point. It does not imply that every Hackage package now compiles. It means package retrieval and the existing installation pipeline can be invoked through the same command. [Hackage install support](https://github.com/ai-haskell-compiler/aihc/pull/1684).

## A parser that can stop after imports

In `aihc-parser`, module parsing now evaluates headers and imports immediately while it defers declarations, declaration errors, and the whole-module span. A caller that only needs imports can avoid demanding the declaration parse. No benchmark accompanies this change, so the result here is a change in evaluation behavior, not a claimed percentage improvement. [Lazy module parsing](https://github.com/ai-haskell-compiler/aihc-parser/pull/5).

The implementation captures a copy of the Megaparsec state. A lazy binding then suspends the terminal parser until its result is needed. The outer parser does not advance. Recovered errors travel with the suspended state, and end-of-input validation remains part of the deferred work.

That last detail matters: deferred work must still preserve errors. The tests include a deferred exception to check that the combinator does not evaluate its result prematurely.

The parser also gained dedicated AST constructors for implicit parameters. Expressions such as `?x` no longer masquerade as ordinary variables, and implicit-parameter declarations have their own constructor. The change became release **2.0.0.0**, which `aihc` adopted before this edition's cutoff. Compiler support for implicit parameters and `HasCallStack` also landed during the period. [AST change](https://github.com/ai-haskell-compiler/aihc-parser/pull/8), [release](https://github.com/ai-haskell-compiler/aihc-parser/pull/9), [compiler adoption](https://github.com/ai-haskell-compiler/aihc/pull/1683), [compiler support](https://github.com/ai-haskell-compiler/aihc/pull/1658).

## LLVM removed the roots the collector needed

The semispace collector was disabled on August 25 and restored on September 2. The restored implementation grows its spaces instead of stopping when live data exceeds the old fixed 1 MiB space. It also supports the maximum-heap option. [Disablement](https://github.com/ai-haskell-compiler/aihc/pull/1542), [restoration and tests](https://github.com/ai-haskell-compiler/aihc/pull/1637).

The restoration exposed a particularly instructive backend bug. LLVM root entries were private constants that ordinary code did not reference. At `-O2`, global dead-code elimination removed them. The executable consequently had an empty `aihc_roots` section, and the collector could miss updated static thunks.

The fix lists those entries in `@llvm.used`. That tells LLVM the entries must survive optimization even though their role is outside ordinary code references. A regression program reads a static thunk again after several collections. The PR reports all 16 examples passing on Apple ARM64 and LLVM, both with the default initial space and a small 4 KiB space that forces frequent collections.

There is also a more ambitious experiment: static reference tables that let unreachable evaluated top-level thunks and their results die. It remains **off by default**, behind `+RTS -Zs`. Tests exposed incomplete reachability information, including a live `MonadIO` dictionary that the collector reclaimed. Default behavior therefore still keeps all static objects alive. This is useful experimental infrastructure, not a completed memory-use improvement. [Experimental static collection](https://github.com/ai-haskell-compiler/aihc/pull/1655).
