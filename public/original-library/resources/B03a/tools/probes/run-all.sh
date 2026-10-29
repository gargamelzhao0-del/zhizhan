#!/usr/bin/env bash
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; WORK="$HERE/.out"; rm -rf "$WORK"; mkdir -p "$WORK"; cd "$WORK"
run() {
  echo "\$ rustc --edition 2021 -O $1 -o $2 && ./$2"
  rustc --edition 2021 -O "$HERE/src/$1" -o "$2" && "./$2"; echo
}
echo "=== M01 ==="; run m01_hello.rs m01
echo "=== M02 ==="; run m02_ownership.rs m02
echo "=== M03 ==="; run m03_borrow.rs m03
echo "=== M04 ==="; run m04_enums.rs m04
echo "=== M05 ==="; run m05_traits.rs m05
echo "=== M06 ==="; run m06_collections.rs m06
echo "=== M07 ==="; run m07_iterators.rs m07
