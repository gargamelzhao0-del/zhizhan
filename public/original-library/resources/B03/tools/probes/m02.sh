#!/usr/bin/env bash
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; source "$HERE/lib.sh"
WORK="$HERE/.out/m02"; rm -rf "$WORK"; mkdir -p "$WORK"; cd "$WORK"; cp "$HERE/m02_src/"* .
banner "M02 · 用类型系统编码硬件约束（rustc 1.99 · thumbv7m-none-eabi）"
note "1) newtype / 类型状态机：正常代码编译通过"
run "$RUSTC" $RFLAGS --emit=obj newtype.rs  -o newtype.o
run "$RUSTC" $RFLAGS --emit=obj typestate.rs -o typestate.o
run "$SIZE" newtype.o typestate.o
note "2) 反面：未 init 就 write —— 类型状态机在编译期拒绝"
run "$RUSTC" $RFLAGS --emit=obj typestate_fail.rs -o typestate_fail.o
