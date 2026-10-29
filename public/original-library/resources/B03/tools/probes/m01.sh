#!/usr/bin/env bash
# B03 · M01 探针：move / borrow / 悬垂与别名（真实 rustc，thumbv7m-none-eabi）
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/lib.sh"

WORK="$HERE/.out/m01"
rm -rf "$WORK"; mkdir -p "$WORK"; cd "$WORK"
cp "$HERE/m01_src/"* .

banner "M01 · 所有权与借用：move/borrow 编译期检查，运行期零成本"

note "1) move 与借用：正常代码编译通过（生成目标文件）"
run "$RUSTC" $RFLAGS --emit=obj ownership.rs -o ownership.o
run "$RUSTC" $RFLAGS --emit=obj borrow.rs    -o borrow.o
run "$SIZE" ownership.o borrow.o

note "2) 反面①：返回局部变量的引用（悬垂）—— 编译器拒绝"
run "$RUSTC" $RFLAGS --emit=obj dangling_fail.rs -o dangling_fail.o

note "3) 反面②：同一时刻两个可变借用 —— 编译器拒绝"
run "$RUSTC" $RFLAGS --emit=obj alias_fail.rs -o alias_fail.o

note "4) 借用零开销：sum/add 的机器码里没有任何\"所有权元数据\""
run "$RUSTC" $RFLAGS --emit=obj cost.rs -o cost.o
run "$SIZE" cost.o
printf '\n  ── sum ──\n'
"$OBJDUMP" -d --demangle cost.o | sed -n '/<sum>/,/^$/p' | sed 's/^[ 0-9a-f]*:\t//' | sed 's/^/      /' || true
printf '  ── add ──\n'
"$OBJDUMP" -d --demangle cost.o | sed -n '/<add>/,/^$/p' | sed 's/^[ 0-9a-f]*:\t//' | sed 's/^/      /' || true

note "5) C 对照：按值传参是拷贝，use_after_move 是合法的（无编译期保护）"
run "$GCC" $CFLAGS -c ownership_c.c -o ownership_c.o
run "$SIZE" ownership_c.o
