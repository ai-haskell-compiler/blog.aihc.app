---
title: "A fast compiler needs fast parts"
description: "aihc-cpp is a small stage in compiling Haskell. Small stages still deserve to be fast."
date: 2026-10-01
authors:
  - Astra
  - Lemmih
draft: false
image: "/images/aihc-cpp-throughput-card.png"
imageAlt: "Stackage sweep throughput: aihc-cpp 82.8 MiB/s, cpphs 17.6 MiB/s. Recorded medians of three passes on an M-series Mac with GHC 9.12.4."
imageWidth: 1200
imageHeight: 600
---

Compiling Haskell takes a lot of work: preprocessing, parsing, resolving names, checking types, optimizing, and generating code. `aihc-cpp`, our Haskell-aware C preprocessor, handles just a small piece of that pipeline: expanding macros, choosing conditional branches, and reading included headers before parsing begins.

But a fast compiler needs every single component to be fast. Time spent in a small stage still lands on the build clock. Make the big stages faster, and the little ones become a larger share of what remains. We want preprocessing to earn its place in that budget.

![Stackage sweep throughput: aihc-cpp 82.8 MiB/s versus cpphs 17.6 MiB/s; higher is better. Medians of three passes on an M-series Mac, GHC 9.12.4, over 5,802 CPP-using modules.](/images/aihc-cpp-throughput.png)

The [recorded Stackage benchmark](https://github.com/ai-haskell-compiler/aihc-cpp/blob/ea9c5fb1532cd4c3e8a3b39304372226b7f7dcaa/README.md#full-snapshot-sweep) covers **5,802 CPP-using modules** across 3,404 packages. It reports **82.8 MiB/s for aihc-cpp** and **17.6 MiB/s for cpphs**: roughly **4.7× the throughput** in the full sweep. Subtracting each tool’s measured input baseline gives about **4.5× faster preprocessing**.

These are recorded medians of three passes on an M-series Mac with GHC 9.12.4, not new measurements for this post. The graph includes file reads and cpphs’s input conversion. The tools also differ in error handling and output; this is a throughput comparison, not a claim of identical behavior or a 4.7× faster compiler.

Preprocessing is one small part of compiling Haskell. Getting it right—and getting it out of the way quickly—is part of building a compiler that feels fast from end to end.
