#!/usr/bin/env bash
# B02 · M06 探针：同一份 std::atomic 代码，cortex-m3 / cortex-m0 / cortex-m0plus 的落地方式
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/lib.sh"

WORK="$HERE/.out/m06"
rm -rf "$WORK"; mkdir -p "$WORK"; cd "$WORK"
cp "$HERE/m06_src/"* .

banner "M06 · 并发与内存模型：同一份 atomic 代码，三个核心三种落地"

note "1) 发布路径（publish）：三个核心上都长什么样"
for cpu in cortex-m3 cortex-m0 cortex-m0plus; do
  run "$GXX" $CPPFLAGS -mcpu=$cpu -c atom.cpp -o atom_$cpu.o
  printf '  [%s] %s\n' "$cpu" "$("$SIZE" atom_$cpu.o | tail -1)"
done

for cpu in cortex-m3 cortex-m0 cortex-m0plus; do
  printf '\n  ── %s · publish（只看屏障与存储指令）──\n' "$cpu"
  "$OBJDUMP" -d --demangle atom_$cpu.o \
    | sed -n '/<publish/,/^$/p' \
    | grep -E 'dmb|dsb|str|ldr|movs|word' \
    | sed 's/^[ 0-9a-f]*:\t//' | sed 's/^/      /' || true
done

note "2) 读-改-写（bump = fetch_add）：M3 有 ldrex/strex，M0/M0+ 没有"
for cpu in cortex-m3 cortex-m0 cortex-m0plus; do
  printf '\n  ── %s · bump() ──\n' "$cpu"
  "$OBJDUMP" -d --demangle atom_$cpu.o \
    | sed -n '/<bump/,/^$/p' \
    | sed 's/^[ 0-9a-f]*:\t//' | grep -vE '^[ 0-9a-f]* <|^$' | sed 's/^/      /' || true
  printf '     未定义符号：'
  u=$("$NM" -u atom_$cpu.o | awk '{print $NF}' | tr '\n' ' ')
  [ -z "$u" ] && echo "（无）" || echo "$u"
done

note "3) acquire 读（consume）：读屏障也是一条 dmb"
for cpu in cortex-m3 cortex-m0; do
  printf '\n  ── %s · consume() ──\n' "$cpu"
  "$OBJDUMP" -d --demangle atom_$cpu.o \
    | sed -n '/<consume/,/^$/p' \
    | grep -E 'dmb|dsb|ldr|str|movs|bne|cmp' \
    | sed 's/^[ 0-9a-f]*:\t//' | sed 's/^/      /' || true
done

note "4) 双缓冲那份代码（站点 SEQ 6.1 对应的 double_buffer.cpp）也能原样编过"
run "$GXX" $CPPFLAGS -c double_buffer.cpp -o double_buffer.o
run "$SIZE" double_buffer.o
printf '  → 中断侧写、主循环侧读，两侧各自带上 dmb：\n'
"$OBJDUMP" -d --demangle double_buffer.o | grep -E '<(isr_fill|main_poll)' -A0 | sed 's/^/      /' || true
"$OBJDUMP" -d --demangle double_buffer.o | grep -cE 'dmb' | sed 's/^/      dmb 条数：/'

note "5) relaxed vs release/acquire：同一份发布/订阅，dmb 的有无与位置"
for f in relaxed_bad relaxed_ok; do
  run "$GXX" $CPPFLAGS -c $f.cpp -o $f.o
  printf '\n  ── %s · producer ──\n' "$f"
  "$OBJDUMP" -d --demangle $f.o | sed -n '/<producer/,/^$/p' | sed 's/^[ 0-9a-f]*:\t//' | sed 's/^/      /' || true
  printf '  ── %s · consumer ──\n' "$f"
  "$OBJDUMP" -d --demangle $f.o | sed -n '/<consumer/,/^$/p' | sed 's/^[ 0-9a-f]*:\t//' | sed 's/^/      /' || true
done

note "6) 自旋锁（atomic_flag）：test_and_set/clear 的 acquire/release 语义"
run "$GXX" $CPPFLAGS -c spinlock.cpp -o spinlock.o
run "$SIZE" spinlock.o
printf '  ── locked_inc（临界区入口/出口）──\n'
"$OBJDUMP" -d --demangle spinlock.o | sed -n '/<locked_inc/,/^$/p' | sed 's/^[ 0-9a-f]*:\t//' | sed 's/^/      /' || true
printf '     未定义符号：'; u=$("$NM" -u spinlock.o | awk '{print $NF}' | tr '\n' ' '); [ -z "$u" ] && echo "（无）" || echo "$u"
