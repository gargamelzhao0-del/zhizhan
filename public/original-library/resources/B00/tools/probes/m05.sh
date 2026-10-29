#!/usr/bin/env bash
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; WORK="$HERE/.out/m05"; rm -rf "$WORK"; mkdir -p "$WORK"; cd "$WORK"; cp "$HERE/m05_src/"* .
echo "### B00 · M05 · 数组与字符串"
echo '$ gcc -std=c11 -Wall -Wextra array_string.c -o array_string && ./array_string'
gcc -std=c11 -Wall -Wextra array_string.c -o array_string && ./array_string
