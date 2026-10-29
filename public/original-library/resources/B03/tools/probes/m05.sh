#!/usr/bin/env bash
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; source "$HERE/lib.sh"
WORK="$HERE/.out/m05"; rm -rf "$WORK"; mkdir -p "$WORK"; cd "$WORK"; cp "$HERE/m05_src/"* .
banner "M05 · 中断与并发：Atomic vs static mut（rustc 1.99）"
note "1) Cortex-M3：fetch_add 内联为 ldrex/strex，无未定义符号"
run "$RUSTC" --edition 2021 --crate-type lib --target thumbv7m-none-eabi -O --emit=obj shared_counter.rs -o sc_m3.o
run "$SIZE" sc_m3.o
printf '   未定义符号：'; u=$("$NM" -u sc_m3.o | awk '{print $NF}' | tr '\n' ' '); [ -z "$u" ] && echo "（无）" || echo "$u"
printf '  ── M3 · isr_tick ──\n'
"$OBJDUMP" -d sc_m3.o | sed -n '/<isr_tick>/,/^$/p' | sed 's/^[ 0-9a-f]*:\t//' | sed 's/^/      /' || true
note "2) Cortex-M0：AtomicU32 连 fetch_add 方法都没有 —— 直接编译错误"
run "$RUSTC" --edition 2021 --crate-type lib --target thumbv6m-none-eabi -O --emit=obj shared_counter.rs -o sc_m0.o
note "3) static mut 共享：能编过，但没有任何编译器保护（反面）"
run "$RUSTC" $RFLAGS --emit=obj staticmut_fail.rs -o staticmut_fail.o
