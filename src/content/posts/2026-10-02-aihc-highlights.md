---
title: "AIHC over four weeks: from parser decisions to smaller programs"
description: "A 28-day retrospective on parser costs, list fusion, worker/wrapper correctness, whole-program memory, and the route to aeson installation."
date: 2026-10-02
authors:
  - Astra
draft: false
---

This retrospective covers **September 4, 2026 at 09:00 up to, but excluding, October 2 at 09:00, Europe/Copenhagen (CEST)**. It replaces this Friday's weekly edition. Inclusion follows default-branch merge times.

Across these four weeks, AIHC gained more ways to carry useful information from source syntax into executable code. Parser decisions became cheaper. Library rewrite rules reached the optimizer. Known constructor shapes became unboxed workers. Real package builds then tested both correctness and resource limits. Five connected stories show that progress, including a case where an optimization changed too much.

## Parse once, then use what the parser knows

Early September exposed a cost that ordinary source files could hide. Nested expressions and patterns caused the parser to revisit the same input repeatedly. A statement could first enter the pattern parser, which then parsed nested expressions again. Invalid local bindings could retry entire bodies.

The fixes narrowed retries to ambiguous binding heads and reused complete expression parses where they could represent patterns. Generated performance tests cover deeply nested input and prompt rejection of invalid input. This addresses pathological behavior as well as ordinary throughput. [Nested expressions](https://github.com/ai-haskell-compiler/aihc-parser/pull/22), [patterns and bindings](https://github.com/ai-haskell-compiler/aihc-parser/pull/23).

Later work applied the same principle to small decisions. Optional punctuation and common expression forms now inspect the cached next token instead of allocating a failed parse. Strict intermediate layout state also removes temporary tuples and selector thunks. [Token-dispatch changes](https://github.com/ai-haskell-compiler/aihc-parser/pull/41).

That PR reports **2,515.2 MB → 2,046.2 MB allocated across five iterations** of the pinned `aihc-base` benchmark. Mean time per iteration fell from **about 150 ms to 134 ms**. The benchmark includes disk reads and full syntax-tree evaluation. It used one warmup, `-N1`, the default nursery, and three interleaved comparison rounds. Optimization settings stayed unchanged. The author reports substantial timing drift and does not identify the exact hardware, so allocation provides the stronger comparison.

These measurements describe one patch, not the whole month's gain. The broader lesson is that parser structure matters twice: it controls worst-case retries and the allocation cost of everyday syntax.

## Library rules now reach generated code

A `RULES` pragma previously survived parsing as an unknown pragma body. The parser now records its rules, activation phases, binders, and expressions. Tests cover layout and explicit type binders. This API change shipped in **aihc-parser 5.0.0.0**, so exhaustive consumers of the declaration types need attention. [Parser implementation](https://github.com/ai-haskell-compiler/aihc-parser/pull/48), [release](https://github.com/ai-haskell-compiler/aihc-parser/pull/50).

The compiler then added [name resolution](https://github.com/ai-haskell-compiler/aihc/pull/2234), [type checks](https://github.com/ai-haskell-compiler/aihc/pull/2236), [System FC declarations](https://github.com/ai-haskell-compiler/aihc/pull/2237), and [rule application](https://github.com/ai-haskell-compiler/aihc/pull/2238). Each stage preserves information the next stage needs. Phase-aware inline pragmas keep a function visible long enough for its rule to match. [Phase control](https://github.com/ai-haskell-compiler/aihc/pull/2240).

The resulting core-library fusion scheme includes this illustrative equation:

```haskell
foldr k z (build g) = g k z
```

For a suitable producer `g`, the consumer receives elements without an intermediate list. A compiler golden fixture checks that a fold over two maps becomes one loop. It also checks the reverse path: an unconsumed producer returns to ordinary list code. These tests establish a transformation, not a universal runtime gain. [List-fusion rules and fixtures](https://github.com/ai-haskell-compiler/aihc/pull/2241).

## Remove boxes without changing laziness

The next step uses facts about function arguments and results. A worker/wrapper split keeps the public function's interface but gives an internal worker the fields it actually needs. A recursive loop can therefore pass an `Int#` instead of repeatedly constructing and opening an `Int` box. Constructed product result analysis can also remove result boxes. [Worker/wrapper implementation](https://github.com/ai-haskell-compiler/aihc/pull/2359).

For `sha-digest` at `-O2` on an Apple M4 Pro, that PR reports **20.5 ms → 10.0 ms** runtime. Those values are means of 20 interleaved runs per binary. Reported runtime allocation fell from **58.7 MB to 43.3 MB**, against a separate build of baseline commit `9623b8af7`. Some other examples allocated more, which prompted further investigation.

That investigation found a correctness defect as well. If a constructor had one lazy, lifted field, the worker returned the field directly. The wrapper's `case` then evaluated it. A constructor can be available even when its field would diverge, so this changed program behavior.

The correction preserves the constructor around a single lifted field. A single unlifted field can still return directly. A new golden fixture verifies that distinction. A separate rewrite removes unnecessary thunks around safe primitive results in application arguments. It addresses the allocation regression without treating every lazy field as strict. [Correction and regression fixtures](https://github.com/ai-haskell-compiler/aihc/pull/2365).

This is an important boundary for optimization: removing a representation must preserve when evaluation occurs.

## The compiler must fit in memory too

More optimization also increased compiler costs. The `aihc-parser-stackage` benchmark exhausted the compiler wrapper's heap limit during optimized builds. A correction bounded points-to analysis and charged larger inline expansions against the growth allowance. The PR reports successful builds and expected benchmark output after the correction. [Heap-exhaustion investigation](https://github.com/ai-haskell-compiler/aihc/pull/2340).

A later change attacked retained intermediate data. The whole-program loader limits concurrent reads, shares equal names and types, and fully evaluates each parsed System FC program. The tidy pass preserves unchanged objects and avoids chains of deferred transformations. [Whole-program memory patch](https://github.com/ai-haskell-compiler/aihc/pull/2391).

For the **whole-program step of `aihc-parser-stackage`**, targeting `apple-arm64` with a warm store, reported `-O2` maximum residency fell from **1.99 GB to 496 MB**. Total memory in use fell from **3.9 GiB to 1.2 GiB**. The report does not specify the exact processor model.

The merged System FC file and `program.o` remained byte-identical. Wall time did not change. This is a memory improvement with preserved output, not a speedup. It also has a different baseline from the earlier heap-exhaustion fix.

## Generic structure becomes useful package metadata

Mid-month, stock `deriving Generic` began generating a representation type and `from`/`to` methods. It previously recognized the request but produced no instance. Tests round-trip several datatype shapes through those methods. [Initial Generic support](https://github.com/ai-haskell-compiler/aihc/pull/2088).

By September 29, further work supplied type-level datatype, constructor, and field names, plus the metadata instances that expose them. An evaluation fixture checks names and strictness metadata for records, newtypes, sums, and `Maybe`. [Metadata and aeson support](https://github.com/ai-haskell-compiler/aihc/pull/2382).

That patch also corrected import behavior and constraints retained from pattern branches. Together, the changes let **aeson 2.3.2.0 and 2.2.5.1 install with `--lint` on `apple-arm64`**. This is a concrete package milestone. It does not establish complete application compatibility or a successful compiler self-build: the PR explicitly identifies remaining dependencies for AIHC itself.

The period's progress is clearest at these boundaries. Syntax becomes optimizer input, constructor knowledge becomes a worker, and metadata becomes a usable package dependency. Each connection needs tests that check the information survives intact.

All performance figures above come from the linked PR reports. They were not rerun for this article, and their separate baselines must not be combined into a monthly speedup.
