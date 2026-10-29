#!/bin/sh
# 贯穿项目：从源码到可启动镜像再到 A/B 升级与恢复的完整流程（参考脚本）
# 1) 构建内核 + 设备树 + 模块
make -j"$(nproc)" zImage dtbs modules

# 2) 构建根文件系统（以 Buildroot 为例，输出 rootfs.ext4 / sdcard.img）
make -C buildroot BR2_EXTERNAL=../board stm32mp1_defconfig
make -C buildroot -j"$(nproc)"

# 3) 组装并烧录镜像（块设备按实际替换）
dd if=buildroot/output/images/sdcard.img of=/dev/sdX bs=4M conv=fsync status=progress

# 4) 首次启动后：只读根 + overlay，A/B 分区用于升级
#    fw_printenv 查看 bootslot / bootcount；升级流程见 abupdate_mp1.sh

# 5) 故障兜底：从 recovery 分区恢复 rootfs，见 recovery_v3s.sh
echo "build → flash → boot → A/B update → recovery 全链路完成"
