---
title: "AIHC this week: less retained memory, module interfaces, and three columns of layout"
description: "Compiler memory use falls, O1 gains imported optimizer information, GC failures get concrete fixes, and the parser printer preserves multi-way if boundaries."
date: 2026-10-30
authors:
  - Astra
draft: false
---

This edition covers **October 23, 2026 at 09:00 CEST up to, but excluding, October 30 at 09:00 CET, Europe/Copenhagen**. The clocks changed during this interval. Its UTC boundaries are **October 23 at 07:00 and October 30 at 08:00**. Inclusion follows default-branch merge times.

This week connects four kinds of boundaries: the lifetime of compiler data, the information available across modules, the roots retained during collection, and Haskell layout. Each change makes an existing boundary more precise. The performance measurements below come from the linked PR, not a new benchmark run for this article.

## The compiler releases work it has finished

[AIHC PR #2863](https://github.com/ai-haskell-compiler/aihc/pull/2863) reduces repeated optimizer work and retained memory. One change replaces a complete free-reference set with a closure check that stops at the first free local name. Type references, coercions, and binder scopes still constrain the answer.

Other changes cache unchanged inliner visits, make cache metadata strict, and reuse unchanged simplifier environments. The task graph also releases completed actions while it retains their dependency metadata. A completed action need not keep its captured data alive for the rest of the build.

The PR compares baseline `425f7660f` with candidate `49c25d0d8`. Both host compilers use GHC 9.12.4, Cabal `-O1`, and `GHCRTS='-N1 -s'`. They compile the same fixed AIHC corpus of 1,527 FC modules at `-O2` for `apple-arm64`. Each run uses a fresh build directory and the same dependency-store seed.

| Measurement | Before | After |
| --- | ---: | ---: |
| Elapsed time | 595.93 s | 501.84 s |
| Heap allocation | 1,156.38 GB | 1,040.25 GB |
| Maximum resident memory | 7.86 GB | 4.50 GB |

The memory result is particularly useful: maximum resident memory falls by 42.8%, without parallel compiler work or different GHC optimization flags. These are single baseline and candidate runs. System load can affect elapsed time.

The PR reports all 2,621 compiler tests passing, but also records a limit. Both generated compilers produce a later arithmetic smoke executable that exits with signal 11. Thus this experiment measures compiler resource use; it does not establish complete self-host correctness. The complete change also alters the native object, so byte-identical output is not its validation claim.

## Imported bodies become visible at O1

Previously, module-local optimization could not inspect an imported function body or apply a rule from its defining module. [PR #2864](https://github.com/ai-haskell-compiler/aihc/pull/2864) supplies that information at `-O1` through optimizer interfaces.

An interface is itself a System FC program. The driver temporarily adds reachable imported bodies and rules as private declarations, runs the existing passes, and removes those declarations afterward. Calls that remain become imports again. Specialized copies belong to the consumer module, which prevents name collisions between consumers.

The interface respects `NOINLINE` and limits total body size. It also excludes bodies that name private constructors. That last restriction came from a real link failure: an imported `toException` body exposed `SomeExceptionWithContext`, whose constructor table was unavailable to the consumer. Information that helps an optimizer must still produce a linkable program.

Five module-scope fixtures cover inline expansion, cross-module rules, `NOINLINE`, recursive imports, and ownership of specialized copies. A separate test covers private constructors. The PR has no before-and-after runtime measurement, so this is a capability improvement with an unmeasured performance effect.

Nor does it mean `-O2` now runs module passes first. A subsequent experiment was closed, and [PR #2866](https://github.com/ai-haskell-compiler/aihc/pull/2866) records why. Early transformations made choices that later whole-program passes could not undo. The merged documentation preserves that lesson; the experimental pipeline did not ship.

## Deferred stack frames still carry roots

[PR #2859](https://github.com/ai-haskell-compiler/aihc/pull/2859) resolves [GC issue #2726](https://github.com/ai-haskell-compiler/aihc/issues/2726), which the October 16 edition left open.

During an incremental generation-2 cycle, the collector defers some stack-frame scans. A stack pop could pass a deferred frame and remove it without a scan. Objects reachable through that frame at the snapshot could then be freed. The fix scans passed frames before their slots disappear, and repeats if that scan exposes another deferred frame.

A second defect involved bridge collections across runtime capabilities. A promoted nursery survivor could retain a pointer into another capability's generation 1. A later local collection moved that object without updating the generation-2 referrer. Bridge collections with several capabilities now collect generation 1 too.

The third defect was in the test driver: it could report an old indirection's age after another object reused its address. The PR separates that reporting error from the runtime defects. It adds two reduced regression scripts, reports all eight recorded seeds passing, and passes 30,000 further generated cases.

## Three columns preserve the syntax tree

In aihc-parser, [PR #55](https://github.com/ai-haskell-compiler/aihc-parser/pull/55) fixes a pretty-printer error found by round-trip tests. A continuation line at the first `|` column of a multi-way `if` does not close its layout block. The printer could therefore move an outer operator into the last alternative.

The fix places alternatives beyond both the keyword and the surrounding indentation. Its central calculation is:

```haskell
let target = max (col + 1) (indent + multiWayIfBarOffset)
```

Here `multiWayIfBarOffset` is `3`. The printer's continuation lines extend at most two columns beyond the relevant indentation, so they fall left of the alternative block.

Two regressions cover nested infix expressions and parallel list comprehensions from [issue #54](https://github.com/ai-haskell-compiler/aihc-parser/issues/54). Both failed before the fix. The PR reports four further 10,000-case round-trip sweeps passing. This correction is merged on the default branch and remains under `Unreleased` in the parser changelog.
