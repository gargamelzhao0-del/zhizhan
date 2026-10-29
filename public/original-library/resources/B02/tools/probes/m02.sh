#!/usr/bin/env bash
# B02 · M02 探针：RAII vs 手动配对
# 产出：两个 .o 的体积对照 + use_gpio 的反汇编
#   证明：RAII 版提前 return 时析构照样跑、手动版不会；且析构内联后体积几乎相同。
#   注意：-Os 下 GCC 不会内联这个析构函数（会保留一次调用），故对照用 -O2，
#         并在末尾把 -Os 的真实体积一并列出，避免"零开销"被优化等级掩盖。
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/lib.sh"

WORK="$HERE/.out/m02"
rm -rf "$WORK"; mkdir -p "$WORK"; cd "$WORK"
cp "$HERE/m02_src/"* .

O2="-mcpu=$MCU -mthumb -O2 -Wall -Wextra"
O2PP="$O2 -std=c++20 -fno-exceptions -fno-rtti -fno-threadsafe-statics"
OSC="-mcpu=$MCU -mthumb -Os -Wall -Wextra"

banner "M02 · RAII 与手动配对：同功能，差别在\"提前 return 时谁还记得释放\"；析构内联后体积几乎相同"

note "1) 编译两份实现（唯一差别：资源释放写在析构里还是手写调用；本探针用 -O2 让析构内联）"
run "$GXX" $O2PP -c gpio_raii.cpp -o gpio_raii.o
run "$GCC" $O2  -c gpio_c.c     -o gpio_c.o

note "2) 体积：-O2 下析构被内联，RAII 与手动版几乎相同（差 4 字节来自字面量池/对齐）"
run "$SIZE" gpio_raii.o gpio_c.o

note "3) RAII 版 use_gpio 的反汇编：析构被内联，提前 return 分支与正常分支都清掉 MODER 位"
"$OBJDUMP" -d --demangle gpio_raii.o | sed -n '/<use_gpio/,/^$/p' | sed 's/^[ 0-9a-f]*:\t//' | sed 's/^/    /' || true

note "4) 手动版 use_gpio 的反汇编：pin>15 那条路径直接返回，MODER 位从未恢复（编译器不报错）"
"$OBJDUMP" -d --demangle gpio_c.o | sed -n '/<use_gpio/,/^$/p' | sed 's/^[ 0-9a-f]*:\t//' | sed 's/^/    /' || true

note "5) 附：同一份源码用 -Os（不内联析构）时的体积——多出的字节是一次未内联的析构调用"
"$GXX" $O2PP -Os -c gpio_raii.cpp -o gpio_raii_os.o 2>/dev/null; "$GCC" $OSC -c gpio_c.c -o gpio_c_os.o 2>/dev/null
"$SIZE" gpio_raii_os.o gpio_c_os.o 2>/dev/null || true
