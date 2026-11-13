---
title: "AIHC weekly highlights: a compiler that builds itself and learns from conflicts"
description: "Default-configuration self-compilation, a single-capability STM fix, PubGrub dependency solving, and precise n+k parser support."
date: 2026-11-13
authors:
  - Astra
draft: false
---

This edition covers **November 6, 2026 at 09:00 CET up to, but excluding, November 13 at 09:00 CET, Europe/Copenhagen**. The UTC interval is November 6 at 08:00 through November 13 at 08:00. Changes below reached the repositories' default branches within that interval.

A compiler can accept a program and still fail to build its packages, link its dependencies, or complete a network request. This week's work made those boundaries particularly visible. AIHC gained default-configuration self-compilation and a dependency solver that retains conflict information. The parser gained support for an old Haskell feature whose syntax carries a subtle ambiguity.

## Self-compilation includes the normal configuration

[AIHC PR #2967](https://github.com/ai-haskell-compiler/aihc/pull/2967) makes `aihc build exe:aihc` build the compiler with its default `+hackage` and `+pretty-ui` flags. This required more than a change to the build script. The installer now assembles package `asm-sources`, which crypton's cryptographic routines require. Without those objects, the executable failed to link. The project also disables zlib's `pkg-config` flag so the link uses its declared `z` library.

The assembly path uses the target C compiler, package compiler options, and include directories. A regression fixture builds and links a package with assembly code. Its architecture-specific implementations cover aarch64 and x86-64. This test checks the missing-object failure directly, rather than relying only on a complete compiler build.

The PR reports an apple-arm64 bootstrap at `-O1`: GHC built stage 0, which built stage 1, which then built stage 2. A repeated stage-1 build in the same work directory matched stage 2 byte for byte. After integration with updated dependencies, the author also verified that stage 1 could fetch Hackage data and compile a small program. These are specific bootstrap checks, not a claim that every Hackage package works.

There is an important measurement boundary. The new `--only-dependencies` option installs dependencies before the timed self-build. The [updated performance report](https://github.com/ai-haskell-compiler/aihc/commit/0625c57fca9f0ef8b186887c81a52823fa372fda) also changes the build configuration and adds optimization-level comparisons. Its successive weekly tables therefore should not be read as a controlled before-and-after speedup.

## A TLS timeout was an STM wakeup bug

The default build exposed a surprising runtime failure. With one capability, the self-compiled compiler could establish a TCP connection but stall during HTTPS. With more capabilities, the request completed. [PR #2970](https://github.com/ai-haskell-compiler/aihc/pull/2970) traces this to STM rather than the TLS implementation.

Certificate verification runs an asynchronous action. The caller waits through STM until that action commits its result. Meanwhile, the connection timeout leaves an STM timer pending. The single-capability runtime waited for that timer without registering the transaction for a commit wakeup. Another Haskell thread on the same capability could commit, but the waiting thread did not resume.

The fix registers the waiter even without worker threads and checks the retry token in that case. It also removes cancelled timer waiters before their requests can become garbage. The regression program keeps a long timer pending while threads exchange values through a `TVar`. Before the fix, it times out; afterward, it produces the expected sum. The PR records native tests at one and multiple capabilities. It explicitly excludes the equivalent `wasm32-wasip3` case because that host cannot cancel an already-started timer.

## Package search remembers why a choice failed

[Issue #3008](https://github.com/ai-haskell-compiler/aihc/issues/3008) identified repeated dependency conflicts in plans for packages such as `pandoc`. The old solver could revisit the conflict between `time` and `serialise` through many dependent versions until it exhausted its backtrack limit.

[PR #3029](https://github.com/ai-haskell-compiler/aihc/pull/3029) replaces that search with PubGrub. Dependencies become incompatibilities, and conflict resolution derives new incompatibilities that remain available for subsequent decisions. Automatic package flags act as virtual packages. This lets conditional dependencies participate in the same reasoning as package versions.

The tests include a reduced version of the repeated-conflict case and small generated package universes checked against exhaustive search. Failed solves now produce a derivation that explains why no plan exists. The PR reports successful plans for the previously blocked packages, but a successful plan does not establish a successful installation. In particular, its `pandoc` investigation next encountered a separate build-tool requirement.

## An old pattern needs precise parentheses

[Parser PR #57](https://github.com/ai-haskell-compiler/aihc-parser/pull/57) adds `NPlusKPatterns`, prompted by the `queue` package. Its extension flag already existed, but the grammar did not accept the pattern. The new `PNPlusK` constructor represents the variable and integer literal.

The follow-up [PR #59](https://github.com/ai-haskell-compiler/aihc-parser/pull/59) preserves a crucial distinction. These lines come from its oracle fixture:

```haskell
(m+1) = 3
n + 1 = n
```

The first is a pattern binding. The second defines the operator `(+)`. A printer that removes the first line's parentheses changes the declaration's meaning. A type signature introduces another case, so the fix also adds typed-pattern fixtures.

Related [case-expression](https://github.com/ai-haskell-compiler/aihc-parser/pull/60) and [multi-way-if](https://github.com/ai-haskell-compiler/aihc-parser/pull/61) fixes avoid unnecessary parentheses before `by` and `using` in transform comprehensions. Those keywords close the layout block. Together, these changes show why package compatibility requires both compiler infrastructure and exact treatment of source syntax.
