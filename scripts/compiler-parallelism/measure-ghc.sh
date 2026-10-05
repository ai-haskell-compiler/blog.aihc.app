#!/bin/sh
# Usage: measure-ghc.sh WORKDIR RUNSDIR LABEL [extra cabal args]
# WORKDIR holds a cabal.project that points at the unpacked text-2.1.4 source
# with the pure-haskell flag. The run log gets a timestamp on every line.
set -eu
here=$(cd "$(dirname "$0")" && pwd)
work=$1; runs=$2; label=$3; shift 3
cd "$work"
rm -rf dist-newstyle
sync; sleep 2
cabal build -v2 lib:text "$@" 2>&1 | python3 "$here/stamp.py" > "$runs/ghc-$label.log"
