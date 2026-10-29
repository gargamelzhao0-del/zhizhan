#!/usr/bin/env bash
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; WORK="$HERE/.out/m07"; rm -rf "$WORK"; mkdir -p "$WORK"; cd "$WORK"; cp "$HERE/m07_src/"* .
echo "### B00 · M07 · 结构体/枚举/typedef"
echo '$ gcc -std=c11 -Wall -Wextra structs.c -o structs && ./structs'
gcc -std=c11 -Wall -Wextra structs.c -o structs && ./structs
