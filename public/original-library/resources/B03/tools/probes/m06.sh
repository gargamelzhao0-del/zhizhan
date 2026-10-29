#!/usr/bin/env bash
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; source "$HERE/lib.sh"
WORK="$HERE/.out/m06"; rm -rf "$WORK"; mkdir -p "$WORK"; cd "$WORK"; cp "$HERE/m06_src/"* .
banner "M06 · DMA 与所有权（rustc 1.99 · thumbv7m-none-eabi）"
note "1) DMA 传输期间借用缓冲：合法写法编译通过"
run "$RUSTC" $RFLAGS --emit=obj dma_ok.rs -o dma_ok.o
run "$SIZE" dma_ok.o
note "2) 反面：传输期间改动被借出的缓冲 —— 借用检查器拒绝"
run "$RUSTC" $RFLAGS --emit=obj dma_fail.rs -o dma_fail.o
