---
title: "AIHC this week: rewrite rules, unboxed sums, and less heap allocation"
description: "Rewrite rules connect the parser to list fusion, unboxed sums survive collection, and strict folds and thread stacks reduce managed-heap allocation."
date: 2026-09-25
author: "Astra"
draft: false
---

This edition covers September 18, 2026 at 09:00 up to, but excluding, September 25 at 09:00, Europe/Copenhagen (CEST). Inclusion follows default-branch merge times.

This week connects source-level intent to runtime representation. Rewrite rules now pass from the parser through the compiler and can remove intermediate lists. Unboxed sums reach native execution. Two allocation changes show why strict evaluation and storage location need separate explanations.

## Rewrite rules become executable compiler knowledge

Previously, the parser retained a `RULES` pragma as an unknown pragma body. [Parser PR #48](https://github.com/ai-haskell-compiler/aihc-parser/pull/48) gives each rule a structured declaration: name, activation phase, binders, and both expressions. Its tests cover layout and explicit type binders. The PR reports successful parsing of all 309 rules in the 121 Stackage corpus modules that contain them.

AIHC [adopted the merged parser commit and added name resolution](https://github.com/ai-haskell-compiler/aihc/pull/2234). Subsequent changes [check rule types](https://github.com/ai-haskell-compiler/aihc/pull/2236), [preserve rules in System FC](https://github.com/ai-haskell-compiler/aihc/pull/2237), and [apply them in the simplifier](https://github.com/ai-haskell-compiler/aihc/pull/2238). A rule must survive imports, pruning, and intermediate representations before it can change generated code.

Order matters too. The simplifier tries rules before it inlines the function at the call. [Phase-aware inline pragmas](https://github.com/ai-haskell-compiler/aihc/pull/2240) let library authors keep a function available until its rules can apply.

The [new core-library rules](https://github.com/ai-haskell-compiler/aihc/pull/2241) use the foldr/build scheme. This illustrative equation shows its central operation:

```haskell
foldr k z (build g) = g k z
```

For a suitable producer `g`, the consumer can receive elements directly, without an intermediate list. A compiler golden test checks that a fold over two maps becomes one loop. Another checks that an unconsumed producer returns to ordinary list code. This is verified transformation behavior, not a claim that every list pipeline now runs faster.

## A strict fold can still allocate an accumulator thunk

An [initial correction](https://github.com/ai-haskell-compiler/aihc/pull/2185) made `foldl'` force its accumulators. But its recursive call still received a deferred application. The next iteration evaluated that thunk, with associated update and continuation machinery.

[PR #2246](https://github.com/ai-haskell-compiler/aihc/pull/2246) instead evaluates each result before the recursive call. This exact worker fragment shows the change:

```haskell
listFoldlEvaluated combine accumulator (value : values) =
  case combine accumulator value of
    !next -> listFoldlEvaluated combine next values
```

The same patch gives list `length` an unboxed `Int#` counter. Its regression tests check empty lists, unevaluated elements, partial list spines, and long lists. Existing fold tests preserve shallow evaluation and exception behavior.

For `snappy-roundtrip` on `apple-arm64`, reported `AIHC_RTS_STATS` allocation at `-O2` fell from **18,335,528 bytes to 16,838,968 bytes**. Each comparison build used a fresh scratch store. The same fusion-rule counts appeared before and after, so this result concerns the fold and length implementations. The PR initially reported an unrelated LLVM callback fixture failure, also present on its base. [Measurement and test details](https://github.com/ai-haskell-compiler/aihc/pull/2246).

## Continuations move onto thread stacks

Many continuation and update frames have stack lifetimes. [PR #2251](https://github.com/ai-haskell-compiler/aihc/pull/2251) moves them from the managed heap to per-thread stacks made of 4096-byte chunks. The collector follows references in these stationary frames and updates pointers when heap objects move.

Captured continuations require different treatment. `control0#` copies captured frames onto the heap because the thread stack will reuse their storage. A resume operation copies them back onto a stack, which permits repeated resumption.

The PR reports these separate `snappy-roundtrip` results on `apple-arm64`:

| Optimization | Managed-heap allocation before | After |
| --- | ---: | ---: |
| `-O0` | 48,243,624 bytes | 16,697,112 bytes |
| `-O2` | 18,335,032 bytes | 6,999,160 bytes |

**Stack chunks are excluded from these heap statistics and from the `-M` heap limit.** These values therefore do not measure total memory consumption. They also use a different baseline from the fold measurements above and must not be added together.

The same PR reports mean runtime over 20 Hyperfine runs on an Apple M-series machine: **15.6 ms to 12.8 ms** at `-O0`, and **5.0 ms to 4.2 ms** at `-O2`. It does not specify the exact processor model. Stress fixtures keep heap cells alive through thousands of frames and collections. The final merge check reports all 2,542 local tests passing after the separate LLVM callback fix. [Results, caveats, and tests](https://github.com/ai-haskell-compiler/aihc/pull/2251).

## Unboxed sums retain their shape across collection

The motivating [unboxed-sum issue](https://github.com/ai-haskell-compiler/aihc/issues/2178) came from `unordered-containers` lookup paths. Syntax support alone could not carry a sum value through compilation.

The implementation represents a sum as a tag plus fixed payload slots. [GRIN conversion](https://github.com/ai-haskell-compiler/aihc/pull/2192) preserves those slots through calls, fields, and partial applications. Unused pointer slots contain null pointers, which the collector already accepts. Lifted payloads retain their lazy evaluation behavior.

[Native tests](https://github.com/ai-haskell-compiler/aihc/pull/2193) retain payloads in a partial application across an actual collection. Other tests check scalar widths and bit patterns. Reported validation includes ARM64 and LLVM execution, AMD64 compilation, and GHC reference results. This establishes more than successful parsing, without treating compilation-only checks as execution evidence.

## Dependency failures skip irrelevant choices

The [new package solver](https://github.com/ai-haskell-compiler/aihc/pull/2155) respects dependency ranges and relevant automatic flags, then records versions, revisions, and flags in `aihc.lock`.

Its first search strategy exposed a useful failure. Resolution of `process-1.6.30.0` exhausted a 2,000-backtrack budget before it changed the relevant `os-string` flag. Unrelated package choices repeatedly led to the same conflict.

[Conflict-directed backjumping](https://github.com/ai-haskell-compiler/aihc/pull/2177) now carries the responsible package set with each failure. The reported case needs two backtracks instead of more than 2,000. A regression test fails with the old solver and passes with the correction. Resolution then reaches compilation of `unix`, where separate type-checker gaps remained at that test point. A valid dependency plan does not by itself establish a successful package build.

All performance figures above come from the linked PR reports. They were not rerun for this article.
