# i.MX6ULL · U-Boot 启动脚本（MMC 上内核与 dtb 同分区）
# 注意：i.MX 串口是 ttymxc0，内核与 dtb 用同一分区
setenv bootargs "console=ttymxc0,115200 root=/dev/mmcblk1p2 rootwait rw"
load mmc 0:1 ${loadaddr} /zImage
load mmc 0:1 ${fdt_addr} /imx6ull-14x14-evk.dtb
bootz ${loadaddr} - ${fdt_addr}
