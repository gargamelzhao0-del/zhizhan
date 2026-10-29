# 术语表

```zhizhan-anchor
glossary
```



先定义、再结论；不同路线/厂商的叫法差异也一并标注。

 

按“先定义、再结论”的方式收口；不同路线/厂商的叫法差异也标注在此。



BSP



板级支持包：Bootloader \+ 内核 \+ 设备树 \+ 根文件系统 \+ 驱动的一组版本化产物。



ROM Code



SoC 固化的一级引导，只做最少的初始化并按启动介质加载 SPL/FSBL。



SPL / FSBL



二级引导，初始化 DDR 时钟等，再把 U-Boot 加载起来。



U-Boot



通用引导器：加载内核与设备树、传 bootargs、提供升级/回滚环境变量。



设备树 (DTS/DTB)



描述硬件的节点与属性；内核据此匹配驱动，与代码解耦。



compatible



设备与驱动的匹配字符串；不匹配则驱动不 probe。



overlay



设备树覆盖层，用于板级差异，避免改 SoC 公共 dtsi。



sysroot



交叉工具链对应的目标根库；内核/应用必须用同一套。



Buildroot



轻量构建系统：一个配置产出内核\+rootfs\+镜像，直接快速。



Yocto



元数据/层构建系统：可裁剪、可复现、标准化，学习曲线陡。



initramfs



内存中的早期根文件系统（cpio 归档），常用于引导与恢复。



busybox



把大量 UNIX 工具塞进一个可执行文件；最小 rootfs 的基石。



overlayfs



联合文件系统：只读根 \+ 可写层，系统可恢复、升级更简单。



UBIFS / F2FS



NAND 用 UBIFS（含坏块/磨损处理）；闪存友好型还有 F2FS。



A/B 分区



两套系统分区交替升级，配合 bootcount 实现失败自动回退。



bootcount / bootslot



U-Boot 环境变量：记录启动尝试次数与当前槽位，决定是否回滚。



recovery 分区



独立的最小系统，用于恢复损坏的 rootfs 或重刷固件。



pstore / ramoops



把内核崩溃日志保留在内存/闪存，重启后仍可读取。



swupdate / RAUC



嵌入式 [OTA](term:ota) 框架：签名校验、A/B 更新、回滚。


---

[本册导读、实验资料与完整学习规划](doc:course-b09-guide)
