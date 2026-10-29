# 设备树与 platform driver

```zhizhan-anchor
m05
```



不可枚举的 SoC 内部外设用  **platform 总线** ：内核从设备树创建 ` platform_device `，驱动用 ` of_match_table ` 的  **compatible**  匹配，匹配成功调用 ` probe `；依赖未就绪返回 ` -EPROBE_DEFER ` 稍后重试。

 

> 前置：Module 01 模块加载与 Module 04 中断注册。 · ◷ 约 46 分钟 · ◈ 三平台驱动对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能写出用 of\_match\_table 匹配、probe 失败返回 -EPROBE\_DEFER 并重试的 platform driver。

 

本章速览




- platform 总线用 of\_match\_table 的 compatible 匹配设备与驱动。

- probe 失败要回滚；依赖未就绪返回 -EPROBE\_DEFER 稍后重试。

- remove 与 probe 对称，资源用 devm\_\* 自动释放。

 

```zhizhan-anchor
m05-model
```



```zhizhan-anchor
m05-model-t
```



## 5.1 platform 总线：把“不可枚举”的设备接进来



PCI/USB 能“枚举”设备，但 SoC 内部外设（UART/I2C/SPI 控制器）无法枚举。platform 总线解决它：内核从设备树为每个节点创建 ` platform_device `，驱动注册 ` platform_driver `，双方用  **compatible**  匹配。



```zhizhan-anchor
fig-图-5-1
```



**图 5.1**  platform 匹配：device 与 driver 的结合



```zhizhan-figure
<svg viewBox="0 0 800 180" width="100%" height="180" role="img" aria-label="platform 匹配：device 与 driver 的结合" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="43" rx="6" class="sv-cyn-s"></rect><text x="75" y="55.7" class="sv-lbl-hi">设备树节点（compatible/reg/irq）</text><rect x="60" y="77" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="96.3" class="sv-lbl-hi">platform_device</text><rect x="60" y="111" width="680" height="43" rx="6" class="sv-grn-s"></rect><text x="75" y="137.0" class="sv-lbl-hi">platform_driver + of_match_table</text><rect x="60" y="159" width="680" height="30" rx="6" class="sv-box"></rect><text x="75" y="177.7" class="sv-lbl-hi">compatible 一致 → probe()</text></svg>
```



设备树节点 → platform\_device（带 compatible/reg/irq）；驱动注册 of\_match\_table；compatible 一致则调用 probe，拿到资源并初始化。



表 5.1 platform driver 的关键概念



| 概念 | 作用 | 要点 |
| --- | --- | --- |
| of\_match\_table | 设备/驱动匹配 | compatible 必须与 dts 一致 |
| probe | 初始化并注册 | 失败要回滚 |
| platform\_get\_resource | 取 reg/irq | 索引与 dts 对应 |
| deferred probe | 依赖未就绪 | 返回 -EPROBE\_DEFER 稍后重试 |
| remove | 注销与释放 | 与 probe 对称 |



```zhizhan-anchor
m05-evidence
```



```zhizhan-anchor
m05-evidence-t
```



## 5.2 真实证据：匹配、deferred、unbound



下面这段程序把“匹配成功 probe / 依赖未就绪 deferred / 无匹配 unbound / 重试后 probe”跑出来：



host\_platform.cC

 

```text
/* host_platform.c —— platform driver 匹配与 deferred probe 模型（主机可运行）。
 *
 * 内核按 compatible 把设备与驱动绑定；若某设备的依赖尚未就绪，则返回 -EPROBE_DEFER，稍后重试。
 * 本程序验证：匹配成功 → probe；依赖未就绪 → deferred；无匹配 → unbound。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_platform.c -o host_platform && ./host_platform
 */
#include <stdio.h>
#include <string.h>

typedef struct { const char *compatible; const char *drv; } match_t;
static const match_t MATCH[] = { {"v,dev-a", "drvA"}, {"v,dev-b", "drvB"} };
#define NM (int)(sizeof(MATCH) / sizeof(MATCH[0]))

typedef struct { const char *name; const char *compat; const char *dep; int probed; int deferred; } dev_t;
static dev_t DEV[] = {
    {"dev-b@0", "v,dev-b", "v,dev-a", 0, 0},
    {"dev-a@1", "v,dev-a", 0,         0, 0},
    {"dev-c@2", "v,dev-c", 0,         0, 0},
};
#define NDV (int)(sizeof(DEV) / sizeof(DEV[0]))

static const char *drv_for(const char *c) { for (int i = 0; i < NM; i++) if (strcmp(MATCH[i].compatible, c) == 0) return MATCH[i].drv; return 0; }
static int dep_ready(const char *dep) { if (!dep) return 1; for (int i = 0; i < NDV; i++) if (strcmp(DEV[i].compat, dep) == 0) return DEV[i].probed; return 0; }

int main(void) {
    int ok = 1;
    /* 第一遍：dev-b 的依赖 dev-a 尚未 probe → deferred */
    for (int i = 0; i < NDV; i++) {
        const char *d = drv_for(DEV[i].compat);
        if (!d) { printf("%-8s unbound（无匹配驱动）\n", DEV[i].name); continue; }
        if (!dep_ready(DEV[i].dep)) { DEV[i].deferred = 1; printf("%-8s deferred（依赖 %s 未就绪）\n", DEV[i].name, DEV[i].dep); continue; }
        DEV[i].probed = 1; printf("%-8s probe → %s\n", DEV[i].name, d);
    }
    if (DEV[1].probed != 1) ok = 0;      /* dev-a 已 probe */
    if (DEV[0].probed != 0 || DEV[0].deferred != 1) ok = 0;

    /* 第二遍：重试 deferred */
    printf("-- 重试 deferred --\n");
    for (int i = 0; i < NDV; i++)
        if (DEV[i].deferred && dep_ready(DEV[i].dep)) { DEV[i].probed = 1; printf("%-8s probe → %s\n", DEV[i].name, drv_for(DEV[i].compat)); }
    if (DEV[0].probed != 1) ok = 0;

    printf("最终：probed=%d unbound=1\n", DEV[0].probed + DEV[1].probed);
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

platform 匹配与 deferred probe 模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_platform.c -o labs/host_platform && ./labs/host_platform
dev-b@0  deferred（依赖 v,dev-a 未就绪）
dev-a@1  probe → drvA
dev-c@2  unbound（无匹配驱动）
-- 重试 deferred --
dev-b@0  probe → drvB
最终：probed=2 unbound=1
RESULT: PASS
```



dev-a 直接 probe；dev-b 依赖未就绪返回 deferred，重试后成功；dev-c 无匹配驱动保持 unbound。



```zhizhan-anchor
fig-图-5-2
```



**图 5.2**  probe 的三种结局



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="probe 的三种结局" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">匹配?</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">依赖就绪?</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">probe/defer</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">unbound</text></svg>
```



匹配且依赖就绪 → probe 成功；匹配但依赖未就绪 → -EPROBE\_DEFER，稍后重试；无匹配 → 保持 unbound。



```zhizhan-anchor
m05-probe
```



```zhizhan-anchor
m05-probe-t
```



## 5.3 probe/remove 与资源获取



` probe ` 负责初始化并注册；失败必须回滚。 **remove 要与 probe 对称** ：probe 里申请的资源，remove 里释放。资源（reg/irq/clk/gpio）用 devm\_\* 托管可自动释放，减少出错。



myplat.c 节选C

 

```text
static const struct of_device_id my_of[] = {
    { .compatible = "vendor,myplat" },
    { }
};
static int my_probe(struct platform_device *pdev) {
    void __iomem *base = devm_platform_ioremap_resource(pdev, 0);
    if (IS_ERR(base)) return PTR_ERR(base);
    int irq = platform_get_irq(pdev, 0);
    if (irq < 0) return dev_err_probe(&pdev->dev, irq, "no irq");
    return 0;   // 依赖未就绪时返回 -EPROBE_DEFER
}
```

of\_match\_table \+ probe \+ devm 资源托管（失败自动回滚）



表 5.2 probe 里获取资源



| 资源 | 获取方式 | 托管优点 |
| --- | --- | --- |
| 寄存器区 | devm\_platform\_ioremap\_resource | remove 自动 iounmap |
| 中断 | platform\_get\_irq | 失败返回 -EPROBE\_DEFER 场景 |
| 时钟 | devm\_clk\_get | 未就绪 → -EPROBE\_DEFER |
| GPIO | devm\_gpiod\_get | 自动释放 |
| 内存 | devm\_kzalloc | 自动 kfree |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm05-routes\n```\n\n\n\n```zhizhan-anchor\nm05-routes-t\n```\n\n\n\n## 5.4 三条内核路线对照：platform/dts\n\n\n\n三条路线都用 platform \\+ of\\_match\\_table，差异在板级 dts 的节点与 compatible 字符串。\n\n\n\n表 5.3 三条路线的 compatible 命名\n\n\n\n| 内核路线 | compatible 示例 | 资源节点 | 说明 |\n| --- | --- | --- | --- |\n| STM32MP1 | st,stm32-uart | reg \\+ interrupts | mainline |\n| i.MX6ULL | fsl,imx6ul-uart | reg \\+ interrupts | BSP mainline |\n| V3s | allwinner,sun8i-v3s-uart | reg \\+ interrupts | sunxi mainline |"}
````



```zhizhan-anchor
m05-check
```



```zhizhan-anchor
m05-check-t
```



## 5.5 probe 自检与错误码



“驱动没起来”几乎都能在 ` dmesg ` 里找到线索：匹配失败、资源缺失、deferred。把常见错误码对照好，能快速定位是“没匹配”还是“匹配了但依赖没到”。



表 5.4 probe 相关现象与错误码



| 现象/返回 | 含义 | 处理 |
| --- | --- | --- |
| dmesg 无该驱动记录 | compatible 未匹配 | 核对 dts 与 of\_match\_table |
| -EPROBE\_DEFER | 依赖（clk/regulator）未就绪 | 确保依赖先加载，内核会自动重试 |
| -ENODEV | 找不到设备/节点 | 检查 dts 节点 |
| -EBUSY | 资源被占用 | 检查是否存在重复实例 |
| unbound | 有设备无匹配驱动 | 补驱动或修 compatible |



probe\_check.sh 节选Shell

 

```text
ls /sys/bus/platform/drivers/            # 驱动是否注册
ls /sys/bus/platform/devices/ | grep my  # 设备是否创建
dmesg | grep -i myplat                    # probe 日志/错误码
cat /sys/bus/platform/devices/*/driver     # 绑定到哪个驱动
```

platform 设备/驱动/绑定的三层自检



```zhizhan-anchor
m05-pitfalls
```



```zhizhan-anchor
m05-pitfalls-t
```



## 5.6 常见误区与排障



失败路径与排障




- **compatible 不匹配** ：probe 永不调用。

- **probe 失败不回滚** ：资源泄漏且后续重试冲突。

- **依赖未就绪直接失败** ：应返回 -EPROBE\_DEFER 而不是 -EINVAL。

- **remove 与 probe 不对称** ：卸载后状态残留。



◆ 自测 · Module 05（先答再看）




1. probe 里拿不到时钟，应该返回什么错误？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"若是“暂时还没注册”的依赖，返回 ` -EPROBE_DEFER ` 让内核稍后重试；若是真正的配置错误，返回相应错误码并不注册。"}
   ```

2. 为什么设备树改了 compatible 后驱动就不 probe 了？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"匹配靠 compatible 字符串。字符串不一致，of\\_match\\_table 匹配失败，内核不会调用该驱动的 probe。"}
   ```

3. devm\_\* 资源托管的好处是什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"probe 里申请的资源由内核在 remove/失败时自动释放，减少“回滚遗漏”导致的内存/映射泄漏。但仍要保证 remove 与 probe 的逻辑对称。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：把你驱动的资源申请改为 devm\_\* 托管，并核对 probe 失败路径与 remove 的对称性。



核对与延伸：[Linux 内核文档 · Driver API](https://www.kernel.org/doc/html/latest/driver-api/index.html) · [Linux 内核文档 · Runtime PM](https://www.kernel.org/doc/html/latest/power/runtime_pm.html)

 

动手练习



运行 ` labs/host_platform.c `：验证匹配 probe、依赖未就绪 deferred、无匹配 unbound、重试后 probe。



**检查结果：** dev-a 直接 probe；dev-b 先 deferred、重试后 probe→drvB；dev-c unbound；最终 probed=2、unbound=1。

 

迁移练习：把本章的“能写出用 of\_match\_table 匹配、probe 失败返回 -EPROBE\_DEFER 并重试的 platform driver。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 05 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b10-m05","criterion":"dev-a 直接 probe；dev-b 先 deferred、重试后 probe→drvB；dev-c unbound；最终 probed=2、unbound=1。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b10-guide)
