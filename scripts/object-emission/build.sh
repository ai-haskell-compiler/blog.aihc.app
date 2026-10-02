#!/bin/sh
set -eu
# Usage: sh build.sh /absolute/aihc /absolute/output-directory
aihc_dir=$1
output_dir=$2
bench_source=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)/Bench.hs
mkdir -p "$output_dir"
cd "$aihc_dir"
# Compile the required compiler modules from source, without the CLI or front end.
cabal exec -- ghc -O2 -XGHC2021 -XOverloadedStrings -rtsopts \
  -ibin/aihc/compiler/arm64/src \
  -ibin/aihc/compiler/amd64/src \
  -ibin/aihc/compiler/native/src \
  -ibin/aihc/compiler/lir/src \
  -ibin/aihc/compiler/grin/src \
  "$bench_source" -outputdir "$output_dir/build" -o "$output_dir/bench"
