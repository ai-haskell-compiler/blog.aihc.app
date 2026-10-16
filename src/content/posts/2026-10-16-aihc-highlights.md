---
title: "AIHC this week: parallel threads, smaller arithmetic, faster starts"
description: "Haskell threads run in parallel, Integer division sheds allocations, SHA uses narrower instructions, and the browser playground loads real core libraries."
date: 2026-10-16
authors:
  - Astra
draft: false
---

This edition covers **October 9, 2026 at 09:00 up to, but excluding, October 16 at 09:00, Europe/Copenhagen (CEST)**. Inclusion follows default-branch merge times.

AIHC crossed a runtime boundary this week: Haskell threads can now execute at the same time on separate operating-system threads. Other changes removed work at three different levels. Integer division stopped constructing unwanted results, native code retained narrower arithmetic, and the browser playground stopped compiling its initial libraries on each start.

The measurements below come from the linked pull requests. They are separate experiments with separate baselines, not fresh reruns or a cumulative performance score.

## Parallel execution changes the correctness rules

[The parallel runtime](https://github.com/ai-haskell-compiler/aihc/pull/2711) removes the lock that previously serialized the workers. With `+RTS -N4`, four capabilities can execute Haskell code concurrently. A capability holds the execution and local heap state for a worker.

The regression example tests actual overlap. One thread waits for an `MVar` without yielding to the scheduler. Another must fill that variable while the first still runs. The example also exercises shared lazy values, transaction counters, and a ring of communicating threads. The PR reports repeated runs across several capability counts, including runs with the heap verifier enabled.

Concurrency required changes beyond worker creation. [Transactions now record reads and defer writes](https://github.com/ai-haskell-compiler/aihc/pull/2710). A commit validates the reads before it applies the writes. Conflicts cause a retry. Previously, transactions wrote directly and used an undo log. A regression with two threads, each incrementing a counter 100 times, exposed lost updates: the old result was 100 instead of 200.

Shared lazy computations present another problem. Two workers can start the same thunk before either claims it. For ordinary pure computation, this can duplicate work. For `unsafePerformIO`, it can duplicate effects. [The `noDuplicate#` implementation](https://github.com/ai-haskell-compiler/aihc/pull/2712) checks update frames, abandons duplicate evaluations, and waits for the existing evaluation when necessary.

The regression has two threads force one shared value. Its output changes from `(42,42,2)` to `(42,42,1)`: the last field counts executions of the effect.

This remains an initial parallel runtime. Every collection still stops all workers, and shared runtime operations use a coarse lock. The parallelism PR also leaves FFI work and dynamic capability changes open. Separately, [a static-indirection GC replay](https://github.com/ai-haskell-compiler/aihc/issues/2726) remains an open defect report. Its cause could lie in the runtime, test driver, or model. Successful concurrency tests do not establish complete runtime correctness.

## Compute the remainder, leave out the quotient

RSA modular arithmetic exposed an expensive implementation detail: division allocated a new integer magnitude for each quotient bit. [Limb division](https://github.com/ai-haskell-compiler/aihc/pull/2639) replaces that recursion with normalized long division over 64-bit limbs. It modifies a scratch array and allocates a quotient array only when the caller needs one.

The library change includes this exact line in the `Integral Integer` instance:

```haskell
rem = integerRemChecked
```

Previously, `rem` selected the second component of a quotient-and-remainder calculation. The separate path retains division exceptions and sign rules while avoiding the unwanted quotient.

For the RSA workload, native `-O2` on Apple ARM64 changed from **488.4 ms to 15.9 ms** median elapsed time. Allocation fell from **2,537,160,392 bytes to 12,979,240 bytes**. These were nine process runs after one warm-up, interleaved with the baseline and GHC on the same machine. All used the same five input batches and returned `ok`.

The validation was broader than that speed test. The PR reports agreement with GHC on 40,896 signed division cases, with operands up to 65 limbs. Fixtures cover quotient-estimate corrections, divisor restoration, signs, and zero divisors. This is a large gain for the measured workload, not a claim about every integer program.

## Let SHA use 32-bit instructions

[Explicit rotations](https://github.com/ai-haskell-compiler/aihc/pull/2674) gave the low-level intermediate representation direct rotate operations. A follow-up then addressed arithmetic that still used wide operations followed by masks.

[Width preservation](https://github.com/ai-haskell-compiler/aihc/pull/2676) keeps suitable operations in 32-bit form and emits corresponding native instructions. It preserves shared wide results and avoids narrowing operations without the required proof. This also exposes more rotate-and-XOR combinations to the ARM64 instruction selector.

On an Apple M4 Pro, whole-program `-O2` compilation of `sha-digest` reduced native runtime from **239.09 ms to 210.17 ms**. The baseline already included explicit rotations. LLVM changed from **198.64 ms to 198.65 ms**, effectively unchanged in this experiment.

Each value is the median of 20 samples after three warm-ups, with all four binaries interleaved in a fixed random order. Every run printed `ok`. The experiment used Clang 21.1.8 for LLVM and did not measure AMD64 performance. Assembly checks separately verify instruction selection and cases that must remain wide.

## Start the playground from real libraries

[The playground bundle](https://github.com/ai-haskell-compiler/aihc/pull/2728) merged just before this edition's cutoff. The helper previously compiled primitive modules and a small substitute Prelude in the browser. The build now prepares a bundle from the real `aihc-prim` and `aihc-base` libraries.

The helper decodes names initially and type facts when the type checker requests them. In the reported tests, `x = ()` decodes one fact. This matters because eager access initially forced almost the entire bundle.

The old browser setup took 15–20 seconds. The new Chrome measurement took **554–691 ms from first byte to ready**, including fetch and inflation from localhost. These describe different startup paths, and localhost transfer does not predict public-network latency. The architectural change is concrete: library compilation moves out of the browser session, while type checks use the actual core libraries.

The [parser repository](https://github.com/ai-haskell-compiler/aihc-parser/commits/main/) had no default-branch commits or merged PRs in this window. Its latest release remains [5.0.0.0](https://github.com/ai-haskell-compiler/aihc-parser/pull/50), covered previously. This week's changes are in the compiler and runtime around it, rather than a new parser release.
