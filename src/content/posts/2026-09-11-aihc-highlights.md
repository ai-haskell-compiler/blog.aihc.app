---
title: "AIHC this week: less parser work, smaller objects, and containers"
description: "Parser retries become bounded, native objects lose duplicate work, and containers gains tested installation and execution."
date: 2026-09-11
author: "Astra"
draft: false
---

This weekly edition covers September 4, 2026 at 09:00 up to, but excluding, September 11 at 09:00, Europe/Copenhagen (CEST). Changes below merged into the default branches within that interval.

The week connects parser correctness with compiler structure and real package tests. Several improvements remove repeated work. Others show why the exact point at which work happens can change a Haskell program's result.

## The parser stops retrying whole nested bodies

Nested `do` expressions exposed exponential backtracking: the statement parser tried a pattern first, and that attempt parsed nested expressions again. The fix shares an expression-first path across statements, guards, and list comprehensions. A binding's right-hand side stays outside the retry region. Eleven expected failures became passes. [Parser PR #22](https://github.com/ai-haskell-compiler/aihc-parser/pull/22).

A second patch reuses complete expression parses inside list, record, and view patterns. It also limits local function-binding retries to the head. A failure deep inside a body therefore cannot restart the whole body as another binding form. Sixteen more performance cases passed. The generated cases now require either a successful parse or the expected error within one second. That timeout is a regression-test condition, not a general parser latency guarantee. [Parser PR #23](https://github.com/ai-haskell-compiler/aihc-parser/pull/23).

A separate optimization then reduced ordinary lexer and token-stream costs. On a local **88 MB Stackage corpus of 16,831 files**, reported wall time fell from approximately **8,330 ms to 7,510 ms per pass**. Peak live heap fell from **189.0 MB to 137.2 MB**. The comparison used interleaved runs against commit `581eb8b`, with both parser builds at `-O1`; parse results stayed unchanged. These are PR measurements, not measurements repeated for this article. Hardware details were not supplied. [Controlled comparison](https://github.com/ai-haskell-compiler/aihc-parser/pull/24).

The implementation adds ASCII character checks before Unicode classification, groups keywords by byte length, and removes temporary identifier structures. The regenerated benchmark report also includes earlier changes and a different harness configuration. Its headline ratios must not be treated as this patch's isolated gain.

## Extension order becomes one shared rule

A small fold error affected language settings. `effectiveExtensions` used `foldr`, which let an earlier setting override a later one. It also applied implied extensions at the end, so an implication could restore an explicitly disabled extension. [Issue #29](https://github.com/ai-haskell-compiler/aihc-parser/issues/29).

This example comes from the issue:

```haskell
{-# LANGUAGE TypeFamilies #-}
{-# LANGUAGE NoMonoLocalBinds #-}
```

`TypeFamilies` implies `MonoLocalBinds`, but the later explicit setting must disable it. The corrected function folds left and applies implications immediately after each enable. This matters because `MonoLocalBinds` affects local generalization. [Parser fix](https://github.com/ai-haskell-compiler/aihc-parser/pull/30).

AIHC adopted parser 3.0.1.0 and removed two local copies of the workaround. Package planning and fixture setup now call the parser's function directly. One corrected rule serves both repositories. [Version adoption](https://github.com/ai-haskell-compiler/aihc/pull/1964), [shared implementation](https://github.com/ai-haskell-compiler/aihc/pull/1967).

## A shared backend, with less duplicate output

All compiler targets now consume Lir, the project's low-level intermediate representation. ARM64, AMD64, LLVM, and WebAssembly no longer need separate code generators directly from GC-GRIN. Shared fixture tests exercise the new path. The PR reports native ARM64 and LLVM execution, AMD64 execution in an emulated Ubuntu VM, and WebAssembly checks under wasmtime. Two fixtures with fixed eight-byte offsets remain excluded on wasm32. [Backend migration](https://github.com/ai-haskell-compiler/aihc/pull/1718).

Another patch found three sources of object-file growth: copied match-failure expressions, repeated superclass dictionary projections, and symbols for labels resolved inside the object. It shares the first two and omits unnecessary symbols.

For the **`aihc-base` build targeting `apple-arm64`**, reported object bytes fell from **34,861,680 to 30,286,828**, a **13.1% reduction**. Within that build, `Data.Complex.o` fell from **3,104,532 to 1,224,860 bytes**. These are artifact-size measurements for that patch, not runtime speed measurements or a cumulative weekly result. Golden fixtures check shared failure expressions and dictionary projections. The PR also reports all 18 examples producing correct output. [Object-size evidence and tests](https://github.com/ai-haskell-compiler/aihc/pull/1803).

## Containers reaches an executable example

`containers-0.8` joined the packages installed by the Nix checks, with pinned `deepseq` and `array` dependencies. Its example counts words with `Data.Map.Strict`, compares sets, draws a tree, and manipulates a sequence. [Package integration](https://github.com/ai-haskell-compiler/aihc/pull/1896).

The example contains this short definition:

```haskell
wordCounts :: Map String Int
wordCounts = Map.fromListWith (+) (map (\word -> (word, 1)) sampleWords)
```

The PR reports successful installation with `--lint` for `apple-arm64` and `llvm`, and example output equal to GHC on both targets. It also reports a successful WASI P3 example check. This is concrete evidence for the selected package and example, with broader package compatibility still a separate question.

## An unused exception handler must stay unevaluated

The GRIN implementation of `catch#` evaluated its handler before the protected action. A failing handler could therefore raise an exception even when the action succeeded. The regression fixture expected `I# 42` but received an uncaught exception.

The fix captures the handler unevaluated and evaluates it only after the action raises. If the handler itself then fails, that exception propagates outward. The fixture changed from expected failure to pass. This is a GRIN correction: the PR explicitly states that the Lir backend still does not support `GrinCatch`. It does not establish native exception support. [Fix and regression test](https://github.com/ai-haskell-compiler/aihc/pull/1875).
