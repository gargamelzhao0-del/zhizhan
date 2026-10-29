#!/usr/bin/env bash
# B02 · M08 探针：std::atomic 在 M3 与 M0 上分别落到什么指令
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/lib.sh"

WORK="$HERE/.out/m08"
rm -rf "$WORK"; mkdir -p "$WORK"; cd "$WORK"
cp "$HERE/m08_src/"*.cpp .

F="-Os -Wall -Wextra -std=c++20 -fno-exceptions -fno-rtti -fno-threadsafe-statics"

banner "M08 · ISR 里的 C++：同一份 atomic 代码，M3 与 M0 的落地方式并不相同"

for cpu in cortex-m3 cortex-m0plus; do
  note "──── $cpu ────"
  run "$GXX" -mcpu=$cpu -mthumb $F -c isr_atomic.cpp -o isr_$cpu.o
  run "$SIZE" isr_$cpu.o
  note "  发布/订阅（EXTI0_IRQHandler 与 main_loop）："
  "$OBJDUMP" -d --demangle isr_$cpu.o \
    | sed -n '/<EXTI0_IRQHandler>/,/^$/p;/<main_loop>/,/^$/p' \
    | sed 's/^[ 0-9a-f]*:\t//' | grep -vE '^[ 0-9a-f]* <|^$' | sed 's/^/    /'
  note "  原子自增 bump()："
  "$OBJDUMP" -d --demangle isr_$cpu.o | sed -n '/<bump/,/^$/p' | sed 's/^[ 0-9a-f]*:\t//' | grep -vE '^[ 0-9a-f]* <|^$' | sed 's/^/    /'
  note "  未定义符号（空 = 不需要外部帮手；出现 __atomic_* = 要链 libatomic）："
  u=$("$NM" -u isr_$cpu.o | sed 's/^/    /'); [ -z "$u" ] && echo "    （无）" || echo "$u"
done
