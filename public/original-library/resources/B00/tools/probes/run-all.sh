#!/usr/bin/env bash
# B00 全部探针：按模块顺序实跑，输出即正文 .term 来源
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
for m in 01 02 03 04 05 06 07 08 09; do echo; bash "$HERE/m$m.sh"; done
