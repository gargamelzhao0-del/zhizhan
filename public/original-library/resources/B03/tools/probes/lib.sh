#!/usr/bin/env bash
# B03 实测探针 · 公共库（Rust 为主；C/C++ 供"三语言同题"模块）
# ============================================================================
# 站内每个 .term 块的输出都必须由这里的探针真实产出，禁止手写。
# 用法：脚本开头 `source "$(dirname "$0")/lib.sh"`，再用 run/note 打印。
# 依赖：rustc（带 thumbv7m/thumbv6m target）、Arm GNU Toolchain 13.3.1。
set -euo pipefail

# ---- ARM 工具链（C/C++ 与"读 Rust 目标文件"都用它；短路径躲 MAX_PATH）----
TC_LONG="C:/Users/Administrator/Nuwax/computer-project-workspace/1785505821/1695388/toolchain/arm-gnu-toolchain-13.3.rel1-mingw-w64-i686-arm-none-eabi"
TC_SHORT="C:/tc-b03"
if command -v arm-none-eabi-gcc >/dev/null 2>&1 && command -v arm-none-eabi-size >/dev/null 2>&1; then TC=""
elif [ -n "${ARM_GNU_TOOLCHAIN:-}" ] && [ -d "$ARM_GNU_TOOLCHAIN/bin" ]; then TC="$ARM_GNU_TOOLCHAIN"
elif [ -d "$TC_SHORT/bin" ]; then TC="$TC_SHORT"
elif [ -d "$TC_LONG/bin" ]; then TC="$TC_LONG"
else echo "!! 请将 Arm GNU Toolchain 的 bin 加入 PATH，或设置 ARM_GNU_TOOLCHAIN 为安装目录" >&2; exit 1; fi
if [ -n "$TC" ]; then
  if command -v cygpath >/dev/null 2>&1; then TC_POSIX="$(cygpath -u "$TC")"; else TC_POSIX="$TC"; fi
  export PATH="$TC_POSIX/bin:$PATH"
fi
GCC="arm-none-eabi-gcc"; GXX="arm-none-eabi-g++"
SIZE="arm-none-eabi-size"; NM="arm-none-eabi-nm"; OBJDUMP="arm-none-eabi-objdump"; READELF="arm-none-eabi-readelf"
RUSTC="rustc"

MCU="${MCU:-cortex-m3}"
TARGET="${TARGET:-thumbv7m-none-eabi}"
RFLAGS="--edition 2021 --crate-type lib --target $TARGET -O"
CFLAGS="-mcpu=$MCU -mthumb -Os -Wall -Wextra"
CPPFLAGS="-mcpu=$MCU -mthumb -Os -Wall -Wextra -std=c++20 -fno-exceptions -fno-rtti -fno-threadsafe-statics"

PROMPT='$'
run() { printf '%s %s\n' "$PROMPT" "$*"; "$@" 2>&1 || true; }
note() { printf '\n-- %s\n' "$*"; }
banner() {
  printf '### %s\n' "$*"
  printf '### rustc：%s\n' "$("$RUSTC" --version 2>&1)"
  printf '### 目标：%s\n\n' "$TARGET"
}
