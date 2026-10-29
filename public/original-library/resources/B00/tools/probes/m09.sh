#!/usr/bin/env bash
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; WORK="$HERE/.out/m09"; rm -rf "$WORK"; mkdir -p "$WORK"; cd "$WORK"; cp "$HERE/m09_src/"* .
echo "### B00 · M09 · 综合小项目"
echo '$ make'
make 2>&1
echo '$ ./app'
./app
