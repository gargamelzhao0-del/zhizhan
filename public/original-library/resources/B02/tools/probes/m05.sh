#!/usr/bin/env bash
# B02 · M05 探针：unique_ptr 是不是零开销，以及删除器有状态要付多少
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/lib.sh"

WORK="$HERE/.out/m05"
rm -rf "$WORK"; mkdir -p "$WORK"; cd "$WORK"
cp "$HERE/m05_src/"* .

banner "M05 · 资源管理：构造即接管，析构即归还；句柄本身不占额外空间"

note "1) 裸指针 + 手工析构 vs unique_ptr + 无状态删除器"
run "$GXX" $CPPFLAGS -c own_raw.cpp  -o own_raw.o
run "$GXX" $CPPFLAGS -c own_uptr.cpp -o own_uptr.o
run "$SIZE" own_raw.o own_uptr.o

note "2) 逐条指令对照（剥掉地址与函数名行后 diff，无差异即零开销）"
dump() { "$OBJDUMP" -d --demangle "$1" | sed -n "/<$2/,/^\$/p" | tail -n +2 \
         | sed 's/^[ 0-9a-f]*:\t//' | sed 's/\t.*@.*//' | grep -v '^[ 0-9a-f]* <'; }
dump own_raw.o  raw_use  > raw.txt
dump own_uptr.o uptr_use > uptr.txt
if diff -q raw.txt uptr.txt >/dev/null; then
  echo "  diff 无差异 —— 两者生成完全相同的指令序列"
else
  echo "  diff 差异如下："; diff raw.txt uptr.txt | sed 's/^/    /' || true
fi

note "3) 句柄大小（数组长度写进符号表，可直接读出）："
run "$GXX" $CPPFLAGS -c sizeof_probe.cpp -o sizeof_probe.o
"$NM" --print-size --demangle sizeof_probe.o | grep ' sz_' | awk '{printf "  %-12s %s 字节\n", $4, strtonum("0x"$2)}'

note "4) 分配路径的账单：静态池 vs 堆（接口完全相同的两份实现，同条件链接）"
run "$GXX" $CPPFLAGS -c pool_alloc.cpp -o pool_alloc.o
run "$GXX" $CPPFLAGS -c heap_alloc.cpp -o heap_alloc.o
run "$GCC" $CFLAGS    -c alloc_main.cpp -o alloc_main.o
printf '  → 分配器本身的代码量（只看实现，不含调用方）：\n'
run "$SIZE" pool_alloc.o heap_alloc.o
printf '  → 池只有 .text/.bss，没有任何初始化数据：\n'
run "$SIZE" -A pool_alloc.o | grep -E '\.text|\.bss'

printf '\n  → 同条件链接后的整镜像（--specs=nosys.specs）：\n'
run "$GXX" $CPPFLAGS --specs=nosys.specs alloc_main.o pool_alloc.o -o pool.elf
run "$GXX" $CPPFLAGS --specs=nosys.specs alloc_main.o heap_alloc.o -o heap.elf
run "$SIZE" pool.elf heap.elf

printf '\n  → 堆那条路把哪些符号拖进了镜像（池这条路的对应输出应为空）：\n'
for e in pool heap; do
  printf '     [%s.elf] ' "$e"
  s=$("$NM" -u "$e.elf" | awk '{print $NF}' | tr '\n' ' ')
  [ -z "$s" ] && echo "（无未定义符号）" || echo "$s"
done

printf '\n  → 真正被链进镜像的"可分配内存来源"：\n'
for e in pool heap; do
  printf '     [%s.elf] ' "$e"
  s=$("$NM" "$e.elf" | grep -E ' (_sbrk|sbrk|_malloc_r|malloc|_free_r|free)$' | awk '{print $NF}' | tr '\n' ' ')
  [ -z "$s" ] && echo "（没有堆）" || echo "$s"
done

printf '\n  → 池的分配路径到底几条指令：\n'
"$OBJDUMP" -d --demangle pool.elf | sed -n '/<xalloc>/,/^$/p' | sed 's/^/      /'
