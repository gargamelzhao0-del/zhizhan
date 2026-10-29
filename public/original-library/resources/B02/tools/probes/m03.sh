#!/usr/bin/env bash
# B02 · M03 探针：查表 vs 逐位（表确实进了 .rodata），以及 static_assert 拦布局错误
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/lib.sh"

WORK="$HERE/.out/m03"
rm -rf "$WORK"; mkdir -p "$WORK"; cd "$WORK"
cp "$HERE/m03_src/"* .

banner "M03 · constexpr 与编译期计算：把计算搬到编译期，Flash 里只留表"

note "1) 查表 vs 逐位：同一份 CRC8，两种写法"
run "$GXX" $CPPFLAGS -c crc_bit.cpp   -o crc_bit.o
run "$GXX" $CPPFLAGS -c crc_table.cpp -o crc_table.o
run "$SIZE" crc_bit.o crc_table.o

note "2) 多出来的 240 字节是什么：一张 256 字节的表躺在 .rodata 里（Flash，不占 RAM）"
run "$OBJDUMP" -h crc_table.o
printf '  → 只看 .rodata 段：\n'
"$OBJDUMP" -h crc_table.o | grep -i rodata | sed 's/^/      /' || true

note "3) 表是 constexpr 算出来的 —— 用 readelf 看它有没有初始化数据、要不要运行时构造"
run "$READELF" -S crc_table.o
printf '  → 只看段表里与初始化相关的行：\n'
"$READELF" -S crc_table.o | grep -E 'rodata|init_array|\.data|\.bss' | sed 's/^/      /' || true

note "4) static_assert 把手册钉进代码：写错一位立刻编译失败"
run "$GXX" $CPPFLAGS -fsyntax-only regs_ok.cpp
printf '  → regs_ok.cpp 通过（偏移 0x0C / 0x10 与手册一致）\n'
run "$GXX" $CPPFLAGS -fsyntax-only regs_fail.cpp

note "5) 第三种做法：C 的老路子 —— 表放 RAM，启动时算一遍（供 FIG 3.1 第三列实测）"
run "$GXX" $CPPFLAGS -c crc_runtime.cpp -o crc_runtime.o
run "$SIZE" crc_runtime.o
printf '  → 段分布（.bss 就是 RAM 账单；.rodata 有没有）：\n'
"$OBJDUMP" -h crc_runtime.o | grep -E '\.text|\.data|\.bss|\.rodata' | sed 's/^/      /' || true

note "6) 三个版本横向账单：Flash = text+.rodata，RAM = .data+.bss"
run "$SIZE" crc_bit.o crc_table.o crc_runtime.o
for f in crc_bit crc_table crc_runtime; do
  bss=$("$SIZE" -A "$f.o" | awk '$1==".bss"{print $2}')
  rod=$("$SIZE" -A "$f.o" | awk '$1 ~ /^\.rodata/{s+=$2} END{printf "%d", s+0}')
  [ -z "$bss" ] && bss=0
  printf '      %-16s .rodata=%-6s .bss=%-6s\n' "$f.o" "$rod" "$bss"
done
printf '  → 运行期版的初始化函数本身也要 Flash（启动时跑的那 256 次循环）：\n'
"$NM" --print-size --demangle --size-sort crc_runtime.o | sed 's/^/      /' || true
