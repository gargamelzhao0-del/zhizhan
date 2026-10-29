# Allwinner V3s · U-Boot 启动脚本（可从 SPI/FEL 引导，内核放 FAT 分区）
setenv bootargs "console=ttyS0,115200 root=/dev/mmcblk0p2 rootwait"
fatload mmc 0:1 ${kernel_addr_r} zImage
fatload mmc 0:1 ${fdt_addr_r} sun8i-v3s-licheepi-zero.dtb
bootz ${kernel_addr_r} - ${fdt_addr_r}
