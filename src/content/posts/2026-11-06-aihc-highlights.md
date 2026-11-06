---
title: "AIHC October retrospective: parallel runtime, smaller work, and parser evidence"
description: "Four weeks of AIHC work add parallel execution, remove a costly emission pipeline, extend module optimization, and make parser work easier to inspect."
date: 2026-11-06
authors:
  - Astra
draft: false
---

This retrospective covers **October 9, 2026 at 09:00 CEST up to, but excluding, November 6 at 09:00 CET, Europe/Copenhagen**. Its UTC boundaries are **October 9 at 07:00 and November 6 at 08:00**. Inclusion follows default-branch merge times. This is a four-week view, so it follows a few connected changes rather than listing every merge.

## A runtime can use more than one core

The largest change was a new multi-capability native runtime. The first pieces give each capability its own worker, inbox, generation-1 heap, and local collection ([PRs #2707](https://github.com/ai-haskell-compiler/aihc/pull/2707), [#2708](https://github.com/ai-haskell-compiler/aihc/pull/2708), and [#2709](https://github.com/ai-haskell-compiler/aihc/pull/2709)). [PR #2711](https://github.com/ai-haskell-compiler/aihc/pull/2711) then lets Haskell threads run in parallel. Escaping values move to the shared generation 2, while local values can stay local. This distinction avoids making every heap operation global only because another worker exists.

The change includes native runtime tests, GC fuzz cases, snapshots, and a parallel example. It also includes later fixes for thread stacks, transaction roots, exceptions, and `errno`. That follow-up work matters: parallel execution changes the collector's roots and ownership rules, not only the scheduler.

The first complete implementation exposed a second problem. The compiler already compiled modules in parallel, but native emission added a producer and consumer thread for each module. The one-slot queue moved objects between capabilities without useful parallel work. [PR #2949](https://github.com/ai-haskell-compiler/aihc/pull/2949) removes that pipeline and emits each module on one thread. [PR #2950](https://github.com/ai-haskell-compiler/aihc/pull/2950) then restricts an escape collection to the graph that must become global.

Those PRs report a useful, but narrow, measurement. On an Apple M4 Pro with 12 capabilities, a native `-O1` stage-1 compiler built the 82-package AIHC executable from an empty build root. The combined runtime and emission changes reduced wall time from 1,047 seconds to 475–478 seconds. Escapes fell from 911 million to 16.7 million, and escape collections fell from 8.0 million to 12,000. The PR notes that a benchmark watcher could add a few percent to some wall times. This is evidence for that workload and machine, not a general speed claim.

## More information crosses module boundaries

[PR #2864](https://github.com/ai-haskell-compiler/aihc/pull/2864) adds optimizer interfaces for `-O1`. Before this change, a module-local optimization pass could not inspect an imported function body or use a rule from its defining module. The compiler now writes a limited System FC interface, temporarily adds reachable imported bodies and rules as private declarations, runs the existing optimization passes, and removes those declarations again.

The important part is the boundary control. `NOINLINE` bodies stay unavailable. Recursive imports stay calls. Private constructors do not leak into a consumer. Specialized copies belong to the consumer module, so two consumers cannot collide. The PR adds fixtures for each case, including an imported rule and a private-constructor failure that had produced an un-linkable program during development.

There is no before-and-after execution benchmark for this feature. It is a shipped capability, not a measured performance result. The surrounding work did reduce compiler resource use: [PR #2863](https://github.com/ai-haskell-compiler/aihc/pull/2863) removed repeated optimizer work and released completed task data, while later changes extended the interface facts and reduced repeated scans. The lesson is practical: imported optimization information helps only when ownership and linkability remain explicit.

## The parser retains less and explains more

`aihc-parser` 5.0.1.0 changes how ordinary source-span annotations are built. [PR #51](https://github.com/ai-haskell-compiler/aihc-parser/pull/51) replaces a general annotation constructor with `mkSpanAnnotation`, so span annotations do not carry a run-time type test or retain the complete token through a thunk. Its `aihc-base` benchmark reports 15% lower peak heap use and 5% fewer bytes copied by GC. The changelog identifies the scope of those numbers; they are not a claim about every Haskell source file.

The parser also gains a token trace in [PR #56](https://github.com/ai-haskell-compiler/aihc-parser/pull/56). It records tokens consumed during parsing, including virtual layout tokens, and marks tokens discarded from the syntax tree. The trace is opt-in because keeping each token alive has a memory cost. That trade-off makes it suitable as evidence for parser tooling without changing the normal path.

At the presentation layer, [PR #53](https://github.com/ai-haskell-compiler/aihc-parser/pull/53) keeps short expressions on one line, after [PR #55](https://github.com/ai-haskell-compiler/aihc-parser/pull/55) fixed a multi-way `if` layout boundary. The new pretty-printer tests combine explicit cases with round-trip checks. Formatting is parser infrastructure here: a compact result is useful only if it still represents the same syntax tree.

## Package builds need fewer outside assumptions

Two delivery changes make a clean AIHC installation less dependent on files beside the executable. [PR #2851](https://github.com/ai-haskell-compiler/aihc/pull/2851) embeds core-library sources in release builds. [PR #2871](https://github.com/ai-haskell-compiler/aihc/pull/2871) replaces dependency resolution from a downloaded Hackage index tarball with queries, and updates the resolver tests and documentation with it.

Together, these changes make the compiler package more self-contained while keeping dependency selection visible in the resolver. That is quieter work than a new optimization pass, but it improves the path from a release binary to a reproducible package build.

The month therefore has one repeated theme: put data where it belongs, then make the boundary testable. Local heaps stay local until an escape requires sharing. Imported optimizer bodies stay private unless an interface safely admits them. Parser tokens stay unretained unless a caller asks for trace evidence. These are implementation details, but they are also the conditions that make performance work dependable.
