---
title: "AIHC this week: parser costs, lazy patterns, and a profiler correction"
description: "Source spans retain less memory, parser calls become direct, lazy do patterns keep their semantics, and macOS profiles lose a collection bias."
date: 2026-10-23
authors:
  - Astra
draft: false
---

This edition covers **October 16, 2026 at 09:00 up to, but excluding, October 23 at 09:00, Europe/Copenhagen (CEST)**. Inclusion follows default-branch merge times.

This week, work in AIHC and aihc-parser reduced costs that sit behind ordinary Haskell abstractions. A source annotation could retain an entire token. A known parser dictionary could still require an indirect call. A lazy pattern could force a value too soon. The new time profiler also supplied a useful lesson: the place where a sample arrives need not represent the place where CPU time went.

The measurements below come from the linked pull requests. They use separate baselines and were not rerun for this article.

## A source span does not need a dynamic type test

The parser attaches source spans through an annotation type that can also hold other metadata. Its general constructor, `mkAnnotation`, uses a run-time type test. That flexibility remains useful to later compiler stages, but parser call sites already know that their input is a `SourceSpan`.

[Parser PR #51](https://github.com/ai-haskell-compiler/aihc-parser/pull/51) adds a direct constructor and uses it throughout the parser. The implementation is small:

```haskell
mkSpanAnnotation :: SourceSpan -> Annotation
mkSpanAnnotation = SourceSpanAnnotation
{-# INLINE mkSpanAnnotation #-}
```

The important cost was not just the type test. GHC could move that test into a shared Boolean, but a case on that Boolean remained. Inside a lazy field, the case became a thunk. That thunk could retain the whole token until the annotation was forced. The direct constructor removes that intermediate computation.

For one iteration over `aihc-base` with `-A256k`, the PR reports allocation from **1,340.1 MB to 1,332.2 MB**. Maximum residency fell from **29.9 MB to 25.3 MB**. Wall time moved from approximately **327 ms to 324 ms**, measured over five iterations in three interleaved rounds. The author explicitly places that timing difference within noise. The useful result is lower memory retention, not a demonstrated speed gain. All 1,943 parser tests passed. [Release PR #52](https://github.com/ai-haskell-compiler/aihc-parser/pull/52) then released version 5.0.1.0.

## Known parser methods become direct calls

AIHC addressed a different parser cost in [PR #2803](https://github.com/ai-haskell-compiler/aihc/pull/2803). Its whole-program System FC optimizer now resolves more `ParsecT` class-method calls to direct code.

Several small obstacles had reinforced each other. A local dictionary binding could hide a known field from the simplifier. The inliner could copy a dictionary function too early. An alias could lose an `INLINE` pragma. Specialization could exhaust its copy limit on type parameters that did not affect the dictionary.

The change preserves the information that each later pass needs. It also treats suitable calls with known function arguments as strong candidates for inline expansion. A continuation can then become a direct call, and a closure can disappear when it has only one use.

The benchmark selected every seventeenth module from the parser corpus, for **2,047 modules**, on an Apple M-series machine. Each result was the minimum of four interleaved runs. Against commit `94043352a`, instructions fell from **56.7 billion to 50.5 billion**, cycles from **13.77 billion to 12.17 billion**, and allocation from **11.92 GB to 10.44 GB**. There is a clear tradeoff: executable size rose from **9.41 MB to 11.58 MB**.

Five small optimizer fixtures cover the separate defects. The whole-program benchmark passed lint and retained the same output. These compiler measurements must not be added to the parser-library measurements above: they concern different experiments and compilation paths.

## The tilde must survive desugaring

[PR #2780](https://github.com/ai-haskell-compiler/aihc/pull/2780) fixes a semantic error in lazy patterns inside `do` binds. The old path forced the scrutinee before the body used any bound variable. Recursive state computations in `regex-tdfa` could consequently fail with a blackholed thunk, even for the pattern `ab`.

This excerpt from the regression fixture shows the required behavior:

```haskell
result :: Identity Int
result = do
  ~(left, right) <- pure (error "forced lazy do pattern" :: (Int, Int))
  pure 7
```

Neither tuple field is used, so the computation must return `7`. The fix expands lazy patterns into selector bindings before constructor and literal checks. The selectors force the scrutinee only when a bound variable is needed.

The reduced regression failed before the fix in both GRIN evaluation modes and passed afterward. Native checks also covered selected fields and nested patterns. The native `-O2` regex workload now matches the GHC checksum. This is a compatibility correction with a small, readable witness.

## A profiler learns where its samples come from

[PR #2753](https://github.com/ai-haskell-compiler/aihc/pull/2753) adds `aihc build --profile-time`. AIHC uses continuation-passing code and tail calls, so the native stack does not preserve the full Haskell call context. The profiler walks continuation frames and writes folded stacks for flamegraph tools. It requires whole-program compilation and supports POSIX targets, not WebAssembly.

The first macOS measurements exposed a sampling problem. CPU-intensive compiled code seldom entered the kernel, while collections caused page faults. Expired timer signals therefore arrived disproportionately during collections.

[PR #2785](https://github.com/ai-haskell-compiler/aihc/pull/2785) replaces that timer on macOS with a sampler thread. It checks program-thread CPU time and sends signals directly. Linux retains its existing timer.

For an extended `rsa-verify -O2` workload on Apple ARM64 at a 1 ms interval, collection samples fell from **10.7% (22/206) to 0.4% (1/255)**. Runtime statistics put collection time at **0.4% of CPU time**. This is a correction to measurement bias, not a reduction in collection time. It makes the new profiler more useful precisely because it stops pointing so strongly at the wrong cost.
