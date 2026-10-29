# STM32MP1 · U-Boot 启动脚本（distro boot：load kernel + dtb → bootz）
# bootargs 里 root= 指向根分区；ro 便于恢复，调试时可改 rw
setenv bootargs "console=ttySTM0,115200 root=/dev/mmcblk0p5 rootwait ro"
load mmc 0:4 ${kernel_addr_r} /boot/zImage
load mmc 0:4 ${fdt_addr_r} /boot/stm32mp157c-dk2.dtb
bootz ${kernel_addr_r} - ${fdt_addr_r}
