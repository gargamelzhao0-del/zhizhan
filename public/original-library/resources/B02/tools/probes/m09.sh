#!/usr/bin/env bash
# B02 · M09 探针：extern "C" 到底关掉了什么，以及 C 与 C++ 如何链到一起
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/lib.sh"

WORK="$HERE/.out/m09"
rm -rf "$WORK"; mkdir -p "$WORK"; cd "$WORK"
cp "$HERE/m09_src/"* .

banner "M09 · 与 C 互操作：名字修饰是链接边界的唯一障碍"

note "1) 编译 C++ 侧。符号表里真实存的名字（不加 --demangle）："
run "$GXX" $CPPFLAGS -c drv_cpp.cpp -o drv_cpp.o
note "   真实符号名："
"$NM" drv_cpp.o | grep -E ' T | B ' | sed 's/^/  /'
note "   同样的符号，C++ 读法（--demangle 只是把修饰名还原给人看）："
"$NM" --demangle drv_cpp.o | grep -E ' T | B ' | sed 's/^/  /'

note "2) 用 C 编译器编译 caller（gcc 不认 C++ 语法，所以必须是真的 C 文件）"
run "$GCC" -mcpu=$MCU -mthumb -Os -std=c11 -Wall -Wextra -c main_c.c -o main_c.o

note "3) 混合链接：用 g++ 作链接器，把两份 .o 拼成一个可执行文件"
run "$GXX" -mcpu=$MCU -mthumb -nostdlib -Wl,-e,main drv_cpp.o main_c.o -o mixed.elf
run "$SIZE" mixed.elf
note "   验证 main 确实通过裸名 drv_open 调到了 C++ 实现："
"$OBJDUMP" -d --demangle mixed.elf | sed -n '/<main>/,/^$/p' | sed 's/^[ 0-9a-f]*:\t//' | grep -vE '^[ 0-9a-f]* <|^$' | sed 's/^/  /'

note "4) 反面验证：C 侧去调那个没加 extern \"C\" 的函数，会怎样？"
run "$GCC" -mcpu=$MCU -mthumb -Os -std=c11 -Wall -Wextra -c main_c_bad.c -o main_c_bad.o
printf '   链接（这里必须失败，失败才是结论）：\n'
run "$GXX" -mcpu=$MCU -mthumb -nostdlib -Wl,-e,main drv_cpp.o main_c_bad.o -o bad.elf
printf '  → 链接器退出码非 0，镜像未生成：%s\n' "$([ -f bad.elf ] && echo '居然生成了？' || echo 'bad.elf 不存在，符合预期')"
