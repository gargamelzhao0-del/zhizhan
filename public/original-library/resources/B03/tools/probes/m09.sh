#!/usr/bin/env bash
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; source "$HERE/lib.sh"
WORK="$HERE/.out/m09"; rm -rf "$WORK"; mkdir -p "$WORK"; cd "$WORK"; cp "$HERE/m09_src/"* .
banner "M09 · 三语言同题：同一功能 C / C++ / Rust 的体积"
run "$GCC" $CFLAGS -c breath_c.c -o breath_c.o
run "$GXX" $CPPFLAGS -c breath_cpp.cpp -o breath_cpp.o
run "$RUSTC" --edition 2021 --crate-type lib --target thumbv7m-none-eabi -O -C panic=abort --emit=obj breath_rs.rs -o breath_rs.o
run "$SIZE" breath_c.o breath_cpp.o breath_rs.o
