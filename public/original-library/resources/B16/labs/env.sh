#!/usr/bin/env bash
# env.sh —— 环境边界检查：真实解析工具位置与版本（本册 Shell 片段，经 bash -n 检查）。
# 用法：bash labs/env.sh
set -euo pipefail

echo "PATH 前 5 项："
printf '%s\n' "${PATH//:/$'\n'}" | head -n 5

echo "gcc 位置：$(command -v gcc || echo '未找到')"
if command -v gcc >/dev/null 2>&1; then
  echo "gcc 版本：$(gcc --version | head -n 1)"
else
  echo "提示：安装工具链或修正 PATH 后重试"
fi

echo "环境已声明；把本脚本输出粘进 README，避免“我的机器能编译”。"
