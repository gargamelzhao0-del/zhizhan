#!/usr/bin/env bash
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; WORK="$HERE/.out/m06"; rm -rf "$WORK"; mkdir -p "$WORK"; cd "$WORK"; cp "$HERE/m06_src/"* .
echo "### B00 · M06 · 指针入门"
echo '$ gcc -std=c11 -Wall -Wextra pointer.c -o pointer && ./pointer'
gcc -std=c11 -Wall -Wextra pointer.c -o pointer && ./pointer
