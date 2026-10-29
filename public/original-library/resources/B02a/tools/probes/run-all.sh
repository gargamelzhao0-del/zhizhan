#!/usr/bin/env bash
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="$HERE/.out"; rm -rf "$WORK"; mkdir -p "$WORK"; cd "$WORK"
run() {  # run <src> <name>
  cp "$HERE/$1" .
  echo "\$ g++ -std=c++17 -Wall -Wextra $(basename $1) -o $2 && ./$2"
  g++ -std=c++17 -Wall -Wextra "$(basename $1)" -o "$2" && "./$2"
  echo
}
echo "=== M01 ==="; run m01_src/hello.cpp hello; run m01_src/ns.cpp ns
echo "=== M02 ==="; run m02_src/reference.cpp reference
echo "=== M03 ==="; run m03_src/overload.cpp overload
echo "=== M04 ==="; run m04_src/class.cpp classapp
echo "=== M05 ==="; run m05_src/operator.cpp operatorapp
echo "=== M06 ==="; run m06_src/polymorphism.cpp poly
echo "=== M07 ==="; run m07_src/templates.cpp tpl
echo "=== M08 ==="; run m08_src/smartptr.cpp smart
