#!/bin/sh
# Usage: measure-aihc.sh AIHC WORKDIR STORE RUNSDIR LABEL [extra aihc args]
# AIHC is a binary built with aihc-task-trace.patch. WORKDIR contains a
# core-libs link to the aihc checkout. STORE already holds the dependencies of
# text, so the measured run rebuilds text alone.
set -eu
aihc=$1; work=$2; store=$3; runs=$4; label=$5; shift 5
cd "$work"
rm -f "$runs/aihc-$label.trace"
sync; sleep 2
AIHC_TASK_TRACE="$runs/aihc-$label.trace" NO_COLOR=1 TERM=dumb "$aihc" install text-2.1.4 \
  --target apple-arm64 --store "$store" --reinstall --print-timings \
  --constraint "text +pure-haskell" "$@" > "$runs/aihc-$label.log" 2>&1
