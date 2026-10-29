#!/bin/sh
# STM32MP1 · Buildroot /etc/init.d/rcS：最小挂载 + 交给 init
# 只读根 + overlay 时，先挂 tmpfs 覆盖可写目录
mount -t proc none /proc
mount -t sysfs none /sys
mount -t devtmpfs none /dev 2>/dev/null
mkdir -p /run /tmp /overlay
mount -t tmpfs none /run
mount -t tmpfs none /tmp
exec /sbin/init
