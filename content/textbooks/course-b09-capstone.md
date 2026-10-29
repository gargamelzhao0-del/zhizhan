# 从源码到可启动、可恢复的镜像

```zhizhan-anchor
capstone
```



把 10 章串成一条可验收的构建路径：构建内核\+设备树\+模块 → 构建根文件系统 → 组装并烧录镜像 → 启动 → 只读根 → A/B 升级 → 失败用 recovery 恢复。



> ◈ 10 步构建路径 · ⚑ 每步可验收

 

把 10 章的能力串成一条可交付的构建路径： **构建内核\+设备树\+模块 → 构建根文件系统 → 组装并烧录镜像 → 启动 → 只读根 → A/B 升级 → 失败用 recovery 恢复。** 每一步都有可检验的验收。

 

 
1. **① 启动链** （M01/M04）——ROM→SPL→U-Boot→Kernel→init 全部打通；验收：串口日志五跳齐全、无 panic。
 
2. **② 工具链** （M02）——工具链\+sysroot 一致；验收：内核与应用用同一套编译通过。
 
3. **③ 设备树** （M03）——按路径与 compatible 匹配；验收：目标设备 status=okay 且驱动 probe。
 
4. **④ 内核** （M04）——defconfig \+ 片段裁剪；验收：bootargs 正确、启动时间可量化。
 
5. **⑤ 根文件系统** （M05）——busybox/init/库齐备；验收：布局自检 0 错误、能到 init。
 
6. **⑥ 存储** （M06）——分区与文件系统选型；验收：root= 与分区一致、坏块有处理。
 
7. **⑦ 调试** （M07）——dmesg/ftrace/strace/pstore；验收：能定位“卡在哪、慢在哪、崩在哪”。
 
8. **⑧ 系统使用** （M08）——权限/进程/挂载/设备节点/网络/服务；验收：非 root 跑应用、服务可托管。
 
9. **⑨ 交付** （M09）——BSP 版本化 \+ SDK；验收：换机器能复现出同一镜像。
 
10. **⑩ 恢复** （M10）——` labs/capstone_image.sh `；验收：A/B 升级失败能自动回滚，recovery 能救砖。
 

 

本册所有板上项（真实启动时间、镜像烧录、A/B 切换、坏块表现）均标注为“需上板实测”，未接板不声称已测；设备树匹配、启动日志分阶段、init 依赖排序、rootfs 布局、cpio 打包、Kconfig 冲突、Shell 分词等主机可验证的部分已给出真实运行结果。



capstone\_image.shShell

 

```text
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
```


---

[本册导读、实验资料与完整学习规划](doc:course-b09-guide)
