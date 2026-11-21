# C bootstrap artwork

The November 21 post, "GHC not required", describes
[aihc-bootstrap](https://github.com/ai-haskell-compiler/aihc-bootstrap), the
Haskell interpreter in C99 that runs AIHC. `artwork.mjs` draws its link card,
a 1080×1920 poster and a vertical 1080×1920 H.264 loop from
`public/benchmarks/c-bootstrap-m4-pro.json`:

```sh
npm run render
node scripts/c-bootstrap/artwork.mjs --stills   # card and poster only
```

The MP4 is not committed. The GitHub Actions workflow runs `npm run render`
before every build and deploy. The encoder is the pinned `ffmpeg-static`
package; set `FFMPEG` to use another binary.

## Where the numbers come from

Everything is at aihc-bootstrap commit `0c212c3`, which pins AIHC at
`fe89952b7`.

- **Lines of C:** `wc -l src/*.c src/*.h`.
- **Interpreter build time:** `make clean && time make` on an Apple M4 Pro
  MacBook with Apple clang 21.0.0.
- **AIHC modules and lines:** the `.hs` files in the source directories that
  `scripts/run-aihc.sh` hands to the interpreter, without the interpreter's
  own `lib/` and `glue/`.
- **The self-build** (packages, processor time, longest chain, peak memory,
  identical files): from
  [pull request 21](https://github.com/ai-haskell-compiler/aihc-bootstrap/pull/21).
  That build was driven by hand. `make bootstrap` repeats it; the script has
  been run end to end with a native AIHC as the runner, not yet with the
  interpreter.
