---
title: "Hackage without a server"
description: "hackage.aihc.app is a prototype Hackage built from Cloudflare Workers, D1, R2 and your browser, with every Haskell part compiled to WebAssembly by AIHC."
date: 2026-10-21
authors:
  - Claude
  - Lemmih
draft: false
image: "/images/hackage-aihc-card.png"
imageAlt: "The text-2.1.4 package page split down the middle: hackage.aihc.app on the left, hackage.haskell.org on the right."
imageWidth: 1200
imageHeight: 630
---

[hackage.aihc.app](https://hackage.aihc.app/) is a prototype of [hackage.haskell.org](https://hackage.haskell.org/) with no server. No VM, no database process, no documentation build farm. Here is what it looks like and how it is built.

## Same package, two sites

<figure class="compare">
<div class="compare-frame">
<img src="/images/hackage-aihc/pkg-aihc.png" alt="The text-2.1.4 package page on hackage.aihc.app: a package header, tabs for Description, README, API, Dependencies, Dependents, Changelog and Cabal, the rendered README, and a package details card." width="2560" height="1600" loading="lazy" />
<img class="compare-before" src="/images/hackage-aihc/pkg-haskell.png" alt="The text-2.1.4 package page on hackage.haskell.org: the package description on the left, and the version list and dependency list on the right." width="2560" height="1600" loading="lazy" />
<input class="compare-range" type="range" min="0" max="100" value="50" aria-label="Divider between hackage.haskell.org and hackage.aihc.app" />
<span class="compare-line" aria-hidden="true"></span>
<span class="compare-tag compare-tag-before" aria-hidden="true">hackage.haskell.org</span>
<span class="compare-tag compare-tag-after" aria-hidden="true">hackage.aihc.app</span>
</div>
<figcaption>The <code>text-2.1.4</code> package page at 1280×800. Drag the divider.</figcaption>
</figure>

The data is the same Cabal file. The design is borrowed from [crates.io](https://crates.io/): one page per package, with tabs for the README, API, dependencies, dependents, changelog and Cabal fields. Every page is rendered on the server and works without JavaScript.

## The architecture

<figure class="diagram">
<a href="/images/hackage-aihc-architecture.svg"><img src="/images/hackage-aihc-architecture.svg" alt="Architecture of hackage.aihc.app. The browser reads server-rendered HTML and runs aihc-haddock as WebAssembly in a Web Worker. On Cloudflare, the site Worker renders pages and parses Cabal files, the Workflow Worker runs the dependency solver and verifies uploads, D1 holds indexes and R2 holds files. hackage.haskell.org is only an upstream source." width="960" height="540" loading="lazy" /></a>
<figcaption>Both Workers share the same D1 database and R2 bucket through bindings. Purple boxes are Haskell compiled to WebAssembly by AIHC.</figcaption>
</figure>

hackage.haskell.org runs [hackage-server](https://github.com/haskell/hackage-server), a long-running process on a machine that someone maintains. hackage.aihc.app has no machine:

- **Site Worker** renders the pages and handles search and imports. It parses Cabal files with [`aihc-cabal-syntax`](https://github.com/ai-haskell-compiler/aihc-cabal-syntax), compiled to Wasm.
- **D1** holds versions and the search and dependency indexes. **R2** holds the files: Cabal files, READMEs, source archives and documentation.
- **Workflow Worker** runs the dependency solver, the same one the compiler uses, compiled to Wasm. It fetches only the Cabal files it needs, never the full Hackage index.

hackage.haskell.org stays the source of truth. The site only reads from it.

## Documentation is built by the reader

<figure class="compare">
<div class="compare-frame">
<img src="/images/hackage-aihc/docs-aihc.png" alt="Data.Text documentation on hackage.aihc.app: a module tree on the left, the module text in the middle, a contents list on the right, and a Community badge." width="2560" height="1600" loading="lazy" />
<img class="compare-before" src="/images/hackage-aihc/docs-haskell.png" alt="Data.Text documentation on hackage.haskell.org: a contents sidebar on the left, the module header with copyright and license fields, and the module text." width="2560" height="1600" loading="lazy" />
<input class="compare-range" type="range" min="0" max="100" value="50" aria-label="Divider between hackage.haskell.org and hackage.aihc.app" />
<span class="compare-line" aria-hidden="true"></span>
<span class="compare-tag compare-tag-before" aria-hidden="true">hackage.haskell.org</span>
<span class="compare-tag compare-tag-after" aria-hidden="true">hackage.aihc.app</span>
</div>
<figcaption><code>Data.Text</code> from <code>text-2.1.4</code>. The right-hand side was generated in a browser.</figcaption>
</figure>

There is no documentation server. When a package has no docs, its API tab offers to build them. The browser downloads the sources and runs `aihc-haddock`, compiled to Wasm, in a Web Worker. The result is a JSON model of the API, which the browser uploads. The Worker renders it to HTML when someone reads the page, so readers need neither JavaScript nor Wasm.

An upload starts as a **community** result. The Workflow then rebuilds it with the same `aihc-haddock` binary, and marks it **verified** if the output matches.

## Why this shape

**Serverless.** Nothing to patch, restart or keep running. Cost follows storage and requests, not uptime, and the expensive work runs on the reader's CPU.

**WebAssembly.** The same compiler output runs in the browser, a Worker and a Workflow. Next up: a Haskell interpreter in the browser, so each package page gets a REPL with that package loaded.

**Consistent styling.** Documentation is data, so one renderer draws every package, in the same palette, fonts and light and dark themes as this blog.

## What is missing

It is a prototype. There are no accounts or package uploads, only imported versions, and the generated docs still miss some types and cross-package links. The source is on [GitHub](https://github.com/ai-haskell-compiler/aihc-hackage). To try it, [pick a package](https://hackage.aihc.app/) and open its API tab.
