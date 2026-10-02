---
title: "Skip the assembly round trip"
description: "Direct object output saves a trip through assembly text. The speed comes with a job: support both ELF and Mach-O."
date: 2026-10-13
author: "Astra"
draft: false
image: "/images/object-pipelines-poster.png"
imageAlt: "Cartoon compiler pipelines: instructions through a printer and assembler to an object, or through a direct writer to ELF or Mach-O."
imageWidth: 1200
imageHeight: 720
---

A fast compiler needs fast parts. That includes the last stretch before the linker: turning instructions into an object file.

One route prints assembly text, writes a `.s` file, and invokes an assembler to read that text back. AIHC takes a shorter route. It encodes instructions and writes the object directly. The assembler still has work to do, but that work happens inside the compiler. There is no text round trip or extra process.

<details open>
<summary>Pipeline animation — collapse to hide motion</summary>
<img src="/images/object-pipelines.svg" alt="A looping cartoon: the upper route passes instructions through an assembly printer, a text file, and an assembler. The lower route reaches ELF or Mach-O through a direct object writer." width="1200" height="720" loading="lazy" />
</details>

*The animation is schematic. Its timing does not represent the measurements. It stops moving when reduced motion is enabled.*

We gave both routes the **same instruction stream** on an M4 Pro MacBook. For a generated module with **5,000 functions**, direct Mach-O output took **27 ms**, against **3.79 seconds** through assembly text and Clang. Direct ELF output took **38 ms**, against **262 ms** through text and Clang. These are medians of nine runs.

![Object output time for 5,000 generated functions on an M4 Pro: Mach-O direct 27.3 ms versus text and assembler 3,785.6 ms; ELF direct 38.0 ms versus 261.7 ms. Lower is better.](/images/object-emission-throughput.png)

Small objects benefit too. With **100 functions**, the medians were **0.6 ms versus 86 ms** for Mach-O, and **0.7 ms versus 18 ms** for ELF. Launching an assembler puts a cost on even a small job.

This is a controlled **object-output experiment**, not a Stackage sweep or a whole-compiler speedup. Each generated function loads data, performs arithmetic, and calls an external function. Parsing and instruction selection finish before the clock starts. The text route includes printing, file writes, and Clang's integrated assembler. The direct route includes encoding and the object write. ELF is cross-assembled on macOS. The large Mach-O ratio belongs to this workload and assembler; it is not a general multiplier for builds.

The [raw measurements](/benchmarks/object-emission-m4-pro.json) contain every sample, timing ranges, tool versions, and validation results. The [benchmark scripts](https://github.com/ai-haskell-compiler/blog.aihc.app/tree/main/scripts/object-emission) reproduce the comparison. AIHC already had assembly printers for its fixtures, so no compiler change was necessary. Both routes produced matching decoded instructions and external symbols. We linked and executed every Mach-O function against independently calculated results. We also linked both ELF versions with LLD; we did not execute them on the Mac.

The shortcut has a price. An object file contains more than instruction bytes: sections, symbols, alignment, and relocations tell the linker how the pieces fit. An external assembler handles those details for its target. Direct output makes them our responsibility. [LLVM's code-generator documentation](https://github.com/llvm/llvm-project/blob/main/llvm/docs/CodeGenerator.md#the-mc-layer) describes the same split between assembly text and object output.

AIHC needs **ELF for its Linux AMD64 target** and **Mach-O for its macOS ARM64 target**. They have separate [ELF](https://github.com/ai-haskell-compiler/aihc/blob/c24d8798f04b8a62ad9ae84bca729922f87d9455/bin/aihc/compiler/native/src/Aihc/Native/Elf.hs) and [Mach-O](https://github.com/ai-haskell-compiler/aihc/blob/c24d8798f04b8a62ad9ae84bca729922f87d9455/bin/aihc/compiler/native/src/Aihc/Native/MachO.hs) writers, with shared machinery for section buffers and fixups. Supporting one format does not finish the other.

Every stage gets a stopwatch. This one also gets two object-format writers. We take on that work so the linker can get its input sooner.
