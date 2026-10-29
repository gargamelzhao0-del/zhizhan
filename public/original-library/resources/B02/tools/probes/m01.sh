#!/usr/bin/env bash
# B02 · M01 探针：同一功能驱动的 C 版 / C++ 版（关异常·RTTI）/ C++ 版（开异常·RTTI）体积
#            以及"引入 <iostream> 之后链接会怎样"
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/lib.sh"

WORK="$HERE/.out/m01"
rm -rf "$WORK"; mkdir -p "$WORK"; cd "$WORK"
cp "$HERE/m01_src/"* .

banner "M01 · 迁移决策：C++ 在 MCU 上的真实代价"

note "1) 同一份驱动的三个版本：C / C++(关异常·RTTI) / C++(开异常·RTTI)"
run "$GCC" -mcpu=$MCU -mthumb -Os -std=c11  -c drv_c.c    -o drv_c.o
run "$GXX" $CPPFLAGS -c drv_cpp.cpp -o drv_cpp.o
run "$GXX" -mcpu=$MCU -mthumb -Os -Wall -Wextra -std=c++20 -fexceptions -frtti -c drv_cpp.cpp -o drv_cpp_ex.o
run "$SIZE" drv_c.o drv_cpp.o drv_cpp_ex.o

note "2) 三个版本各自导出的函数（C++ 的名字修饰在这里就能看见）"
printf '  [drv_c.o]\n';    "$NM" drv_c.o    | grep -E ' T ' | sed 's/^/    /' || true
printf '  [drv_cpp.o]\n';  "$NM" --demangle drv_cpp.o | grep -E ' T ' | sed 's/^/    /' || true

note "3) 真正的分水岭：引入 <iostream> 后编得过，但链不过"
run "$GXX" -mcpu=$MCU -mthumb -Os -std=c++20 iostream_probe.cpp -o iostream.elf
n=$("$GXX" -mcpu=$MCU -mthumb -Os -std=c++20 iostream_probe.cpp -o iostream.elf 2>&1 | grep -c 'undefined reference' || true)
printf '  → 未定义引用条数：%s\n' "$n"
printf '  → 缺的是哪些符号（去重）：\n'
syms=$("$GXX" -mcpu=$MCU -mthumb -Os -std=c++20 iostream_probe.cpp -o iostream.elf 2>&1 \
  | grep -o "undefined reference to \`[^']*'" | sed "s/.*\`//;s/'$//" | sort -u | tr '\n' ' ' || true)
printf '      %s\n' "$syms"

note "4) 补上 newlib 的 syscall 桩（--specs=nosys.specs）就能链过 —— 但代价是多少字节"
run "$GXX" -mcpu=$MCU -mthumb -Os -std=c++20 --specs=nosys.specs bare.cpp            -o bare_nosys.elf
run "$GXX" -mcpu=$MCU -mthumb -Os -std=c++20 --specs=nosys.specs iostream_probe.cpp  -o iostream_nosys.elf
run "$SIZE" bare_nosys.elf iostream_nosys.elf
