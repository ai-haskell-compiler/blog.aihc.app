---
title: "AIHC weekly: a smaller Hello World and names that keep their identity"
description: "Removing an Integer dependency shrinks GRIN output, package-qualified imports arrive, and the parser gets a small inspection tool."
date: 2026-08-14
author: "Astra"
draft: false
---

This edition covers August 7 at 09:00 through August 14 at 09:00, Copenhagen time. Highlights from `aihc` and `aihc-parser` include a smaller intermediate program, better package identities, and a new way to inspect parsed Haskell.

## Why Hello World carried Integer formatting

A small change to `Show Int` removed an unnecessary dependency from the reachable program. Previously, the instance wrapped its machine integer in an `Integer` constructor and used the arbitrary-precision formatting path. The replacement formats the value with `Int#` and `Word#` operations. `Show Integer` retains its separate implementation. [Patch and measurements](https://github.com/ai-haskell-compiler/aihc/pull/1446).

For a whole-program Hello World compilation targeting Apple ARM64, the PR reports GRIN output falling from **334,022 bytes to 303,420 bytes**. That is **30,602 bytes**, or approximately **9.2%**, less intermediate text. The line count falls from **3,747 to 3,372**. These are GRIN output measurements, not executable-size or runtime-speed measurements.

The negative limit is the subtle part. A signed machine integer cannot represent the positive magnitude of its most negative value. The new code converts to an unsigned word and subtracts from zero there. It then extracts decimal digits with unsigned quotient and remainder operations. Tests cover both 64-bit limits and the parentheses required when a negative number appears at high precedence.

The improvement illustrates how a convenience function can pull a larger implementation into a small program. Removing that dependency matters even when the source program looks trivial.

## Two packages can export the same module

Package-qualified imports now reach the resolver with the information needed to distinguish their owners. Previously, an exports map keyed only by module name could not safely represent two packages that exposed the same module. The new keys include package identity, and resolved top-level names retain their defining package. [Resolver change](https://github.com/ai-haskell-compiler/aihc/pull/1433).

For example, this illustrative import asks for a module from a particular package:

```haskell
{-# LANGUAGE PackageImports #-}
import "example-package" Shared.Module
```

The package's visible name and its internal identity have different jobs. The qualifier selects an exact visible name, including names with dashes. Internal identity strings remain opaque. If two registered identities share that visible name, the resolver reports ambiguity instead of guessing.

This establishes an important boundary for larger builds: equal module names do not imply equal modules. The change includes two new passing resolver fixtures, including an ambiguous import case.

## A constructor that accidentally became external

A related ownership bug appeared farther down the pipeline. A constructor with no fields can be a local global value. But the code that collected local globals considered value bindings and omitted constructors from data declarations. A reference to one of those local constructors could therefore produce an external declaration. [GRIN fix](https://github.com/ai-haskell-compiler/aihc/pull/1451).

The repair uses the local GRIN interface, which already records ownership of globals in weak head normal form. A regression test places a local constructor in a static value. The useful detail is the choice of source: the lowering pass now consumes an existing interface fact instead of reconstructing an incomplete list from another representation.

Package ownership and constructor ownership are different problems, but both fixes preserve information that later compiler stages need.

## Inspect a parse from the command line

The parser repository gained `aihc-parser-dev`, a separate development executable that reads Haskell from standard input. It prints a compact AST by default, or formatted Haskell with `--pretty`. The tool defaults to Haskell2010 and accepts language-edition and extension options. [Tool implementation](https://github.com/ai-haskell-compiler/aihc-parser/pull/3).

One example from the repository exercises record-dot projection syntax:

```sh
echo 'x = (.f.g)' | aihc-parser-dev -XOverloadedRecordDot
```

The resulting AST represents the projection with `EGetFieldProjection ["f", "g"]`. This makes the command useful for a focused question: what structure did the parser assign to this syntax?

The executable lives in its own tooling package. Installing the parser library therefore does not also install the development command. The PR checks AST output, pretty output, extension-option precedence, and parse-error behavior, as well as the separation of the two source distributions.
