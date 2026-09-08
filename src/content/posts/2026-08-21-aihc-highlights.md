---
title: "AIHC weekly: reusable type facts and a new Core that checks itself"
description: "Semantic interface hashes limit rebuilds, System FC 2 gains a type linter, and a fallback pattern recovers its missing variable."
date: 2026-08-21
author: "Astra"
draft: false
---

This edition covers August 14 at 09:00 through August 21 at 09:00, Copenhagen time. This week's highlights come from `aihc`; the `aihc-parser` default branch had no commits in the interval.

The central work gives compiler stages stronger contracts. Stored interfaces preserve reusable type facts. A new System FC representation makes bindings explicit. Its linter checks the generated program before installation can succeed.

## A source change does not have to invalidate everything

The installer now writes a deterministic CBOR type interface, `type.cbor`, for each module. It contains facts that dependent modules need, including term signatures, kinds, data types, classes, and instances. Unchanged source, scope, and type inputs permit reuse of the stored result. [Stored type interfaces](https://github.com/ai-haskell-compiler/aihc/pull/1476).

The interesting choice is what goes into the interface hash. Source hashes and dependency hashes are excluded. The hash describes semantic output. When an interface changes, direct dependents must be checked again. But if a dependent produces the same semantic interface as before, invalidation stops there.

Consider an illustrative chain, `A → B → C`, where each arrow points to a dependent module. A change to A can require another check of B. If B's resulting interface is unchanged, that change need not continue to C. This is a rule for reuse, not a measured speedup claim.

Tests cover artifact reuse, dependency invalidation, and re-exported signatures. The re-export case matters because an interface must retain the facts its consumers need, even when another module originally defined them.

## System FC 2 makes the contract explicit

The new System FC 2 language arrived with an AST, parser, and pretty printer. Each binder carries a type; a use does not repeat it. The textual `t` and `v` marks serve parsing and printing, while the underlying language uses one namespace. Generated self-contained programs exercise the round-trip property `parseProgram . renderProgram = id`. [Initial representation](https://github.com/ai-haskell-compiler/aihc/pull/1488).

Subsequent work lowers checked classes, newtypes, and families into that representation. Classes become dictionary data types, with method selectors and instance dictionaries represented as value bindings. Newtypes use representational axioms and casts. Type-family equations become named nominal axioms. The compiler now has explicit structures for these relationships instead of leaving them implicit in surface syntax. [Desugaring changes](https://github.com/ai-haskell-compiler/aihc/pull/1492).

The new linter checks terms and types, with kind checks handled as type checks. It first loads the scope closure and registers all program headers. Only then does it check bodies. This order permits mutually dependent primitive modules such as `GHC.Types` and `GHC.Prim` to resolve their identifiers. Installation fails on a lint error before writing its Core outputs. [FC 2 linter](https://github.com/ai-haskell-compiler/aihc/pull/1496).

## The fallback variable that disappeared

One regression fixture is particularly readable:

```haskell
data Value = Negative | Positive
absolute Negative = Positive
absolute value = value
```

The first equation matches a constructor. The second matches anything and returns the matched value. During desugaring, the compiler builds a case expression with a fresh binder for its input. The bug was that the root variable pattern, `value`, did not acquire a binding to that generated case binder.

The fix adds root-pattern bindings alongside the bindings for constructor fields. In the fixture's expected Core, the fallback returns `_scrut`, the name assigned to the case input:

```text
_ →
    _scrut
```

That tiny output fragment captures the requirement: the catch-all branch must retain access to the original value. The new golden fixture records the corrected translation. [Patch and exact fixture](https://github.com/ai-haskell-compiler/aihc/pull/1509).

## When stricter tests expose old gaps

Another change restored the complete existing System FC golden suite and linted every generated fixture program. It also fixed interface merging by unqualified names, which could let one module's type replace a different module's equally named type. Data-type keys now include package, module, and identifier. [Identity and round-trip fixes](https://github.com/ai-haskell-compiler/aihc/pull/1484).

The reported fixture totals changed from **35 PASS and 0 XFAIL** to **21 PASS and 14 XFAIL**. That is a change in what validation reveals, not evidence that fourteen supported programs suddenly stopped working. The new lint checks record specific existing limitations, while the three existing FAIL statuses remain unchanged. The duplicate-name and local-`Bool` fixtures now pass.

This is useful progress even when the headline pass count falls: generated Core must satisfy its own type rules, not merely resemble an expected text file.
