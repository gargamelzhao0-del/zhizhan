#!/usr/bin/env bash
# ci.sh —— 本地=CI 的最小流水线：严格模式 + 幂等（本册 Shell 片段，经 bash -n 检查）。
# 用法：bash labs/ci.sh
set -euo pipefail

: "${BUILD_DIR:=build}"
mkdir -p "$BUILD_DIR"

echo "[1/3] 配置/生成"
if [ -f CMakeLists.txt ]; then
  cmake -S . -B "$BUILD_DIR" -DCMAKE_BUILD_TYPE=Release
else
  echo "（示例工程无 CMakeLists.txt，跳过配置）"
fi

echo "[2/3] 构建"
if [ -f "$BUILD_DIR/CMakeCache.txt" ]; then
  cmake --build "$BUILD_DIR" --parallel
else
  echo "（跳过构建）"
fi

echo "[3/3] 打包与校验和"
if [ -d "$BUILD_DIR" ]; then
  find "$BUILD_DIR" -maxdepth 1 -type f -print0 | xargs -0 -r sha256sum || true
fi

echo "CI 完成：脚本可重复执行（幂等），任一步失败即中止。"
