#!/usr/bin/env bash
# B02 · M04 探针：模板实例化膨胀，以及 -ffunction-sections + --gc-sections 能回收多少
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/lib.sh"

WORK="$HERE/.out/m04"
rm -rf "$WORK"; mkdir -p "$WORK"; cd "$WORK"
cp "$HERE/m04_src/"* .

banner "M04 · 零开销抽象的账单：每多一个策略参数，就多一份真实代码"

note "1) 同一模板，实例化 1 个策略 vs 4 个策略"
run "$GXX" $CPPFLAGS -c tpl_one.cpp  -o tpl_one.o
run "$GXX" $CPPFLAGS -c tpl_many.cpp -o tpl_many.o
run "$SIZE" tpl_one.o tpl_many.o

note "2) 膨胀从哪来：4 个策略各生成一份独立函数体（transfer 已内联进去，nm 按大小列出）"
"$NM" --print-size --demangle --size-sort tpl_many.o | grep ' T ' | sed 's/^/  /' || true

note "3) 放进函数段后，链接器可以把没人调用的实例整段删掉"
run "$GXX" $CPPFLAGS -ffunction-sections -fdata-sections -c tpl_gc.cpp -o tpl_gc.o
run "$GXX" -mcpu=$MCU -mthumb -nostdlib -Wl,-e,main -Wl,--no-gc-sections tpl_gc.o -o nogc.elf
run "$GXX" -mcpu=$MCU -mthumb -nostdlib -Wl,-e,main -Wl,--gc-sections    tpl_gc.o -o gc.elf
note "   两者只差一个链接开关："
run "$SIZE" nogc.elf gc.elf

note "4) 用 extern template 控制实例化生成点：多个 TU 只保留一份定义"
note "   4a) 不带 extern template —— 两个 TU 各自生成一份（W 弱符号）"
run "$GXX" $CPPFLAGS -c ext_w1.cpp -o ext_w1.o
run "$GXX" $CPPFLAGS -c ext_w2.cpp -o ext_w2.o
for o in ext_w1.o ext_w2.o; do
  printf '   %-12s ' "$o"; "$NM" -C "$o" | grep 'Engine' | sed 's/^/ /' || true
done
note "   4b) 带 extern template + 单点显式实例化 —— 只 ext_xi.o 生成，其余 TU 变成 U"
run "$GXX" $CPPFLAGS -c ext_x1.cpp -o ext_x1.o
run "$GXX" $CPPFLAGS -c ext_x2.cpp -o ext_x2.o
run "$GXX" $CPPFLAGS -c ext_xi.cpp -o ext_xi.o
for o in ext_x1.o ext_x2.o ext_xi.o; do
  printf '   %-12s ' "$o"; "$NM" -C "$o" | grep 'Engine' | sed 's/^/ /' || true
done
printf '   → 对象文件层面：不带 extern template 时每个 TU 各有一份 W 定义；\n'
printf '     带上后，只有显式实例化的那个 TU 生成定义，其余变成 U（少重复、链接更快）。\n'
