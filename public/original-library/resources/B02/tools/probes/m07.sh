#!/usr/bin/env bash
# B02 · M07 探针：类型系统护栏 —— 拦住错误是编译期免费的，代价为零
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/lib.sh"

WORK="$HERE/.out/m07"
rm -rf "$WORK"; mkdir -p "$WORK"; cd "$WORK"
cp "$HERE/m07_src/"* .

banner "M07 · 类型系统护栏：把"单位错了"从运行期 bug 变成编译期报错"

note "1) 正确写法：先编过，再看它的代价"
run "$GXX" $CPPFLAGS -c unit_ok.cpp -o unit_ok.o
run "$SIZE" unit_ok.o
note "   反汇编（Unit 只是薄封装，参数仍走 r0 寄存器）："
"$OBJDUMP" -d --demangle unit_ok.o | sed -n '/<run/,/^$/p' | sed 's/^[ 0-9a-f]*:\t//' | head -12

note "2) 写错一行：把 Ms 传给 delay_us(Us) —— 编译期直接拒绝"
run "$GXX" $CPPFLAGS -fsyntax-only unit_fail.cpp
