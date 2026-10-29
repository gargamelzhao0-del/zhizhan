#!/usr/bin/env bash
# B04 全部探针：按模块顺序实跑，输出即正文 .term 来源
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
echo "== M03 帧解析 =="; python "$HERE/m03_src/frame_codec.py"
echo "== M04 数据分析 =="; ( cd "$HERE" && python m04_src/analyze.py )
echo "== M05 流水线(dry-run) =="; python "$HERE/m05_src/build_all.py" --dry-run
echo "== M07 数据集切分 =="; python "$HERE/m07_src/split_dataset.py"

# 补充探针
echo "== M01 分工 =="; python "$HERE/m01_src/choose.py"
echo "== M02 CRC8 =="; python "$HERE/m02_src/viper_crc.py"
echo "== M06 环形缓冲 =="; python "$HERE/m06_src/ring.py"
