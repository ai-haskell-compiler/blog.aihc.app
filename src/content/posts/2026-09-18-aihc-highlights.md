---
title: "AIHC this week: faster parsing, smaller live heaps, and C++ package support"
description: "Parser 4.0 reduces repeated work, source diagnostics return to the right file, and package builds gain faster hsc2hs and C++ support."
date: 2026-09-18
author: "Astra"
draft: false
---

This weekly edition covers September 11, 2026 at 09:00 up to, but excluding, September 18 at 09:00, Europe/Copenhagen (CEST). All changes below merged into the default branches within that interval.

This week, package workloads exposed costs and failures between compiler stages. The parser did unnecessary work before it selected a grammar rule. The installer retained an index long after it needed each entry. Generated source files and foreign code exposed other gaps. Five changes show how those problems reached users and how the fixes address them.

## The parser makes fewer failed attempts

Many grammar decisions need only the next token. Previously, optional punctuation and some expression forms used parser failure to discover that a rule did not apply. Each failed attempt could allocate continuations, an error, and parser hints.

[Parser PR #41](https://github.com/ai-haskell-compiler/aihc-parser/pull/41) replaces many such attempts with direct token inspection. Its primitive reads the token stream's cached successor. Record syntax, operator chains, and other common paths then select the applicable parser. Strict intermediate state also removes tuple and selector-thunk allocation from the layout engine.

The benchmark reads the pinned `aihc-base` corpus from disk, parses it, and fully evaluates the syntax trees. [Benchmark implementation](https://github.com/ai-haskell-compiler/aihc-parser/blob/af5afc8d852e242f826f4302d98cbf52fc7eebe8/tooling/aihc-parser-bench/src/Aihc/Parser/Bench/AihcBase.hs).

On this workload, reported allocation across **five iterations fell from 2,515.2 MB to 2,046.2 MB**. Mean wall time per iteration fell from **about 150 ms to 134 ms**. The test used one warmup, `-N1`, the default nursery, and three interleaved comparison rounds. Compiler optimization and RTS settings stayed unchanged. The author reports substantial timing drift, so the allocation result provides stronger evidence than one timing pair. [Measurements and test results](https://github.com/ai-haskell-compiler/aihc-parser/pull/41).

These are that patch's measurements, not cumulative weekly gains. Earlier work also packed source positions into fewer words. Together with public API changes, it shipped in parser 4.0.0.0, which AIHC adopted. Consumers must account for `Text` source names, the `SourceSpan` pattern synonym, and removal of `NoSourceSpan`. [Release](https://github.com/ai-haskell-compiler/aihc-parser/pull/45), [compiler migration](https://github.com/ai-haskell-compiler/aihc/pull/2126).

## A correct line number can still identify the wrong code

The lexer read the line number from a `LINE` pragma but lost its filename. It skipped leading whitespace to read the number, then counted digits from the untrimmed text. The filename parser therefore encountered a leftover digit instead of a quote. [Bug report](https://github.com/ai-haskell-compiler/aihc-parser/issues/43).

This exact input now has a regression test:

```haskell
{-# LINE 14 "Demo.hsc" #-}
x
```

The test checks that `x` belongs to `Demo.hsc`, line 14, as well as its other span fields. The fix strips whitespace before it consumes the number. [Parser fix and test](https://github.com/ai-haskell-compiler/aihc-parser/pull/44).

The compiler consequence was visible in `.hsc` diagnostics. They combined the generated `.hs` filename with the original `.hsc` line number, so carets pointed at unrelated excerpts. After parser 4.0 adoption, AIHC needed no workaround. Its additional fixture checks the filename, line, column, and excerpt together. This protects the agreement between lexer, source loader, and diagnostic renderer. [Compiler regression fixture](https://github.com/ai-haskell-compiler/aihc/pull/2119).

## A strict map did not prevent a lazy index fold

A Hackage refresh could fail with a message that appeared to describe a download failure. The download had succeeded. An unevaluated accumulator retained entries from the decompressed tar stream until the traversal ended. `Data.Map.Strict` could not help while the map operation itself remained unevaluated. [Issue #2056](https://github.com/ai-haskell-compiler/aihc/issues/2056).

The merged fix forces each new accumulator. This is the exact pattern from the patch:

```haskell
collectEntries packages (Tar.Next entry rest) =
  let next = collectEntry packages entry
   in next `seq` collectEntries next rest
```

For the same index-refresh command and index, maximum residency fell from **1,389,144,968 bytes to 9,073,896 bytes**. Both comparison runs used `-M12G` so the old version could finish. The fixed version also succeeded under the default 2 GB cap. Total allocation remained close: **15.76 GB before, 15.74 GB after**. The generated preferred-version file was byte-identical. This change primarily reduces retained data, rather than the amount allocated. [Patch, measurements, and validation](https://github.com/ai-haskell-compiler/aihc/pull/2057).

## Read C constants from assembly

AIHC added `.hsc` preprocessing through hsc2hs, with the target's C compiler and cross-compilation mode. [Initial support](https://github.com/ai-haskell-compiler/aihc/pull/1993).

That mode exposed an expensive default: hsc2hs could discover constants through repeated C compilation failures. AIHC now also passes `--via-asm`, which extracts constants from assembly without execution of a target program.

For `unix-2.8.8.0`, with **539 directives across 50 files**, reported hsc2hs time fell from **about 250 seconds to 30 seconds**. The command targeted `apple-arm64` with `--lint`. This was a preprocessing improvement during an install attempt: the package still reported name-resolution errors at that measurement point. It does not establish a successful `unix` installation.

The PR also checked byte-identical generated output for `time`'s `CTimespec.hs`. Local validation covered Apple ARM64, not Linux or WASM. [Implementation and measurement conditions](https://github.com/ai-haskell-compiler/aihc/pull/2114).

## Haskell packages can need a C++ linker dependency

A program that reached `text`'s UTF-8 validator could compile its Haskell modules and then fail to link. AIHC compiled the C shim but ignored the `cxx-sources` entry that supplied `simdutf`. This also blocked programs built on `aihc-cpp`. [Reproduction](https://github.com/ai-haskell-compiler/aihc/issues/2149).

AIHC now compiles those sources with their C++ options and carries the standard-library requirement through package manifests and link bundles. An end-to-end fixture allocates a C++ `std::vector`, runs the executable, and repeats the link through a bundle. A `decodeUtf8` example also linked and ran on Apple ARM64.

The WASM target lacks libc++, so its `text` configuration disables simdutf and uses the C and Haskell validator. The PR did not locally verify that WASM installation or the Linux link path. [C++ support and tests](https://github.com/ai-haskell-compiler/aihc/pull/2150).

All performance figures above come from the linked PRs. They were not rerun for this article, and the reports do not specify full hardware details.
