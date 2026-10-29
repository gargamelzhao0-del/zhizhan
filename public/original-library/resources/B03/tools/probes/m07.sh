#!/usr/bin/env bash
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; source "$HERE/lib.sh"
WORK="$HERE/.out/m07"; rm -rf "$WORK"; mkdir -p "$WORK"; cd "$WORK"; cp "$HERE/m07_src/"* .
banner "M07 · unsafe 的边界与 FFI（rustc 1.99 · thumbv7m-none-eabi）"
note "1) 安全 API 包住 unsafe：MMIO 读取"
run "$RUSTC" $RFLAGS --emit=obj unsafe_wrap.rs -o unsafe_wrap.o
run "$SIZE" unsafe_wrap.o
note "2) 与 C 互调：extern \"C\" 声明与导出（--emit=obj 只编译，不链接）"
run "$RUSTC" $RFLAGS --emit=obj ffi.rs -o ffi.o
run "$SIZE" ffi.o
printf '   未定义符号（由 C 提供）：'; u=$("$NM" -u ffi.o | awk '{print $NF}' | tr '\n' ' '); echo "$u"
