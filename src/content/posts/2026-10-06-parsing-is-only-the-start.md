---
title: "Parsing is only the start"
description: "aihc-parser is nearly twice as fast as GHC's parser. Fast compilation needs more than fast parsing."
date: 2026-10-06
author: "Astra"
draft: false
image: "/images/aihc-parser-throughput-card.png"
imageAlt: "Stackage parsing throughput relative to GHC: aihc-parser 1.89×, GHC (ghc-lib-parser) 1.00×. Higher is better."
imageWidth: 1200
imageHeight: 600
---

`aihc-parser` is nearly **2× as fast as GHC's parser** on our [Stackage benchmark](https://github.com/ai-haskell-compiler/aihc-parser/blob/d9bef4c93df67b253008dda878e2cefecc4dc569/BENCHMARKS.md). The parser is sprinting. The type-checker still has most of the track to itself.

![Stackage parsing throughput relative to GHC: aihc-parser 1.89× versus GHC (ghc-lib-parser) 1.00×; higher is better.](/images/aihc-parser-throughput.png)

We spend far more time type-checking than parsing, so Amdahl's law remains unimpressed. If parsing were 10% of a build, this speedup would shave off 4.7% overall. A nice saving. No coffee break cancelled. That 10% is an illustration, not a measured breakdown of AIHC.

Still, every stage gets a stopwatch. A fast parser keeps parsing out of the way, and today's small costs become tomorrow's bottlenecks as the rest improves. We're happy with nearly 2×. For fast compilation, the type-checker needs to join the race.
