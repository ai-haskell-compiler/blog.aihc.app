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

We measured **`aihc-base` 4.21.2.0**, rather than a generated example. We compiled the library at `-O0` for macOS ARM64 and captured all **270 module outputs**. The 176 nonempty modules go through object generation; both routes write zero-byte files for the other 94, without invoking an assembler.

On an **M4 Pro MacBook**, direct Mach-O output took **0.51 seconds**, against **24.97 seconds** through assembly text and Clang: about **48.6× faster for this output stage**. These are medians of nine complete passes, with the order alternated between pairs.

![Object output time for the complete aihc-base corpus on an M4 Pro: direct 0.51 seconds versus assembly text and Clang 24.97 seconds. Lower is better.](/images/object-emission-throughput.png)

The comparison starts from the **same instruction streams**. Parsing, instruction selection, and register allocation finish before each module's clock starts. We add the module times for a sequential pass. The text route includes printing, file writes, and one Clang integrated assembler invocation per nonempty module. The direct route includes instruction encoding and object writes. C API wrappers are outside this Haskell output comparison. This measures object output, not an entire package build or a parallel build speedup.

The [raw measurements](/benchmarks/aihc-base-object-emission-m4-pro.json), [corpus manifest](/benchmarks/aihc-base-object-corpus.json), and [captured LIR files](/benchmarks/aihc-base-object-corpus.tar.gz) make the experiment reproducible. The [benchmark scripts](https://github.com/ai-haskell-compiler/blog.aihc.app/tree/main/scripts/object-emission) adapt AIHC's fixture printer to emit valid Mach-O assembly with the same instructions and section placement as the direct writer. Validation compares every nonempty module's instruction bytes and external symbols. Both rebuilt libraries also pass a program that exercises lists, sorting, large integers, floating-point output, and character conversion.

The shortcut has a price. An object file contains more than instruction bytes: sections, symbols, alignment, and relocations tell the linker how the pieces fit. An external assembler handles those details for its target. Direct output makes them our responsibility. [LLVM's code-generator documentation](https://github.com/llvm/llvm-project/blob/main/llvm/docs/CodeGenerator.md#the-mc-layer) describes the same split between assembly text and object output.

AIHC needs **ELF for its Linux AMD64 target** and **Mach-O for its macOS ARM64 target**. They have separate [ELF](https://github.com/ai-haskell-compiler/aihc/blob/c24d8798f04b8a62ad9ae84bca729922f87d9455/bin/aihc/compiler/native/src/Aihc/Native/Elf.hs) and [Mach-O](https://github.com/ai-haskell-compiler/aihc/blob/c24d8798f04b8a62ad9ae84bca729922f87d9455/bin/aihc/compiler/native/src/Aihc/Native/MachO.hs) writers, with shared machinery for section buffers and fixups. Supporting one format does not finish the other.

Every stage gets a stopwatch. This one also gets two object-format writers. We take on that work so the linker can get its input sooner.
