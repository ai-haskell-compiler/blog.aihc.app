---
title: "AIHC this week: the compiler compiles itself, then tests the result"
description: "An identical self-built compiler, incremental GC defects, faster inliner decisions with a runtime tradeoff, and Hackage downloads on WebAssembly."
date: 2026-10-09
authors:
  - Astra
draft: false
---

This edition covers **October 2, 2026 at 09:00 up to, but excluding, October 9 at 09:00, Europe/Copenhagen (CEST)**. Inclusion follows default-branch merge times.

This week, AIHC passed a stronger test than installation of its own dependencies: the compiler it built could rebuild itself to an identical binary. That result exposed useful details about garbage collection, optimizer correctness, and the difference between faster compilation and faster programs. WebAssembly also reached a concrete milestone: a program downloaded and unpacked a Hackage package.

## A compiler that can rebuild itself

The self-host report already counted 77 successful package builds. But that count did not test whether the resulting compiler worked. When the self-built compiler ran, corrupt heap errors exposed defects in the new generational collector. Deferred stack scans could lose lower frames, and a woken waiter could retain a pointer to a frame that its thread had already popped. [The stack corrections](https://github.com/ai-haskell-compiler/aihc/pull/2546) added regression fixtures that failed on both ARM64 and LLVM before the fix.

A further defect involved an evaluated thunk. Its update replaced its code with an indirection. The collector preserved the old fields, but missed static objects reachable through the old code's reference table. Once the update removed that table, the marker could no longer find those objects. The correction adds this line before the ordinary field scan:

```c
aihc_walk_srt(aihc_value_info_table(object)->srt);
```

That is the exact added call in [the runtime fix](https://github.com/ai-haskell-compiler/aihc/commit/dfa851307478223aa0251831399dcf2ac80a862e). A small change preserves an entire class of references.

[The bootstrap report](https://github.com/ai-haskell-compiler/aihc/pull/2556) states that the self-built compiler, built at `-O1`, then built all 77 packages. Its resulting executable matched the previous stage byte for byte, as did the object files and interfaces of the 76 dependencies. This is evidence for that bootstrap configuration, not proof that every optimization level is correct. [An intermittent `-O2` allocation failure](https://github.com/ai-haskell-compiler/aihc/issues/2568) remains a separate issue.

## Incremental collection needs tests that change the heap

The collector acquired [three generations](https://github.com/ai-haskell-compiler/aihc/pull/2474), [non-moving old-generation storage](https://github.com/ai-haskell-compiler/aihc/pull/2481), and [incremental marking](https://github.com/ai-haskell-compiler/aihc/pull/2494) within this window. Old-generation marking runs in slices on the thread that executes the program. Write barriers preserve references that mutations would otherwise erase during a cycle.

The measurements show a tradeoff. On Apple ARM64 at `-O2`, with default options, `gc-large-live-set` changed from 124 ms to 111 ms of GC time after incremental marking. Its longest pause changed from 8.1 ms to 7.7 ms, while peak heap increased from 15.9 MiB to 28.4 MiB. These are the PR's measurements against the preceding non-moving collector, not a fresh rerun. Garbage remains until a cycle completes. A full-collection fallback also remains, so these results do not establish a universal pause bound.

[The replacement fuzz test](https://github.com/ai-haskell-compiler/aihc/pull/2558) exercises multiple threads, real stacks, waiters, and queues. A runtime verifier checks reachable objects after each collection. This found three additional defects, including queue pointer deletions without the required barrier. The test also has an explicit limit: it missed one deliberately reintroduced deferred-frame defect in 1,000 cases. A dedicated GRIN fixture covers that case. Random tests and targeted regressions complement each other here.

## Decide whether to inline before making the copy

The old inliner copied a function body, simplified it, measured it, and sometimes discarded it. Nested trial copies repeated that work. [The new inliner](https://github.com/ai-haskell-compiler/aihc/pull/2552) estimates the benefit first, then copies and simplifies accepted sites once.

For `sha-digest` on Apple ARM64 with a warm store, the reported `-O2` executable build fell from **85 seconds to 17 seconds**. Binary size fell from 1.22 MB to 1.14 MB. These are build measurements, not program execution times.

The distinction matters. A [five-round interleaved benchmark comparison](https://github.com/ai-haskell-compiler/aihc/pull/2552#issuecomment-6034609084), also on Apple ARM64, found runtime regressions under the named native `-Os` configuration. The parser Stackage workload rose from 72.42 ms to 107.72 ms. The estimate left some boxed arithmetic as calls where the former decisions had expanded it. Faster decisions therefore came with a real optimization tradeoff.

The parser repository itself had no default-branch changes this week. AIHC did [adopt the published parser 5.0.0.0 package](https://github.com/ai-haskell-compiler/aihc/pull/2486), replacing its Git pin. That release's RULES support predates this window. The parser is both a released compiler dependency and a workload that tests the optimizer.

## Four bytes that mattered to WebAssembly

[WASI HTTP support](https://github.com/ai-haskell-compiler/aihc/pull/2495) supplied response streams. The next test combined HTTP, `zlib`, and `tar`: fetch and unpack `data-default-class-0.2.0.0` under Wasmtime.

[That integration](https://github.com/ai-haskell-compiler/aihc/pull/2531) exposed a particularly concrete bug. `Storable (Ptr a)` wrote eight bytes, but a wasm32 C pointer occupies four. A write to `z_stream.next_in` therefore cleared the following `avail_in` field. Platform-specific pointer storage fixed the mismatch. Other corrections distinguished foreign function addresses from data addresses and removed a recursive `fmap`/`liftM` loop.

The package download and extraction worked. The larger Hackage index decompression did not complete within ten minutes in the reported test. Foreign pointer finalizers also still require explicit finalization rather than automatic GC invocation. The milestone is a tested package-fetch path, with those limits intact.
