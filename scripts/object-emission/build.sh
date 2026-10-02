#!/bin/sh
set -eu
# Usage: sh build.sh /absolute/aihc /absolute/output-directory
aihc_dir=$1
output_dir=$2
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
bench_source=$script_dir/Bench.hs
mkdir -p "$output_dir"
python3 "$script_dir/patch-printer.py" \
  "$aihc_dir/bin/aihc/compiler/arm64/src/Aihc/Arm64/Text.hs" \
  "$output_dir/printer/Aihc/Arm64/Text.hs"
cd "$aihc_dir"
# Compile the required compiler modules from source, without the CLI or front end.
cabal exec -- ghc -O2 -XGHC2021 -XOverloadedStrings -rtsopts \
  -i"$output_dir/printer" \
  -ibin/aihc/compiler/arm64/src \
  -ibin/aihc/compiler/amd64/src \
  -ibin/aihc/compiler/native/src \
  -ibin/aihc/compiler/lir/src \
  -ibin/aihc/compiler/grin/src \
  "$bench_source" -outputdir "$output_dir/build" -o "$output_dir/bench"
