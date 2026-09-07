---
title: "AIHC weekly: separate compilation, executable builds, and a disappearing type binder"
description: "A new executable build path, incremental library archives, and two small examples of why compiler type binders matter."
date: 2026-08-28
author: "Astra"
draft: false
---

This edition covers August 21 at 09:00 through August 28 at 09:00, Copenhagen time. The main changes are in `aihc`. The `aihc-parser` default branch had no commits in this interval.

The week's central change is a more practical path from Haskell modules to an executable. Alongside it, two type-system fixes show how apparently small bookkeeping errors can break valid programs.

## One object per module, one archive per library

The compiler can now install incremental library archives. Each module produces its own object file, and each library gets a static archive. Backends compile individual modules without the previous program-layout and module-initializer inputs. At link time, undefined symbol references select the required archive members. The change covers Apple ARM64, Linux AMD64, LLVM, and Wasm targets. [Implementation and validation](https://github.com/ai-haskell-compiler/aihc/pull/1535).

This matters because separate compilation needs stable agreements between modules. Constructor and global-value symbols now have deterministic names. Target-specific package directories also prevent one target's artifacts from overwriting another's. Wasm uses the same archive-based link model, with a validation case that links against `libaihc-prim.a` using `wasm-ld`.

The payoff is architectural rather than a measured speedup in this week's evidence: the linker can assemble separately compiled pieces. We do not yet attach a timing claim to this change.

## An executable command that uses those pieces

The new `build-exe` command connects that library model to an end-user operation. It finds local modules through source directories, resolves package constraints against compiled metadata, compiles objects, and links an executable. It also adds the implicit `aihc-base` and `aihc-prim` dependencies and prepares an absent target runtime. [Command implementation](https://github.com/ai-haskell-compiler/aihc/pull/1543).

An illustrative invocation, using the options introduced in that change, is:

```sh
aihc build-exe Main.hs --target apple-arm64 -o hello
```

The PR reports compilation of every program in `examples/` for Apple ARM64. That is concrete evidence for the new path, though it does not establish compatibility with arbitrary Hackage applications. Later fixes in the same week corrected the installation pipeline and made it archive module objects directly. [Pipeline correction](https://github.com/ai-haskell-compiler/aihc/pull/1557), [archive correction](https://github.com/ai-haskell-compiler/aihc/pull/1555).

## The type synonym that lost its parameter

A useful compiler regression can fit in three lines. This Haskell example illustrates the shape of the new System FC regression fixture:

```haskell
type Identity a = a
true :: Identity Bool
true = True
```

The interesting part is inside the compiler. Its synonym-unfolding code removed `forall` binders before the existing substitution operation could apply the synonym's arguments. But those binders carry the relationship between the parameter and its uses. Remove that relationship too early, and `Identity Bool` cannot be handled correctly.

The fix preserves the synonym body, including its binders, and lets substitution do its job. It replaces `unfoldType env (stripForAlls body)` with `unfoldType env body` and deletes the stripping helper. A new passing FC lint fixture checks the parameterized synonym. Small patch, useful lesson: type binders are part of the computation. [Fix and exact fixture](https://github.com/ai-haskell-compiler/aihc/pull/1559).

## A hidden type needs a scope, too

Existential constructor patterns exposed a related issue. When a case alternative opens an existential package, the alternative needs a binder for its hidden type. Only then can a field use that type inside the alternative.

The new passing FC fixture makes this explicit:

```text
1.vBox @(a : 2.tType) (value : a) →
  x
```

Here, `a` enters scope with the constructor match, and `value` has type `a`. The patch carries these binders through desugaring, syntax, parsing, printing, and lint. It also adds a failing fixture for an unbound existential pattern. The paired fixtures check both valid scope and its absence. [Existential-pattern fix](https://github.com/ai-haskell-compiler/aihc/pull/1519).

## A runtime limitation at this cutoff

The semispace garbage collector was disabled this week. Its command-line option now produces a clear error, and active Nix checks no longer select it. The implementation remains in the repository, but it is not an available collector in this edition's snapshot. [Collector change](https://github.com/ai-haskell-compiler/aihc/pull/1542).

That limitation belongs beside the new build capabilities: a successful compiler pipeline and a usable runtime must advance together.
