#!/usr/bin/env bash
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; WORK="$HERE/.out/m02"; rm -rf "$WORK"; mkdir -p "$WORK"; cd "$WORK"; cp "$HERE/m02_src/"* .
echo "### B00 · M02 · 变量/类型/表达式"
echo '$ gcc -std=c11 -Wall -Wextra types.c -o types && ./types'
gcc -std=c11 -Wall -Wextra types.c -o types && ./types
