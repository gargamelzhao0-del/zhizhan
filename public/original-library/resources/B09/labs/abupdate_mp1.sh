#!/bin/sh
# STM32MP1 · A/B 根分区切换（U-Boot 侧用 bootcount + upgrade_available 判定）
# 正在跑 rootfsA(/dev/mmcblk0p5)，把新镜像写进 rootfsB(/dev/mmcblk0p6)
set -e
dd if=rootfsB.ext4 of=/dev/mmcblk0p6 bs=4M conv=fsync
sync

# 让 U-Boot 下次从 B 启动，并允许一次失败自动回退
fw_setenv upgrade_available 1
fw_setenv bootcount 0
fw_setenv bootslot B
reboot
