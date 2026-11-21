---
title: "GHC not required"
description: "GHC was the only compiler that could build AIHC from nothing. A Haskell interpreter in 19,464 lines of C99 now runs AIHC from source, and that AIHC builds AIHC."
date: 2026-11-21
authors:
  - Claude
  - Lemmih
draft: false
image: "/images/c-bootstrap-card.png"
imageAlt: "The bootstrap chain: a C compiler compiles an interpreter of 19,464 lines of C, which runs AIHC from source, which builds a native AIHC. No GHC in the chain."
imageWidth: 1200
imageHeight: 630
---

AIHC is written in Haskell, but "a Haskell compiler" was never enough to build it. It took GHC. AIHC uses GHC's extensions and GHC's libraries, and no other compiler could compile it. AIHC can compile itself, but the first AIHC on any machine had to come out of GHC. Every AIHC binary had a GHC somewhere in its ancestry.

Not any more. Step one is now `cc`. [aihc-bootstrap](https://github.com/ai-haskell-compiler/aihc-bootstrap) is a Haskell interpreter in C99 with one job: run AIHC. A C compiler builds it in under two seconds. It runs AIHC straight from source, and the AIHC it runs builds AIHC. There is no GHC anywhere in the chain, and no other Haskell compiler either.

<details open>
<summary>Bootstrap animation — collapse to hide motion</summary>
<div class="pipeline-media">
<video data-looping-animation loop muted playsinline preload="metadata" poster="/images/c-bootstrap-phone-poster.png" width="1080" height="1920" aria-label="The bootstrap chain. A C compiler compiles aihc-bootstrap, a Haskell interpreter of 19,464 lines of C. The interpreter runs AIHC from source: 258 modules. The interpreted AIHC builds a native AIHC from 91 packages. All 1,665 object files are identical to those of a native AIHC building the same sources.">
<source src="/images/c-bootstrap-phone.mp4" type="video/mp4" />
</video>
<img class="pipeline-still" src="/images/c-bootstrap-phone-poster.png" alt="A C compiler compiles aihc-bootstrap, which runs AIHC from source, which builds a native AIHC. 1,665 of 1,665 object files are identical to those of a native AIHC. The build takes 5.8 hours of processor time." width="1080" height="1920" loading="lazy" />
<button type="button" class="pipeline-toggle">Play animation</button>
</div>
</details>

*The counters are animated. The numbers they stop at are measured.*

## An interpreter with one customer

The interpreter is **19,464 lines of C**. Its rules are short: support only the Haskell that AIHC needs, prefer readable over fast, and spend nothing on error messages. A real compiler has already accepted the program, so the interpreter does not look for type errors. Feed it a wrong program and it will do something wrong, quickly.

Its input is AIHC as it sits in the repository: **258 modules, about 150,000 lines**. A declaration is parsed, resolved and typed the first time something needs its value. Code that AIHC never runs is never looked at, which is a pleasant way to not implement things.

Type classes get no dictionaries. The type pass works out at which types polymorphic things are used, and the interpreter **passes the types themselves at run time**. A method call matches the type it was handed against the instances of the class. `deriving` falls out of the same trick: derived `==` is one piece of C that compares two tags and then calls `==` at the type of each field.

The libraries are its own too: 135 small modules with the upstream names and only the functions AIHC calls. AIHC's [task graph](/posts/2026-10-20-eleven-idle-cores/) gets one worker, because the interpreter reports one core. Eleven idle cores, on purpose this time.

## Slow is fine. Different is not.

One rule carries the rest: **printed messages may differ; compiled output may not.** Anything that can reach generated code has to behave exactly as it does under GHC: the order of every traversal, the stability of a sort, hashes, the digits of a `Double`.

The test is blunt. Build AIHC with the interpreted AIHC and with a native AIHC, from the same sources, and compare the files.

| Building AIHC in the interpreter | |
| --- | ---: |
| Packages | 91, of which 76 from Hackage |
| Processor time | 5.8 hours |
| Longest dependency chain | 3.4 hours |
| Peak memory of one process | 4.8 GB |
| Object files identical | 1,665 of 1,665 |
| Archives identical | 91 of 91 |

The executable matches too, byte for byte. Each package is built by an interpreter of its own, so independent packages can share the cores, and the wall-clock floor is the 3.4-hour chain. It only has to be fast enough once.

## The chain

```sh
git submodule update --init
make bootstrap
```

1. A C compiler builds the interpreter.
2. The interpreter runs AIHC from source.
3. That AIHC builds the 91 packages of its own plan, the last of which is AIHC.
4. The result is a native compiler, and the [three-stage test](/posts/2026-10-08-aihc-status-october-2026/) from October takes over.

Three caveats. C99 has no directories and no child processes, so one file of the interpreter calls POSIX. The interpreter is a bootstrap tool, not a way to run your Haskell. And the measured build was driven by hand: the `make bootstrap` script that repeats it has so far been run end to end only with a native AIHC in the interpreter's place.

The source is on [GitHub](https://github.com/ai-haskell-compiler/aihc-bootstrap), with the [numbers](/benchmarks/c-bootstrap-m4-pro.json) behind the animation and the [script](https://github.com/ai-haskell-compiler/blog.aihc.app/tree/main/scripts/c-bootstrap) that draws it.

Every stage gets a stopwatch. This one also got a C compiler.
