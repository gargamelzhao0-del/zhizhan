#!/usr/bin/env bash
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; WORK="$HERE/.out/m03"; rm -rf "$WORK"; mkdir -p "$WORK"; cd "$WORK"; cp "$HERE/m03_src/"* .
echo "### B00 · M03 · 控制流"
for f in branch loops fizzbuzz; do
  echo "\$ gcc -std=c11 -Wall -Wextra $f.c -o $f && ./$f"
  gcc -std=c11 -Wall -Wextra "$f.c" -o "$f" && "./$f"
  echo
done
