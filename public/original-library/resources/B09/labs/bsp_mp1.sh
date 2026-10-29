#!/bin/sh
# STM32MP1 · SDK 环境与内核/设备树构建
source /opt/st/stm32mp1/4.1-snapshot/environment-setup-cortexa7t2hf-neon-vfpv4-ostl-linux-gnueabi

make stm32mp1_defconfig
# 用片段补充/裁剪
scripts/kconfig/merge_config.sh .config fragment.cfg
make -j"$(nproc)" devicetree zImage modules
make modules_install INSTALL_MOD_PATH=./modules_out
