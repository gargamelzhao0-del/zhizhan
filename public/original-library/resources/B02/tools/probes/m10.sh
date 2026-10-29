#!/usr/bin/env bash
# B02 · M10 探针：同一个驱动框架，虚表版 vs concepts 版
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/lib.sh"

WORK="$HERE/.out/m10"
rm -rf "$WORK"; mkdir -p "$WORK"; cd "$WORK"
cp "$HERE/m10_src/"* .

banner "M10 · 实战重构：把 ops 虚表 + void* ctx 换成 concepts + 模板，代价与收益各是什么"

note "1) 两份实现各自编译"
run "$GXX" $CPPFLAGS -c ops_table.cpp   -o ops_table.o
run "$GXX" $CPPFLAGS -c concepts_drv.cpp -o concepts_drv.o
run "$SIZE" ops_table.o concepts_drv.o

note "2) 重构前 use_ops：两次经寄存器间接跳转（blx），ctx 还要单独传"
"$OBJDUMP" -d --demangle ops_table.o | sed -n '/<use_ops/,/^$/p' | sed 's/^[ 0-9a-f]*:\t//' | grep -vE '^[ 0-9a-f]* <|^$' | sed 's/^/  /'

note "3) 重构后 use_generic<Uart>：没有间接跳转，三步被压成直接的寄存器读写"
"$OBJDUMP" -d --demangle concepts_drv.o | sed -n '/use_generic<Uart>/,/^$/p' | sed 's/^[ 0-9a-f]*:\t//' | grep -vE '^[ 0-9a-f]* <|^$' | sed 's/^/  /'

note "4) 编译期护栏：契约写在 concept 里，不满足时是编译错误而不是运行期崩溃"
cat > contract_fail.cpp <<'EOF'
#include <concepts>
#include <cstdint>
struct Half { void init() {} };                       // 缺 write() 和 last()
template <class D>
concept Driver = requires(D& d, std::uint32_t b) { d.init(); d.write(b); };
template <Driver D> void boot(D& d) { d.init(); }
int main() { Half h; boot(h); }
EOF
run "$GXX" $CPPFLAGS -fsyntax-only contract_fail.cpp
