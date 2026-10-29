#!/usr/bin/env bash
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; source "$HERE/lib.sh"
WORK="$HERE/.out/m04"; rm -rf "$WORK"; mkdir -p "$WORK"; cd "$WORK"; cp "$HERE/m04_src/"* .
banner "M04 · embedded-hal 抽象：泛型 vs dyn（rustc 1.99 · thumbv7m-none-eabi）"
note "1) 泛型驱动：为具体类型生成一份代码"
run "$RUSTC" $RFLAGS --emit=obj hal_traits.rs -o hal_traits.o
run "$SIZE" hal_traits.o
note "2) dyn 驱动：一份代码，运行期分派"
run "$RUSTC" $RFLAGS --emit=obj hal_dyn.rs -o hal_dyn.o
run "$SIZE" hal_dyn.o
