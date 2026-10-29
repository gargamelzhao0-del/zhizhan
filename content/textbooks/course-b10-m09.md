# 常见子系统速览

```zhizhan-anchor
m09
```



内核把同类设备抽成 **子系统** ：input（输入）、leds（灯）、IIO（传感器）、hwmon（监控）、gpio（引脚）。驱动优先“接入已有子系统”而不是自造接口，才能被上层工具与框架复用。

 

> 前置：Module 05 platform 与 Module 07 总线驱动。 · ◷ 约 40 分钟 · ◈ 三平台驱动对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能判断器件该接入哪个子系统，并按子系统框架实现驱动的接入点。

 

本章速览




- 把同类设备注册进合适的子系统（IIO/input/hwmon/netdev），用户态才有标准接口。

- 注册流程：分配核心结构 → 填回调 → devm\_\*\_register。

- 不要自造 ioctl 绕过子系统。

 

```zhizhan-anchor
m09-frame
```



```zhizhan-anchor
m09-frame-t
```



## 9.1 为什么要接入子系统



同一个传感器，若每个驱动自造一套接口，用户态就要适配每家的“方言”。子系统提供 **标准接口 \+ 上层工具** ：输入事件走 input、灯走 leds、传感器走 IIO、监控走 hwmon。接入子系统 = 免费获得框架、工具与电源管理。



```zhizhan-anchor
fig-图-9-1
```



**图 9.1**  子系统的分层：框架 → 子系统 → 驱动



```zhizhan-figure
<svg viewBox="0 0 800 170" width="100%" height="170" role="img" aria-label="子系统的分层：框架 → 子系统 → 驱动" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-box"></rect><text x="75" y="49.0" class="sv-lbl-hi">内核框架（device model / bus）</text><rect x="60" y="64" width="680" height="48" rx="6" class="sv-cyn-s"></rect><text x="75" y="92.0" class="sv-lbl-hi">子系统：input / leds / IIO / hwmon / gpio</text><rect x="60" y="116" width="680" height="48" rx="6" class="sv-grn-s"></rect><text x="75" y="144.0" class="sv-lbl-hi">具体驱动（接入点实现）</text></svg>
```



最上层是内核框架（device model）；中间是各类子系统；最下是具体驱动。驱动只实现子系统的接入点，跨设备统一。



表 9.1 常见子系统与接入点



| 子系统 | 管什么 | 接入点 |
| --- | --- | --- |
| input | 键盘/按键/触摸 | input\_dev \+ 事件上报 |
| leds | LED | led\_classdev \+ brightness\_set |
| IIO | ADC/传感器 | iio\_dev \+ 通道/读原始值 |
| hwmon | 温度/电压/风扇 | hwmon 属性 |
| gpio | 通用引脚 | gpiod 描述符 |



leds\_gpio.dts 节选DTS

 

```text
// 用现成子系统驱动（leds-gpio）：设备树描述即可，无需自己写驱动
leds {
  compatible = "gpio-leds";
  led0 { gpios = <&gpio1 3 GPIO_ACTIVE_LOW>; label = "green"; };
};
// 用户态：echo 1 > /sys/class/leds/green/brightness
```

很多器件直接用现成子系统驱动 \+ 设备树，不必自己造轮子



```zhizhan-anchor
m09-evidence
```



```zhizhan-anchor
m09-evidence-t
```



## 9.2 真实证据：platform 绑定模型（子系统接入的基础）



所有子系统驱动都建在 platform/bus 匹配与绑定之上。下面这段模型验证匹配、deferred、绑定关系：



````zhizhan-details
{"title":"共用程序 · 按需展开完整代码","body":"host\\_platform.cC\n\n \n\n```text\n/* host_platform.c —— platform driver 匹配与 deferred probe 模型（主机可运行）。\n *\n * 内核按 compatible 把设备与驱动绑定；若某设备的依赖尚未就绪，则返回 -EPROBE_DEFER，稍后重试。\n * 本程序验证：匹配成功 → probe；依赖未就绪 → deferred；无匹配 → unbound。\n *\n * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_platform.c -o host_platform && ./host_platform\n */\n#include <stdio.h>\n#include <string.h>\n\ntypedef struct { const char *compatible; const char *drv; } match_t;\nstatic const match_t MATCH[] = { {\"v,dev-a\", \"drvA\"}, {\"v,dev-b\", \"drvB\"} };\n#define NM (int)(sizeof(MATCH) / sizeof(MATCH[0]))\n\ntypedef struct { const char *name; const char *compat; const char *dep; int probed; int deferred; } dev_t;\nstatic dev_t DEV[] = {\n    {\"dev-b@0\", \"v,dev-b\", \"v,dev-a\", 0, 0},\n    {\"dev-a@1\", \"v,dev-a\", 0,         0, 0},\n    {\"dev-c@2\", \"v,dev-c\", 0,         0, 0},\n};\n#define NDV (int)(sizeof(DEV) / sizeof(DEV[0]))\n\nstatic const char *drv_for(const char *c) { for (int i = 0; i < NM; i++) if (strcmp(MATCH[i].compatible, c) == 0) return MATCH[i].drv; return 0; }\nstatic int dep_ready(const char *dep) { if (!dep) return 1; for (int i = 0; i < NDV; i++) if (strcmp(DEV[i].compat, dep) == 0) return DEV[i].probed; return 0; }\n\nint main(void) {\n    int ok = 1;\n    /* 第一遍：dev-b 的依赖 dev-a 尚未 probe → deferred */\n    for (int i = 0; i < NDV; i++) {\n        const char *d = drv_for(DEV[i].compat);\n        if (!d) { printf(\"%-8s unbound（无匹配驱动）\\n\", DEV[i].name); continue; }\n        if (!dep_ready(DEV[i].dep)) { DEV[i].deferred = 1; printf(\"%-8s deferred（依赖 %s 未就绪）\\n\", DEV[i].name, DEV[i].dep); continue; }\n        DEV[i].probed = 1; printf(\"%-8s probe → %s\\n\", DEV[i].name, d);\n    }\n    if (DEV[1].probed != 1) ok = 0;      /* dev-a 已 probe */\n    if (DEV[0].probed != 0 || DEV[0].deferred != 1) ok = 0;\n\n    /* 第二遍：重试 deferred */\n    printf(\"-- 重试 deferred --\\n\");\n    for (int i = 0; i < NDV; i++)\n        if (DEV[i].deferred && dep_ready(DEV[i].dep)) { DEV[i].probed = 1; printf(\"%-8s probe → %s\\n\", DEV[i].name, drv_for(DEV[i].compat)); }\n    if (DEV[0].probed != 1) ok = 0;\n\n    printf(\"最终：probed=%d unbound=1\\n\", DEV[0].probed + DEV[1].probed);\n    printf(\"\\n%s\\n\", ok ? \"RESULT: PASS\" : \"RESULT: FAIL\");\n    return ok ? 0 : 1;\n}\n```\n\nplatform 匹配与绑定模型（主机 gcc 真实编译运行）"}
````



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



子系统接入点是在 probe 里实现的；前提是 platform/bus 完成匹配与绑定。



```zhizhan-anchor
fig-图-9-2
```



**图 9.2**  从器件到子系统接口



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="从器件到子系统接口" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">器件</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">匹配/绑定</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">注册子系统对象</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">标准用户接口</text></svg>
```



器件（dts 节点）→ 匹配驱动 → probe 里注册子系统对象（如 input\_dev/led\_classdev/iio\_dev）→ 用户态通过标准接口访问。



```zhizhan-anchor
m09-choose
```



```zhizhan-anchor
m09-choose-t
```



## 9.3 选哪个子系统



判断口径：先看器件“本质提供什么能力”。按键/触屏 → input；指示灯 → leds；模拟量/传感器 → IIO；温度/电压监控 → hwmon。选错子系统，上层工具与生态就用不上。



表 9.2 器件 → 子系统选择



| 器件 | 应接入 | 用户态接口 |
| --- | --- | --- |
| 按键/GPIO 中断 | input | /dev/input/event\* |
| LED | leds | /sys/class/leds/\* |
| ADC/温湿度传感器 | IIO | /sys/bus/iio/... |
| 风扇/温度监控 | hwmon | /sys/class/hwmon/\* |
| 裸 GPIO 控制 | gpio（chardev） | /dev/gpiochip\* |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm09-routes\n```\n\n\n\n```zhizhan-anchor\nm09-routes-t\n```\n\n\n\n## 9.4 三条内核路线对照：子系统示例\n\n\n\n三条路线的子系统驱动一致（如 leds-gpio、IIO 框架），差异在底层控制器与 SoC 节点。\n\n\n\n表 9.3 三条路线的子系统用法\n\n\n\n| 内核路线 | LED | 传感器 | 说明 |\n| --- | --- | --- | --- |\n| STM32MP1 | leds-gpio | IIO \\+ stm32-adc | mainline |\n| i.MX6ULL | leds-gpio | IIO/输入 | BSP mainline |\n| V3s | leds-gpio | IIO | sunxi mainline |"}
````



```zhizhan-anchor
m09-check
```



```zhizhan-anchor
m09-check-t
```



## 9.5 子系统自检



接入子系统后，用标准接口验证“设备是否真的进了框架”：



表 9.4 子系统接入自检



| 子系统 | 自检命令 | 通过标志 |
| --- | --- | --- |
| input | cat /proc/bus/input/devices | 出现设备与事件号 |
| leds | ls /sys/class/leds/ | 出现 led 名 |
| IIO | ls /sys/bus/iio/devices/ | 出现 iio:deviceN |
| hwmon | ls /sys/class/hwmon/ | 出现 hwmonN |



subsys\_ls.sh 节选Shell

 

```text
ls /sys/class/leds/                     # LED 是否注册
cat /sys/bus/iio/devices/iio:device0/name   # IIO 设备名
evtest /dev/input/event3                 # 输入事件是否上报
sensors                                   # hwmon 是否被工具识别
```

用上层工具确认设备进入了对应子系统



```zhizhan-anchor
m09-pitfalls
```



```zhizhan-anchor
m09-pitfalls-t
```



## 9.6 常见误区与排障



失败路径与排障




- **自造接口而不接入子系统** ：上层工具无法复用。

- **选错子系统** ：语义不符，用户态难以使用。

- **注册子系统对象不检查返回值** ：成功假象，实际未注册。

- **忽略子系统的电源管理约定** ：挂起/恢复行为异常。



◆ 自测 · Module 09（先答再看）




1. 为什么驱动优先“接入子系统”而不是自造接口？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"子系统提供标准接口、上层工具与电源管理，接入即复用；自造接口让用户态适配每家的“方言”，也无法被通用工具/框架识别。"}
   ```

2. 一个温湿度传感器应该接入哪个子系统？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"IIO（工业 I/O）。它面向 ADC/传感器，提供通道化读原始值/缩放值，用户态经 /sys/bus/iio 访问。"}
   ```

3. 接入子系统对象（如 input\_dev）后，为什么必须检查注册返回值？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"注册可能失败（资源/依赖问题）。不检查会造成“看起来注册了、实际没进框架”的假象，用户态永远收不到设备。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你项目里的一个器件选择正确的子系统，并按其框架实现接入点（而非自造 ioctl）。



核对与延伸：[Linux 内核文档 · Driver API](https://www.kernel.org/doc/html/latest/driver-api/index.html) · [Linux 内核文档 · IIO](https://www.kernel.org/doc/html/latest/driver-api/iio/index.html)

 

动手练习



读 ` labs/host_platform.c ` 的匹配/绑定模型，对照子系统（如 leds-gpio/IIO）的接入方式。



**检查结果：** 能说明 input/leds/IIO 各自的接入点（注册回调/属性/通道），并知道优先复用子系统而非自造接口。

 

迁移练习：把本章的“能判断器件该接入哪个子系统，并按子系统框架实现驱动的接入点。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 09 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b10-m09","criterion":"能说明 input/leds/IIO 各自的接入点（注册回调/属性/通道），并知道优先复用子系统而非自造接口。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b10-guide)
