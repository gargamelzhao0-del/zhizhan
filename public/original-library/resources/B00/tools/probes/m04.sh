#!/usr/bin/env bash
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; WORK="$HERE/.out/m04"; rm -rf "$WORK"; mkdir -p "$WORK"; cd "$WORK"; cp "$HERE/m04_src/"* .
echo "### B00 · M04 · 函数与作用域"
echo '$ gcc -std=c11 -Wall -Wextra functions.c -o functions && ./functions'
gcc -std=c11 -Wall -Wextra functions.c -o functions && ./functions
