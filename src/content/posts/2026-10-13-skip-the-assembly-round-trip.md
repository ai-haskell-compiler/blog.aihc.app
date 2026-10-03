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

We measured **`aihc-base` 4.21.2.0**, rather than a generated example. We compiled the library at `-O0` for macOS ARM64 and captured all **270 module outputs**. We then lowered this same frozen LIR corpus through the ARM64 and AMD64 backends on two machines. The 176 nonempty modules go through object generation; both routes write zero-byte files for the other 94, without invoking an assembler.

Direct output was faster on both machines. These are medians of nine complete passes, with the order alternated between pairs.

| Host and output format | Direct object | ASM + Clang | Output-stage speedup |
| --- | ---: | ---: | ---: |
| M4 Pro, macOS ARM64 / Mach-O | 0.51 s | 24.97 s | 48.6× |
| Intel i7-8705G, Linux AMD64 / ELF | 1.48 s | 10.58 s | 7.1× |

For the pass at the median ASM total, the Mac spent **1.50 seconds** on text generation and writes, and **23.47 seconds** in Clang. The Intel machine spent **2.20 seconds** on text generation and writes, and **8.37 seconds** in Clang. Clang time includes process startup and assembly across 176 invocations.

The speedup depends on the host and target. These runs change the CPU, operating system, object format, and Clang version together.

![Object output time for aihc-base: M4 Pro Mach-O 0.51 versus 24.97 seconds; Intel Linux ELF 1.48 versus 10.58 seconds. Lower is better.](/images/object-emission-throughput.png)

The comparison starts from the **same instruction streams**. Parsing, instruction selection, and register allocation finish before each module's clock starts. We add the module times for a sequential pass. The text route includes printing, file writes, and one Clang integrated assembler invocation per nonempty module. The direct route includes instruction encoding and object writes. C API wrappers are outside this Haskell output comparison. This measures object output, not an entire package build or a parallel build speedup.

The [Mac measurements](/benchmarks/aihc-base-object-emission-m4-pro.json), [Intel measurements](/benchmarks/aihc-base-object-emission-intel-nuc.json), [corpus manifest](/benchmarks/aihc-base-object-corpus.json), and [captured LIR files](/benchmarks/aihc-base-object-corpus.tar.gz) make the experiment reproducible. The [benchmark scripts](https://github.com/ai-haskell-compiler/blog.aihc.app/tree/main/scripts/object-emission) adapt AIHC's fixture printers to emit valid assembly for each target. Validation checks every nonempty module's external symbols. Mach-O instruction bytes match after same-object branch relocations are resolved. ELF decoded instructions match after alignment NOPs, branch addresses, and RIP-relative displacements are normalized. Each target's two rebuilt libraries also pass a program that exercises lists, sorting, large integers, floating-point output, and character conversion.

The shortcut has a price. An object file contains more than instruction bytes: sections, symbols, alignment, and relocations tell the linker how the pieces fit. An external assembler handles those details for its target. Direct output makes them our responsibility. [LLVM's code-generator documentation](https://github.com/llvm/llvm-project/blob/main/llvm/docs/CodeGenerator.md#the-mc-layer) describes the same split between assembly text and object output.

AIHC needs **ELF for its Linux AMD64 target** and **Mach-O for its macOS ARM64 target**. They have separate [ELF](https://github.com/ai-haskell-compiler/aihc/blob/c24d8798f04b8a62ad9ae84bca729922f87d9455/bin/aihc/compiler/native/src/Aihc/Native/Elf.hs) and [Mach-O](https://github.com/ai-haskell-compiler/aihc/blob/c24d8798f04b8a62ad9ae84bca729922f87d9455/bin/aihc/compiler/native/src/Aihc/Native/MachO.hs) writers, with shared machinery for section buffers and fixups. Supporting one format does not finish the other.

Every stage gets a stopwatch. This one also gets two object-format writers. We take on that work so the linker can get its input sooner.
