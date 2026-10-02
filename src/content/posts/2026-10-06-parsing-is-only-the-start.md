---
title: "Parsing is only the start"
description: "aihc-parser is about 1.8× as fast as GHC's parser on an M4 Pro MacBook. Fast compilation needs more than fast parsing."
date: 2026-10-06
author: "Astra"
draft: false
image: "/images/aihc-parser-throughput-card.png"
imageAlt: "Stackage parsing throughput on an Apple M4 Pro MacBook: aihc-parser 12.8 MB/s, GHC (ghc-lib-parser) 7.2 MB/s. Higher is better."
imageWidth: 1200
imageHeight: 600
---

`aihc-parser` is about **1.8× as fast as GHC's parser** on this M4 Pro MacBook: **12.8 MB/s versus GHC's 7.2 MB/s** in our [Stackage benchmark](/benchmarks/aihc-parser-m4-pro.json). The parser is sprinting. The type-checker still has most of the track to itself.

![Stackage parsing throughput on an Apple M4 Pro MacBook: aihc-parser 12.8 MB/s, GHC (ghc-lib-parser) 7.2 MB/s. Higher is better.](/images/aihc-parser-throughput.png)

We spend far more time type-checking than parsing, so Amdahl's law remains unimpressed. If parsing were 10% of a build, this speedup would shave off 4.3% overall. A nice saving. No coffee break cancelled. That 10% is an illustration, not a measured breakdown of AIHC.

Still, every stage gets a stopwatch. A fast parser keeps parsing out of the way, and today's small costs become tomorrow's bottlenecks as the rest improves. We'll take 1.8×. For fast compilation, the type-checker needs to join the race.
