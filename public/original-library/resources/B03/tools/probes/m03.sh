#!/usr/bin/env bash
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; source "$HERE/lib.sh"
WORK="$HERE/.out/m03"; rm -rf "$WORK"; mkdir -p "$WORK"; cd "$WORK"; cp "$HERE/m03_src/"* .
banner "M03 · no_std 与 panic（rustc 1.99 · thumbv7m-none-eabi）"
note "1) 最小 no_std 固件：自带 panic_handler，编译通过"
run "$RUSTC" $RFLAGS --emit=obj min_no_std.rs -o min_no_std.o
run "$SIZE" min_no_std.o
note "2) 有 panic 路径却没有 #[panic_handler] —— 作为可执行 crate 构建时直接报错"
run "$RUSTC" --edition 2021 --crate-type bin --target thumbv7m-none-eabi -O --emit=obj no_handler.rs -o no_handler.o
note "3) panic!() vs panic!(\"…{}\")：格式化会拉进 core::fmt"
run "$RUSTC" $RFLAGS --emit=obj panic_size.rs -o panic_size.o
run "$SIZE" panic_size.o
