#!/bin/sh
# Allwinner V3s · 启动与设备排查
# 存储/串口设备是否被内核识别
dmesg | grep -iE "mmc|spi|uart|sunxi"

# 网络接口与状态
ls -l /sys/class/net/
ip -br link

# 中断分布（看有没有设备在“刷中断”）
cat /proc/interrupts
