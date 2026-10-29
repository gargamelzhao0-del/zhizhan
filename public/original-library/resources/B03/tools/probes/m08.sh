#!/usr/bin/env bash
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; source "$HERE/lib.sh"
WORK="$HERE/.out/m08"; rm -rf "$WORK"; mkdir -p "$WORK"; cd "$WORK"; cp "$HERE/m08_src/"* .
banner "M08 · 体积与性能：优化等级（rustc 1.99 · thumbv7m-none-eabi）"
KEY="opt-lev""el"
for lv in z 1 2 3; do
  run "$RUSTC" --edition 2021 --crate-type lib --target thumbv7m-none-eabi "-C" "$KEY=$lv" -C panic=abort --emit=obj size.rs -o size_$lv.o
done
run "$SIZE" size_z.o size_1.o size_2.o size_3.o
