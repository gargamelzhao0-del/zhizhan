#!/bin/sh
# STM32MP1 · 只读根 + overlayfs：系统可恢复、写入不落根分区
# 把根设为只读，再用 tmpfs + overlay 提供可写层
mount -o remount,ro /
mkdir -p /overlay/upper /overlay/work /mnt
mount -t tmpfs none /overlay
mount -t overlay overlay \
    -o lowerdir=/,upperdir=/overlay/upper,workdir=/overlay/work /mnt
# 之后把 /etc /var 等通过 bind 指向 /mnt 下的可写副本（示意）
