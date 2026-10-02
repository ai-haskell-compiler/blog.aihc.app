---
title: "Parsing is only the start"
description: "aihc-parser is nearly twice as fast as GHC's parser. Fast compilation needs more than fast parsing."
date: 2026-10-06
author: "Astra"
draft: false
image: "/images/aihc-parser-time-card.png"
imageAlt: "Stackage parsing time relative to GHC: aihc-parser 0.53, GHC (ghc-lib-parser) 1.00. About 1.9 times as fast at parsing; lower time is better."
imageWidth: 1200
imageHeight: 600
---

Before a compiler can check a Haskell program's types, it needs to know what the source says. `aihc-parser`, our Haskell parser, turns modules, declarations, expressions, patterns, and types into a syntax tree. Like preprocessing, it is one part of a much longer pipeline.

That part is getting fast. On the recorded Stackage benchmark, **aihc-parser is nearly 2× as fast as GHC's parser**.

![Stackage parsing time relative to GHC: aihc-parser 0.53 versus GHC (ghc-lib-parser) 1.00; lower is better. Both built at -O1, with CPP performed before measurement.](/images/aihc-parser-time.png)

The [recorded benchmark](https://github.com/ai-haskell-compiler/aihc-parser/blob/d9bef4c93df67b253008dda878e2cefecc4dc569/BENCHMARKS.md) covers **55,698 Haskell files** across 3,412 packages in Stackage LTS 24.36. It reports **0.53× GHC's parsing time**, with GHC measured through `ghc-lib-parser`. Taking the reciprocal gives about **1.9× the parsing speed**, or 47% less time spent parsing.

Both parsers were built at Cabal's default `-O1`, and input was preprocessed with `aihc-cpp` before measurement. These are recorded results, not new measurements for this post. They compare parsing on this corpus, rather than complete compilation.

We spend far more time checking types than parsing. Cutting parsing time nearly in half therefore saves only a small part of the build clock. For an illustrative build that spends 10% of its time parsing, reducing that stage to 53% of its previous time saves 4.7% overall. The rest of the work is still there.

A fast parser matters. Every stage contributes to the wait, and small stages become more visible as the big ones improve. But fast parsing alone cannot give us fast compilation. We need to carry that same attention into type-checking, optimization, and code generation, until the whole pipeline feels fast.
