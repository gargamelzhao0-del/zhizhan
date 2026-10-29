#!/bin/sh
# i.MX6ULL · 性能与调用分析
# 1) 采样热点
perf top -g

# 2) 跟踪系统调用（定位卡在哪个 syscall）
strace -f -tt -T /usr/bin/edge-app 2>&1 | tail -40

# 3) 内核崩溃现场：pstore/ramoops 里的上一次日志
cat /sys/fs/pstore/console-ramoops 2>/dev/null || echo "no ramoops"
