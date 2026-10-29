# 设备树

```zhizhan-anchor
m03
```



设备树把“硬件长什么样”从内核代码里拿出来，用 **节点与属性** 描述。驱动靠  **compatible**  匹配设备， **status**  决定是否使能。读懂它，才能让“设备树写了但驱动不 probe”不再是玄学。

 

> 前置：了解 SoC 外设（UART/I2C 等）及其地址、寄存器与中断。 · ◷ 约 44 分钟 · ◈ STM32MP1 / i.MX6ULL / V3s 三路线对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能用节点路径与 compatible 匹配驱动、用 status 控制使能，并通过 /proc/device-tree 排查未 probe 的设备。

 

本章速览




- 设备树把硬件描述与驱动解耦：节点路径 \+ compatible 匹配 \+ status 使能。

- overlay 用于板级差异，不要改 SoC 公共 dtsi；/proc/device-tree 可查实际树。

- compatible 写错或 status=disabled → 驱动不 probe，设备“凭空消失”。

 

```zhizhan-anchor
m03-model
```



```zhizhan-anchor
m03-model-t
```



## 3.1 设备树解决什么问题：硬件的“数据化描述”



如果把每块板的硬件差异都写进内核源码，内核会被板级细节淹没。设备树把硬件描述 **外置成数据** ：同一份内核，配不同 dtb 就能跑不同板子。驱动只认 ` compatible ` 字符串，不关心具体是哪块板。



```zhizhan-anchor
fig-图-3-1
```



**图 3.1**  设备树的结构：节点 \+ 属性



```zhizhan-figure
<svg viewBox="0 0 800 180" width="100%" height="180" role="img" aria-label="设备树的结构：节点 + 属性" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-box"></rect><text x="75" y="49.0" class="sv-lbl-hi">根节点 /</text><rect x="60" y="64" width="680" height="43" rx="6" class="sv-cyn-s"></rect><text x="75" y="89.7" class="sv-lbl-hi">/soc（片上外设总线）</text><rect x="60" y="111" width="680" height="43" rx="6" class="sv-grn-s"></rect><text x="75" y="137.0" class="sv-lbl-hi">/soc/uart@40011000（compatible/reg/status）</text><rect x="60" y="159" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="177.7" class="sv-lbl-hi">/chosen（bootargs 等）</text></svg>
```



根节点下按路径组织：/soc 下的 uart@40011000 等。每个节点用属性描述硬件：compatible（匹配谁）、reg（地址/大小）、interrupts（中断）、status（是否使能）。



表 3.1 设备树核心概念



| 概念 | 作用 | 常见错误 |
| --- | --- | --- |
| 节点路径 | 定位设备（/soc/uart@…） | 路径拼错、单元地址漏写 |
| compatible | 驱动匹配字符串 | 拼写/厂商前缀错 → 不 probe |
| status | okay / disabled | 忘了打开，设备不出现 |
| overlay | 板级差异覆盖 | 直接改 SoC 公共 dtsi |
| chosen/bootargs | 启动参数 | 与 U-Boot 传参冲突 |



```zhizhan-anchor
m03-evidence
```



```zhizhan-anchor
m03-evidence-t
```



## 3.2 真实证据：匹配与使能判定



驱动是否 probe，取决于“路径 \+ compatible \+ status”三者同时成立。下面这段程序把它们机械地跑一遍：



host\_devtree.cC

 

```text
/* host_devtree.c —— 设备树语义模型：路径查找 + compatible 匹配 + status（主机可运行）。
 *
 * 内核用“节点路径 + 属性”描述硬件；驱动靠 compatible 匹配设备，status=disabled 表示不使能。
 * 本程序用一个内存中的树模型验证：① 按路径找到节点；② compatible 匹配；③ 只对 enabled 节点驱动。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_devtree.c -o host_devtree && ./host_devtree
 */
#include <stdio.h>
#include <string.h>

typedef struct { const char *k; const char *v; } prop_t;
typedef struct { const char *name; const char *parent; prop_t props[4]; int np; } node_t;

static node_t tree[] = {
    {"/", 0, {{0, 0}}, 0},
    {"soc", "/", {{0, 0}}, 0},
    {"uart@40011000", "soc", {{"compatible", "st,stm32-uart"}, {"status", "okay"}}, 2},
    {"i2c@40012000", "soc", {{"compatible", "st,stm32-i2c"}, {"status", "disabled"}}, 2},
};
#define NN (int)(sizeof(tree) / sizeof(tree[0]))

/* 构造节点的全路径：/soc/uart@40011000 */
static void full_path(const node_t *n, char *out) {
    if (n->parent == 0) { strcpy(out, "/"); return; }
    for (int i = 0; i < NN; i++) {
        if (&tree[i] == n) continue;
        if (strcmp(tree[i].name, n->parent) == 0) {
            char up[128];
            full_path(&tree[i], up);
            if (strcmp(up, "/") == 0) snprintf(out, 128, "/%s", n->name);
            else snprintf(out, 128, "%s/%s", up, n->name);
            return;
        }
    }
    strcpy(out, "/?");
}
static const node_t *dt_find(const char *path) {
    char buf[128];
    for (int i = 0; i < NN; i++) { full_path(&tree[i], buf); if (strcmp(buf, path) == 0) return &tree[i]; }
    return 0;
}
static const char *dt_prop(const node_t *n, const char *k) {
    for (int i = 0; i < n->np; i++) if (strcmp(n->props[i].k, k) == 0) return n->props[i].v;
    return 0;
}
static int dt_is_enabled(const node_t *n) {
    const char *s = dt_prop(n, "status");
    return (s == 0 || strcmp(s, "okay") == 0);     /* 缺省为 enabled */
}
static int dt_compatible(const node_t *n, const char *drv) {
    const char *c = dt_prop(n, "compatible");
    return c && strcmp(c, drv) == 0;
}

int main(void) {
    int ok = 1, probed = 0;
    const node_t *u = dt_find("/soc/uart@40011000");
    char buf[128];
    if (u) { full_path(u, buf); printf("找到节点: %s  compatible=%s  status=%s\n",
             buf, dt_prop(u, "compatible"), dt_prop(u, "status") ? dt_prop(u, "status") : "okay"); }
    if (!u) ok = 0;
    if (!(u && dt_compatible(u, "st,stm32-uart"))) ok = 0;
    if (!(u && dt_is_enabled(u))) ok = 0;

    const node_t *i2c = dt_find("/soc/i2c@40012000");
    printf("i2c 节点 status=%s → 驱动%s\n", i2c ? dt_prop(i2c, "status") : "?",
           (i2c && dt_is_enabled(i2c)) ? "探测" : "跳过（disabled）");
    if (!(i2c && !dt_is_enabled(i2c))) ok = 0;

    for (int i = 0; i < NN; i++) if (dt_is_enabled(&tree[i]) && dt_prop(&tree[i], "compatible")) probed++;
    printf("可被 compatible 匹配且 enabled 的节点数=%d（期望 1：uart）\n", probed);
    if (probed != 1) ok = 0;

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

设备树匹配与使能判定（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_devtree.c -o labs/host_devtree && ./labs/host_devtree
找到节点: /soc/uart@40011000  compatible=st,stm32-uart  status=okay
i2c 节点 status=disabled → 驱动跳过（disabled）
可被 compatible 匹配且 enabled 的节点数=1（期望 1：uart）
RESULT: PASS
```



uart 节点路径与 compatible 命中且 status=okay → 被“驱动”；i2c 虽存在但 disabled → 跳过。



```zhizhan-anchor
fig-图-3-2
```



**图 3.2**  驱动 probe 的三个条件



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="驱动 probe 的三个条件" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">节点存在</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">compatible 匹配</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">status=okay</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">驱动 probe</text></svg>
```



路径要对、compatible 要匹配、status 要为 okay。任一不满足，驱动就不会 probe，设备在系统里“不存在”。



board\_imx.dtsDTS

 

```text
/* i.MX6ULL · 设备树片段：启用 uart1 作为 console */
/dts-v1/;

/ {
    model = "i.MX6ULL 14x14 EVK";
    compatible = "fsl,imx6ull-14x14-evk", "fsl,imx6ull";

    chosen {
        stdout-path = &uart1;
    };

    soc {
        uart1: serial@02020000 {
            compatible = "fsl,imx6ul-uart", "fsl,imx6q-uart";
            reg = <0x02020000 0x4000>;
            interrupts = <GIC_SPI 26 IRQ_TYPE_LEVEL_HIGH>;
            status = "okay";
        };
    };
};
```

i.MX6ULL 板级 DTS 节选（labs/ 逐字一致）



overlay.dts 节选DTS

 

```text
// 板级差异用 overlay 覆盖，而不是改 SoC 公共 dtsi
&uart1 {
  status = "okay";          // 打开该实例
  pinctrl-0 = <&uart1_pins>;
};
&i2c2 {
  status = "disabled";      // 本板不用则显式关闭
};
```

overlay 只描述“本板差异”，公共 dtsi 保持不动



```zhizhan-anchor
m03-debug
```



```zhizhan-anchor
m03-debug-t
```



## 3.3 调试：/proc/device-tree 与内核日志



内核起来后，` /proc/device-tree/ ` 是 **运行时真实树** （含 overlay 结果）。若某设备驱动没 probe：先看它的 ` status ` 与 ` compatible `，再看内核日志里有没有匹配记录（` dmesg | grep `）。



表 3.2 按现象排查设备树



| 现象 | 先查 | 常见原因 |
| --- | --- | --- |
| 设备完全没出现 | status / compatible | disabled 或字符串写错 |
| 驱动报地址冲突 | reg 与手册 | 地址/大小写错或重叠 |
| 中断不触发 | interrupts / interrupts-parent | 中断号或控制器写错 |
| 改 dts 不生效 | 是否重编 dtb / 加载路径 | U-Boot 加载了旧 dtb |
| 行为不符 | overlay 是否生效 | 覆盖顺序或属性拼写 |



改设备树后的“三件事”



① 重编 dtb；② 确认 U-Boot 加载的是新 dtb（路径/分区）；③ 起来后看 ` /proc/device-tree ` 是否真是新版。少一步就会出现“改了没效果”的错觉。



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm03-routes\n```\n\n\n\n```zhizhan-anchor\nm03-routes-t\n```\n\n\n\n## 3.4 三条路线对照：板级设备树\n\n\n\n每条路线的“板级差异”都写在各自的板级 DTS 里，通过 ` compatible ` 与 SoC 公共 dtsi 关联。对照时可以只关注“本板上哪些节点被打开/参数不同”。\n\n\n\n| 项 | STM32MP1 |\n| --- | --- |\n| dts 名 | stm32mp157c-…-mx.dts |\n| 关键节点 | uart4 / ethernet0 |\n| 覆盖方式 | overlay |\n\n\n\n| 项 | i.MX6ULL |\n| --- | --- |\n| dts 名 | imx6ull-…-board.dts |\n| 关键节点 | uart1 / fec1 |\n| 覆盖方式 | include \\+ 覆盖 |\n\n\n\n| 项 | V3s |\n| --- | --- |\n| dts 名 | sun8i-v3s-…-board.dts |\n| 关键节点 | uart0 / emac |\n| 覆盖方式 | include \\+ 覆盖 |"}
````



```zhizhan-anchor
m03-pitfalls
```



```zhizhan-anchor
m03-pitfalls-t
```



## 3.5 常见误区与排障



失败路径与排障




- **compatible 写错** ：驱动永远不 probe。

- **status=disabled 忘记改** ：SoC dtsi 默认关闭，板级没覆盖。

- **改公共 dtsi 而非 overlay** ：影响其它板，升级易冲突。

- **reg/interrupts 与手册不符** ：驱动读到错误地址/中断。



◆ 自测 · Module 03（先答再看）




1. 内核日志里完全没有某设备的匹配记录，先查什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"先查设备树里该节点是否存在、` status ` 是否 okay、` compatible ` 是否与驱动一致；三者任一不对，驱动都不会 probe。"}
   ```

2. 为什么板级差异应该写 overlay，而不是直接改 SoC 的公共 dtsi？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"公共 dtsi 被多块板共享，直接改会影响其它板，且升级内核时容易冲突。overlay 只描述本板差异，干净且可叠加。"}
   ```

3. 改了 .dts 却“没生效”，最可能漏了哪一步？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"多半是没重编 dtb，或 U-Boot 仍加载旧 dtb（路径/分区不对）。起来后用 ` /proc/device-tree ` 确认真实生效版本。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：打开你板子的 dtb 反编译（dtc -I dtb -O dts），找出一个 status=disabled 的外设，说明如何在 overlay 里正确打开。



核对与延伸：[Linux 内核 · 设备树用法](https://www.kernel.org/doc/html/latest/devicetree/usage-model.html)

 

动手练习



运行 ` labs/host_devtree.c `：按路径查找节点、用 compatible 匹配、只对 enabled 节点“驱动”。



**检查结果：** /soc/uart@40011000 命中（compatible=st,stm32-uart、status=okay）；disabled 的 i2c 被跳过；可匹配且 enabled 节点数=1。

 

迁移练习：把本章的“能用节点路径与 compatible 匹配驱动、用 status 控制使能，并通过 /proc/device-tree 排查未 probe 的设备。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 03 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b09-m03","criterion":"/soc/uart@40011000 命中（compatible=st,stm32-uart、status=okay）；disabled 的 i2c 被跳过；可匹配且 enabled 节点数=1。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b09-guide)
