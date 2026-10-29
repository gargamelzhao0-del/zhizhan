#!/usr/bin/env bash
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; WORK="$HERE/.out"; rm -rf "$WORK"; mkdir -p "$WORK"; cd "$WORK"
for m in 01 02 03 04 05 06 07 08; do
  f=$(ls "$HERE/src/"m${m}_*.py); echo "=== M$m : $(basename "$f") ==="
  echo "\$ python $(basename "$f")"
  python "$f"; echo
done
