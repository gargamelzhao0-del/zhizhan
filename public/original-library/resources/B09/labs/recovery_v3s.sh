#!/bin/sh
# Allwinner V3s · 恢复介质与只读根恢复
# 从 SD 卡的 recovery 分区（p3）覆盖损坏的 rootfs（p2），再切回正常启动
set -e
mkdir -p /mnt/rec /mnt/root
mount /dev/mmcblk0p3 /mnt/rec
mount /dev/mmcblk0p2 /mnt/root
rsync -a --delete /mnt/rec/rootfs/ /mnt/root/
sync
umount /mnt/root /mnt/rec
reboot
