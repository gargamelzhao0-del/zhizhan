# 三条参考路线速查

```zhizhan-anchor
cheatsheet
```



把“换一条路线/一块板就写错”的点集中在一张表里，遇到问题先对照。

 

把“换一条路线/一块板就写错”的点集中在一张表里。遇到问题先在这里对照。



| 主题 | STM32MP1 · Buildroot | i.MX6ULL · Yocto | Allwinner V3s · Distro | 易错点 |
| --- | --- | --- | --- | --- |
| 引导脚本 | load kernel\+dtb→bootz | load kernel\+dtb→bootz | fatload→bootz | load 地址/bootargs 不一致 |
| 构建系统 | make menuconfig 产物链 | layer \+ 配方 \+ .wic | debootstrap \+ SDK | 工具链/sysroot 不匹配 |
| 设备树 | board.dts \+ chosen | board.dts \+ stdout-path | 包含 dtsi \+ overlay | compatible/status 写错 |
| 内核配置 | defconfig \+ 片段裁剪 | defconfig \+ 片段裁剪 | defconfig \+ 片段裁剪 | 裁剪掉必需驱动 |
| 根文件系统 | busybox \+ rcS | systemd 服务 | SysV rc.local | 库依赖/init 缺失 |
| 分区 | GPT fsbl/ssbl/boot/rootfs | MBR boot\+rootfs (.wic) | NOR/SD 多方案 | root= 与分区不匹配 |
| 调试 | dmesg \+ ftrace | perf \+ strace \+ pstore | dmesg \+ /proc | 不看日志凭猜 |
| 只读根 | overlayfs | overlayfs | overlayfs | 可写层未持久化 |
| 升级 | A/B \+ bootcount | swupdate / RAUC | recovery 分区覆盖 | 无回滚 = 可能变砖 |
| 交付 | sdcard.img \+ SDK | .wic \+ SDK | 自组装镜像 | 不可复现/不可恢复 |


---

[本册导读、实验资料与完整学习规划](doc:course-b09-guide)
