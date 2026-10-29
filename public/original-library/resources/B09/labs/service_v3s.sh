#!/bin/sh
# Allwinner V3s · 权限 / 进程 / 服务桥接
# 设备节点权限：普通用户访问 SPI 需要正确属主或 udev 规则
ls -l /dev/spidev0.0
chown app:app /dev/spidev0.0

# 看进程与资源
ps -o pid,user,stat,cmd
free -m

# 桥接到服务：以非 root 用户跑应用，崩溃由看护脚本重启
su - app -c "/usr/bin/edge-app" &
