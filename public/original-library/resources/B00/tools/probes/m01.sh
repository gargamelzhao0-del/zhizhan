#!/usr/bin/env bash
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; WORK="$HERE/.out/m01"; rm -rf "$WORK"; mkdir -p "$WORK"; cd "$WORK"; cp "$HERE/m01_src/"* .
echo "### B00 · M01 · 第一个程序（本机 gcc）"
echo "### $($(command -v gcc) --version | head -1)"
echo
echo "\$ gcc -std=c11 -Wall -Wextra hello.c -o hello"
gcc -std=c11 -Wall -Wextra hello.c -o hello && echo "\$ ./hello" && ./hello
