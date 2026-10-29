# 板级移植与系统镜像交付

```zhizhan-anchor
m09
```



BSP 不是一个文件，而是 **一组版本化的产物** ：Bootloader、内核、设备树、根文件系统、SDK、镜像。它们的版本必须一起管理，才能“换台机器复现同一镜像”。本章把交付工程化。

 

> 前置：完成内核/设备树/根文件系统构建（M02–M05）并了解 Bootloader 与镜像烧录。 · ◷ 约 42 分钟 · ◈ STM32MP1 / i.MX6ULL / V3s 三路线对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能把 Bootloader/内核/dtb/rootfs/SDK/镜像作为一组版本化 BSP 交付，并在换机器后复现同一镜像。

 

本章速览




- BSP = Bootloader \+ 内核 \+ 设备树 \+ 根文件系统，版本要一起管理。

- Buildroot 加包、Yocto 写 layer/配方；交付带 SDK 便于二次开发。

- 镜像要可复现、可烧录、可升级、可恢复，四条缺一不可。

 

```zhizhan-anchor
m09-bsp
```



```zhizhan-anchor
m09-bsp-t
```



## 9.1 BSP 是“一组版本化产物”



BSP（Board Support Package）不是单个文件。它是一组必须 **一起版本化** 的产物：Bootloader、内核\+dtb、根文件系统、SDK、镜像。任何一个版本漂移，都可能造成“换台机器结果不同”。



```zhizhan-anchor
fig-图-9-1
```



**图 9.1**  BSP 的组成与依赖



```zhizhan-figure
<svg viewBox="0 0 800 200" width="100%" height="200" role="img" aria-label="BSP 的组成与依赖" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">Bootloader（U-Boot + 环境）</text><rect x="60" y="64" width="680" height="43" rx="6" class="sv-amb-s"></rect><text x="75" y="89.4" class="sv-lbl-hi">内核 + dtb（defconfig + 板级 dts）</text><rect x="60" y="111" width="680" height="43" rx="6" class="sv-grn-s"></rect><text x="75" y="136.3" class="sv-lbl-hi">rootfs（busybox/systemd + 应用）</text><rect x="60" y="158" width="680" height="30" rx="6" class="sv-box"></rect><text x="75" y="176.7" class="sv-lbl-hi">SDK（与 rootfs 同源的工具链）</text><rect x="60" y="192" width="680" height="30" rx="6" class="sv-box"></rect><text x="75" y="210.7" class="sv-lbl-hi">镜像（sdcard.img/.wic）</text></svg>
```



Bootloader 引导内核\+dtb；内核挂载 rootfs；SDK 提供与 rootfs 同源的工具链；镜像把上述产物打包成可烧录文件。版本必须一致记录。



表 9.1 BSP 交付物与验收



| 交付物 | 内容 | 验收 |
| --- | --- | --- |
| Bootloader | U-Boot \+ 环境默认值 | 能引导、变量可写 |
| 内核\+dtb | defconfig \+ 片段 \+ 板级 dts | 设备 probe、能挂根 |
| 根文件系统 | busybox/systemd \+ 应用 | 最小集合自检通过 |
| SDK | 交叉工具链 \+ sysroot | 能编出目标程序 |
| 镜像 | sdcard.img/.wic | 可烧录、可启动 |



```zhizhan-anchor
m09-add
```



```zhizhan-anchor
m09-add-t
```



## 9.2 加功能：Buildroot 包 vs Yocto 配方



给系统加功能有两条路线：Buildroot 里加“包”（简单直接），Yocto 里写“配方 \+ 层”（可裁剪、标准化）。两条路线最终都要能“换台机器复现”。



```zhizhan-anchor
fig-图-9-2
```



**图 9.2**  从源码到可交付镜像



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="从源码到可交付镜像" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="88.0" y="66" text-anchor="middle" class="sv-lbl-hi">源码/配方</text><path d="M158,69 H174" class="sv-arrow"></path><rect x="176" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="244.0" y="66" text-anchor="middle" class="sv-lbl-hi">交叉编译</text><path d="M314,69 H330" class="sv-arrow"></path><rect x="332" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="400.0" y="66" text-anchor="middle" class="sv-lbl-hi">组装 rootfs</text><path d="M470,69 H486" class="sv-arrow"></path><rect x="488" y="44" width="136" height="50" rx="7" class="sv-cyn-s"></rect><text x="556.0" y="66" text-anchor="middle" class="sv-lbl-hi">打包镜像</text><path d="M626,69 H642" class="sv-arrow"></path><rect x="644" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="712.0" y="66" text-anchor="middle" class="sv-lbl-hi">烧录验证</text></svg>
```



取源码/配方 → 交叉编译 → 组装 rootfs → 打包镜像 → 烧录/验证。每一步都应脚本化、可复跑。



layer\_imx.bbText

 

```text
# i.MX6ULL · Yocto 自定义层中的一个应用配方（示例）
SUMMARY = "Edge application"
LICENSE = "MIT"
LIC_FILES_CHKSUM = "file://${COMMON_LICENSE_DIR}/MIT;md5=0835ade698e0bcf8506ecda2f7b4f302"
SRC_URI = "file://edge-app.c"

S = "${WORKDIR}"

do_compile() {
    ${CC} ${CFLAGS} ${LDFLAGS} edge-app.c -o edge-app
}

do_install() {
    install -d ${D}${bindir}
    install -m 0755 edge-app ${D}${bindir}
}
```

Yocto 配方节选（labs/ 逐字一致）



表 9.2 加功能的路线选择



| 做法 | 入口 | 适合 | 复现性 |
| --- | --- | --- | --- |
| Buildroot 包 | Config.in \+ .mk | 功能少、迭代快 | 高（配置即代码） |
| Yocto 配方/层 | \*.bb \+ layer.conf | 产品线、长期维护 | 很高（layer/配方） |
| 直接塞二进制 | 手动拷贝到 rootfs | 临时验证 | 低，不建议交付 |



```zhizhan-anchor
m09-sdk
```



```zhizhan-anchor
m09-sdk-t
```



## 9.3 SDK：把“正确的工具链”固化下来



应用团队最容易踩的坑是用错工具链。交付  **SDK** （与 rootfs 同源的交叉编译器 \+ sysroot）把“正确的工具链”固化，避免 ABI/库错配。



表 9.3 SDK 的组成与验证



| SDK 内容 | 作用 | 验证 |
| --- | --- | --- |
| 交叉编译器 | 编出目标架构程序 | 编译一个 hello 并跑通 |
| sysroot | 目标头/库 | 与 rootfs 库同源 |
| 环境脚本 | 设 PATH/环境 | source 后能直接编译 |
| pkg-config 等 | 依赖查找 | 能查到目标库 |



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_toolchain.c -o labs/host_toolchain && ./labs/host_toolchain
STM32MP1   triple=arm-ostl-linux-gnueabi     sysroot=/opt/st/sysroots/cortexa7t2hf-neon-vfpv4   一致=是
i.MX6ULL   triple=arm-poky-linux-gnueabi     sysroot=/opt/yocto/sysroots/armv7ahf-neon          一致=是
V3s        triple=arm-linux-gnueabihf        sysroot=/opt/v3s-sdk/sysroot/arm-linux-gnueabihf   一致=是
错配示例 triple=aarch64-linux-gnu          sysroot=/opt/v3s-sdk/sysroot/arm-linux-gnueabihf   一致=否
RESULT: PASS
```



SDK 交付后应能用它编出目标程序，且工具链与 rootfs 同源（三条路线一致=是，错配=否）。



bsp\_mp1.shShell

 

```text
#!/bin/sh
# STM32MP1 · SDK 环境与内核/设备树构建
source /opt/st/stm32mp1/4.1-snapshot/environment-setup-cortexa7t2hf-neon-vfpv4-ostl-linux-gnueabi

make stm32mp1_defconfig
# 用片段补充/裁剪
scripts/kconfig/merge_config.sh .config fragment.cfg
make -j"$(nproc)" devicetree zImage modules
make modules_install INSTALL_MOD_PATH=./modules_out
```

STM32MP1 构建脚本节选（labs/ 逐字一致）



```zhizhan-anchor
m09-image
```



```zhizhan-anchor
m09-image-t
```



## 9.4 镜像组装与烧录验证



镜像是交付的最终形态。组装要可复跑，烧录后要按 M01 的启动链验证“五跳齐全”。镜像里应包含 boot、A/B rootfs（见 M06/M10）。



image\_v3s.shShell

 

```text
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
```

V3s 镜像组装脚本节选（labs/ 逐字一致）



表 9.4 常见的镜像产物



| 镜像类型 | 用途 | 注意 |
| --- | --- | --- |
| sdcard.img / .wic | 整盘镜像，含分区表 | dd 到 SD/eMMC |
| boot 镜像 | U-Boot/内核/dtb | 与分区表一致 |
| rootfs 镜像 | A/B 根 | 可做增量升级 |
| recovery 镜像 | 救援 | 独立于 A/B |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm09-routes\n```\n\n\n\n```zhizhan-anchor\nm09-routes-t\n```\n\n\n\n## 9.5 三条路线对照：构建与交付\n\n\n\n三条路线用的构建系统与产物名不同，但“版本化 \\+ SDK \\+ 可复现”的要求一致。\n\n\n\n| 项 | STM32MP1 |\n| --- | --- |\n| 构建 | Yocto/OpenSTLinux |\n| SDK | SDK 安装脚本 |\n| 镜像 | .wic / .img |\n\n\n\n| 项 | i.MX6ULL |\n| --- | --- |\n| 构建 | Yocto |\n| SDK | meta-toolchain |\n| 镜像 | .wic |\n\n\n\n| 项 | V3s |\n| --- | --- |\n| 构建 | Buildroot |\n| SDK | host/ 工具链 |\n| 镜像 | sdcard.img |"}
````



```zhizhan-anchor
m09-pitfalls
```



```zhizhan-anchor
m09-pitfalls-t
```



## 9.6 常见误区与排障



失败路径与排障




- **BSP 版本不记录** ：无法复现，也无法定位回归。

- **内核与 rootfs 工具链不同源** ：ABI 错配，应用崩溃。

- **镜像不可烧录/不可恢复** ：交付即事故。

- **无 SDK** ：应用团队各自为政，库版本混乱。



◆ 自测 · Module 09（先答再看）




1. 为什么交付 BSP 时一定要附带 SDK？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"应用开发者需要与 rootfs 同源的交叉工具链与 sysroot，否则编译出的程序可能缺库或 ABI 不兼容。SDK 把“正确的工具链”固化下来。"}
   ```

2. BSP 为什么要“一组产物一起版本化”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"Bootloader/内核/dtb/rootfs/SDK/镜像相互依赖，任一处版本漂移都可能导致“换台机器结果不同”，无法复现与定位回归。"}
   ```

3. 镜像组装脚本化（如 image\_\*.sh）有什么价值？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"可复跑、可审计、可 CI 化。每次交付都能重放同一过程，问题可定位到具体步骤。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：把你项目的 BSP 产物列一份“版本清单”（各组件 \+ 工具链），并写一个可复跑的镜像组装脚本。



核对与延伸：[Buildroot 官方手册](https://buildroot.org/downloads/manual/manual.html) · [Yocto Project 文档](https://docs.yoctoproject.org/)

 

动手练习



查阅 ` labs/bsp_mp1.sh `、` labs/layer_imx.bb `、` labs/image_v3s.sh `；用 ` host_toolchain.c ` 校验工具链一致性。



**检查结果：** BSP 各产物版本可查、工具链与 rootfs 同源（三路线一致=是、错配=否）；Shell 片段过 bash -n。

 

迁移练习：把本章的“能把 Bootloader/内核/dtb/rootfs/SDK/镜像作为一组版本化 BSP 交付，并在换机器后复现同一镜像。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 09 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b09-m09","criterion":"BSP 各产物版本可查、工具链与 rootfs 同源（三路线一致=是、错配=否）；Shell 片段过 bash -n。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b09-guide)
