#!/bin/sh
# STM32MP1 · 系统层调试速查
# 1) 启动日志与设备树模型
dmesg -n 8
dmesg | tail -50
cat /proc/device-tree/model

# 2) 调度/中断延迟（ftrace）
mount -t debugfs none /sys/kernel/debug 2>/dev/null
echo function_graph > /sys/kernel/debug/tracing/current_tracer
echo 1 > /sys/kernel/debug/tracing/tracing_on
sleep 1
echo 0 > /sys/kernel/debug/tracing/tracing_on
head -40 /sys/kernel/debug/tracing/trace
