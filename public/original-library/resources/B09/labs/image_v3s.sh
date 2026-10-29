#!/bin/sh
# Allwinner V3s · 组装一张可启动 SD 镜像
set -e
IMG=lichee-zero.img
dd if=/dev/zero of=$IMG bs=1M count=256
dd if=u-boot-sunxi-with-spl.bin of=$IMG bs=1024 seek=8 conv=notrunc
# 分区 1：FAT（boot）；分区 2：ext4（rootfs）
mkfs.vfat -n boot ${IMG}1
mcopy -i ${IMG}1 zImage :: ; mcopy -i ${IMG}1 sun8i-v3s-licheepi-zero.dtb ::
mkfs.ext4 -L rootfs ${IMG}2
mkdir -p /mnt/r && mount -o loop,offset=$((1*1024*1024)) ${IMG}2 /mnt/r
tar -C rootfs -c . | tar -C /mnt/r -x
umount /mnt/r
echo "镜像就绪：$IMG"
