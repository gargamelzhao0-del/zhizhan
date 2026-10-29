#!/usr/bin/env bash
# B02 实测探针 · 公共库
# ============================================================================
# 站内每个 .term 块的输出都必须由这里的探针真实产出，禁止手写。做法是：
# 探针脚本把「命令 + 真实输出」原样打成一份转录，抄进 .term 块的 <pre> 即完成。
#
# 用法：在探针脚本开头 `source "$(dirname "$0")/lib.sh"`，然后用 run/note 打印。
# 依赖：Arm GNU Toolchain 13.3.1（经 C:/tc-b02 短路径 junction）。
set -euo pipefail

# ---- 工具链（Windows 上 libstdc++ 头文件路径过长会撞 MAX_PATH，必须走短路径）----
TC_LONG="C:/Users/Administrator/Nuwax/computer-project-workspace/1785505821/1695388/toolchain/arm-gnu-toolchain-13.3.rel1-mingw-w64-i686-arm-none-eabi"
TC_SHORT="C:/tc-b02"
if [ -d "$TC_SHORT/bin" ]; then
  TC="$TC_SHORT"
elif [ -d "$TC_LONG/bin" ]; then
  TC="$TC_LONG"
else
  echo "!! 找不到 Arm GNU Toolchain（试过 $TC_SHORT 与 $TC_LONG）" >&2
  exit 1
fi
GCC="$TC/bin/arm-none-eabi-gcc.exe"
GXX="$TC/bin/arm-none-eabi-g++.exe"
SIZE="$TC/bin/arm-none-eabi-size.exe"
NM="$TC/bin/arm-none-eabi-nm.exe"
OBJDUMP="$TC/bin/arm-none-eabi-objdump.exe"
READELF="$TC/bin/arm-none-eabi-readelf.exe"

# 把工具链加进 PATH，并改用"裸命令名"调用。
# 这样转录里打印出来的命令既可读、又与真正执行的一致 —— 站内 .term 块直接照抄即可，
# 读者在任何装了 Arm GNU Toolchain 的机器上都能原样复跑（不必有 C:/tc-b02）。
# 注意 Git Bash 不认 "C:/..." 形式的 PATH 项，得先转成 /c/... 再 export。
if command -v cygpath >/dev/null 2>&1; then
  TC_POSIX="$(cygpath -u "$TC")"
else
  case "$TC" in
    [A-Za-z]:/*) TC_POSIX="/$(printf '%s' "${TC%%:*}" | tr 'A-Z' 'a-z')/${TC#*:/}" ;;
    *)           TC_POSIX="$TC" ;;
  esac
fi
export PATH="$TC_POSIX/bin:$PATH"
GCC="arm-none-eabi-gcc"; GXX="arm-none-eabi-g++"; SIZE="arm-none-eabi-size"
NM="arm-none-eabi-nm"; OBJDUMP="arm-none-eabi-objdump"; READELF="arm-none-eabi-readelf"

# 与站内 M01 一致的基线参数（-Os / thumb / cortex-m3），便于横向对照
MCU="${MCU:-cortex-m3}"
CFLAGS="-mcpu=$MCU -mthumb -Os -Wall -Wextra"
CPPFLAGS="-mcpu=$MCU -mthumb -Os -Wall -Wextra -std=c++20 -fno-exceptions -fno-rtti -fno-threadsafe-statics"

# ---- 转录输出：run 打印命令再打印输出，与站内 .term 块一一对应 ----
PROMPT='$'
run() {
  printf '%s %s\n' "$PROMPT" "$*"
  "$@" 2>&1 || true
}

note() { printf '\n-- %s\n' "$*"; }

banner() {
  printf '### %s\n' "$*"
  printf '### 工具链：%s\n' "$("$GXX" --version 2>&1 | head -1)"
  printf '### 目标：%s\n\n' "$MCU"
}

# 进探针自带的临时工作目录（调用方传入）
workdir() { mkdir -p "$1" && cd "$1"; }
