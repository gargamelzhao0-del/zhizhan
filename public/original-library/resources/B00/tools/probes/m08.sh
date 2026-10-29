#!/usr/bin/env bash
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; WORK="$HERE/.out/m08"; rm -rf "$WORK"; mkdir -p "$WORK"; cd "$WORK"; cp "$HERE/m08_src/"* .
echo "### B00 · M08 · 多文件 + Makefile"
echo '$ make'
make 2>&1
echo '$ ./app'
./app
