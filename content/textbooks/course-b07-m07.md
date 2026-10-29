# Bootloader

```zhizhan-anchor
m07
```



分区设计（Boot/App/参数/备份）、跳转前的完整清理序列、App 链接脚本与向量表偏移、升级标志与完整性校验。

 

> 前置：了解 STM32 启动流程、中断向量表与链接脚本/分区的基本概念。 · ◷ 约 44 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能实现跳转前的完整清理序列（校验 MSP→关中断→重定位 VTOR→屏障→设 MSP→跳转）并校验镜像。

 

本章速览




- 跳转前：校验栈指针 → 关中断 → 重定位 VTOR → 设 MSP → 跳转。

- App 的链接脚本与向量表必须按分区偏移，否则中断跑飞。

- Bootloader 只做最少的事，把升级逻辑放到 App/独立流程。

 

```zhizhan-anchor
m07-boot
```



```zhizhan-anchor
m07-boot-t
```



## 7.1 分区与跳转序列



Bootloader 是上电先跑的一小段程序：决定“跑哪个固件”，并负责把控制权安全交给 App。它要尽量小、尽量稳。



```zhizhan-anchor
fig-图-7-1
```



**图 7.1**  Flash 分区



```zhizhan-figure
<svg viewBox="0 0 800 125" width="100%" height="125" role="img" aria-label="Flash 分区" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">Boot</text><rect x="60" y="64" width="680" height="30" rx="6" class="sv-grn-s"></rect><text x="75" y="83.0" class="sv-lbl-hi">App</text><rect x="60" y="98" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="117.0" class="sv-lbl-hi">参数/标志</text><rect x="60" y="132" width="680" height="30" rx="6" class="sv-red-s"></rect><text x="75" y="151.0" class="sv-lbl-hi">备份/A-B</text></svg>
```



Boot（只读）| App（链接=分区偏移）| 参数/标志（掉电不丢）| 备份/更新区（A/B）。



表 7.1 分区设计



| 分区 | 内容 | 要点 |
| --- | --- | --- |
| Boot | 引导与校验逻辑 | 小、可靠、只读 |
| App | 应用固件 | 链接地址=分区偏移 |
| 参数/标志 | 升级标志、版本、配置 | 掉电不丢 |
| 备份/更新区 | 待升级镜像 | 双 Bank 或 A/B |



```zhizhan-anchor
m07-evidence
```



```zhizhan-anchor
m07-evidence-t
```



## 7.2 真实证据：跳转前清理序列（交叉编译）



跳转前必须按固定顺序清理现场，否则 App 一进中断就“跑飞”：



m07\_bootloader.cC

 

```text
/* m07_bootloader.c —— 从 Bootloader 跳转到 App（Cortex-M3）。
 * 顺序关键：校验栈指针 → 关中断 → 重定位向量表(VTOR) → 屏障 → 设 MSP → 跳转。 */
#include <stdint.h>
#include "comm_api.h"
#include "rtos_cm.h"

#define APP_BASE 0x08008000u
typedef void (*app_entry_t)(void);

int jump_to_app(void) {
    uint32_t sp = *(volatile uint32_t *)APP_BASE;
    uint32_t pc = *(volatile uint32_t *)(APP_BASE + 4u);
    if ((sp & 0x2FFE0000u) != 0x20000000u) return -1;   /* 栈指针必须落在 SRAM */
    cm_set_primask(1u);                                 /* 关所有可屏蔽中断 */
    CM_VTOR = APP_BASE;                                 /* App 的向量表在 App 区开头 */
    cm_dsb();
    cm_isb();
    __asm volatile ("msr msp, %0" :: "r"(sp) :);        /* 切到 App 的栈 */
    ((app_entry_t)pc)();                                /* 跳转，不返回 */
    return 0;
}
```

STM32F103 · Bootloader 跳转



真实运行



$



```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -Os -c labs/m07_bootloader.c -o m07.o && arm-none-eabi-size m07.o
   text    data     bss     dec     hex filename
     64       0       0      64      40 m07.o
```



真实交叉编译：m07\_bootloader.c（M3）text=64 B；h7\_m07\_boot.c（M7）跳转前额外关 I/D-Cache，text=50 B。



表 7.2 跳转序列



| 步骤 | 动作 | 原因 |
| --- | --- | --- |
| ① | 校验栈顶在 SRAM | 拒绝非法镜像 |
| ② | 关中断 | 避免旧向量表处理中断 |
| ③ | 重定位 VTOR | App 用新向量表 |
| ④ | DSB/ISB 屏障 | 确保写入生效 |
| ⑤ | 设 MSP=App 栈顶 | 用 App 的栈 |
| ⑥ | 取复位向量跳转 | 移交控制权 |



`````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm07-plat\n```\n\n\n\n```zhizhan-anchor\nm07-plat-t\n```\n\n\n\n## 7.3 三平台对照：Boot/OTA Boot\n\n\n\n三平台启动与分区机制不同，跳转前的“清场”原则一致。\n\n\n\n````zhizhan-details\n{\"title\":\"共用程序 · 按需展开完整代码\",\"body\":\"m07\\\\_bootloader.cC\\n\\n \\n\\n```text\\n/* m07_bootloader.c —— 从 Bootloader 跳转到 App（Cortex-M3）。\\n * 顺序关键：校验栈指针 → 关中断 → 重定位向量表(VTOR) → 屏障 → 设 MSP → 跳转。 */\\n#include <stdint.h>\\n#include \\\"comm_api.h\\\"\\n#include \\\"rtos_cm.h\\\"\\n\\n#define APP_BASE 0x08008000u\\ntypedef void (*app_entry_t)(void);\\n\\nint jump_to_app(void) {\\n    uint32_t sp = *(volatile uint32_t *)APP_BASE;\\n    uint32_t pc = *(volatile uint32_t *)(APP_BASE + 4u);\\n    if ((sp & 0x2FFE0000u) != 0x20000000u) return -1;   /* 栈指针必须落在 SRAM */\\n    cm_set_primask(1u);                                 /* 关所有可屏蔽中断 */\\n    CM_VTOR = APP_BASE;                                 /* App 的向量表在 App 区开头 */\\n    cm_dsb();\\n    cm_isb();\\n    __asm volatile (\\\"msr msp, %0\\\" :: \\\"r\\\"(sp) :);        /* 切到 App 的栈 */\\n    ((app_entry_t)pc)();                                /* 跳转，不返回 */\\n    return 0;\\n}\\n```\\n\\nSTM32F103 · 跳转\"}\n````\n\n\n\nesp\\_m07\\_ota\\_boot.cC\n\n \n\n```text\n/* esp_m07_ota_boot.c —— 选择下一次启动分区（ESP32 / Xtensa）。\n * ESP32 无传统 Bootloader 跳转代码：用分区表 + esp_ota_set_boot_partition。 */\n#include \"esp_comm.h\"\n\nint esp_boot_set_next(void) {\n    const esp_partition_t *next = esp_ota_get_next_update_partition(0);\n    if (!next) return -1;\n    return (int)esp_ota_set_boot_partition(next);\n}\n```\n\nESP32 · OTA boot\n\n\n\nh7\\_m07\\_boot.cC\n\n \n\n```text\n/* h7_m07_boot.c —— H7 跳转到 App（Cortex-M7）。\n * 除向量表/栈外，还要在跳转前关闭 I/D-Cache，避免与 App 的 cache 配置冲突。 */\n#include <stdint.h>\n#include \"comm_api.h\"\n#include \"rtos_cm.h\"\n\n#define SCB_CCR (*(volatile uint32_t *)0xE000ED14u)\n\nvoid h7_jump_to_app(uint32_t base) {\n    uint32_t sp = *(volatile uint32_t *)base;\n    uint32_t pc = *(volatile uint32_t *)(base + 4u);\n    cm_set_primask(1u);                                 /* 关中断 */\n    SCB_CCR &= ~((1u << 16) | (1u << 17));              /* 关 D-Cache / I-Cache */\n    CM_VTOR = base;                                     /* 重定位向量表 */\n    cm_dsb();\n    cm_isb();\n    __asm volatile (\"msr msp, %0\" :: \"r\"(sp) :);\n    ((void (*)(void))pc)();                             /* 跳转，不返回 */\n}\n```\n\nSTM32H7 · 跳转\\+Cache\n\n\n\n表 7.3 三平台 Boot\n\n\n\n| 维度 | STM32F103 | ESP32 | STM32H7 |\n| --- | --- | --- | --- |\n| 分区 | Flash 手工划分 | 分区表 | Flash 手工/双 Bank |\n| 向量表 | SCB-\\>VTOR | bootloader 管理 | SCB-\\>VTOR |\n| 跳转 | 设 MSP\\+跳转 | OTA 分区切换 | 设 MSP\\+跳转 |\n| 额外 | — | — | 关 I/D-Cache |"}
`````



```zhizhan-anchor
m07-check
```



```zhizhan-anchor
m07-check-t
```



## 7.4 自检



Boot 自检：分区对齐、校验栈顶、清场顺序、App 向量偏移、镜像校验。



```zhizhan-anchor
fig-图-7-2
```



**图 7.2**  安全跳转流程



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="安全跳转流程" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="88.0" y="66" text-anchor="middle" class="sv-lbl-hi">校验栈顶</text><path d="M158,69 H174" class="sv-arrow"></path><rect x="176" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="244.0" y="66" text-anchor="middle" class="sv-lbl-hi">关中断</text><path d="M314,69 H330" class="sv-arrow"></path><rect x="332" y="44" width="136" height="50" rx="7" class="sv-cyn-s"></rect><text x="400.0" y="66" text-anchor="middle" class="sv-lbl-hi">重定位VTOR</text><path d="M470,69 H486" class="sv-arrow"></path><rect x="488" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="556.0" y="66" text-anchor="middle" class="sv-lbl-hi">屏障/设MSP</text><path d="M626,69 H642" class="sv-arrow"></path><rect x="644" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="712.0" y="66" text-anchor="middle" class="sv-lbl-hi">跳转</text></svg>
```



校验栈顶 → 关中断 → 重定位 VTOR → 屏障 → 设 MSP → 跳转；任一步失败则不跳转。



表 7.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 分区 | 地址对齐 | App 地址非偏移 |
| 校验 | 栈顶在 SRAM | 不校验 |
| 顺序 | 先关中断 | 边跳边收中断 |
| Cache | M7 关 I/D-Cache | 忘关 |



```zhizhan-anchor
m07-pitfalls
```



```zhizhan-anchor
m07-pitfalls-t
```



## 7.5 常见误区与排障



失败路径与排障




- **忘记重定位 VTOR** ：App 中断仍指向 Boot 向量表，一进中断就崩。

- **没关中断就跳** ：跳转瞬间来中断，用旧向量表处理，跑飞。

- **App 链接地址非分区偏移** ：生成“能编译但跑不起来”的固件。

- **不校验镜像** ：闪存空洞/半包固件被直接跳转，变砖。



◆ 自测 · Module 07（先答再看）




1. 跳转前为什么必须把 MSP 设为 App 的栈顶？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"App 使用自己的栈空间（由它向量表第 0 项给出）。若仍用 Boot 的栈，App 一上电就可能覆盖 Boot 数据或越界。"}
   ```

2. 为什么跳转前必须关中断？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"跳转瞬间若来中断，会按旧向量表（还在 Boot 处）处理，导致跑飞。先关中断、重定位 VTOR 后再交给 App。"}
   ```

3. App 链接地址为什么要设成分区偏移？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"否则生成的向量表与代码地址与 Boot 的跳转目标不一致，中断向量错位，一进中断就跑飞。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你的设备定分区分界，实现“校验栈顶→关中断→重定位 VTOR→屏障→设 MSP→跳转”并加镜像校验。



核对与延伸：[MCUboot 设计文档](https://docs.mcuboot.com/design.html) · [ST · STM32 系统存储器 Bootloader (AN2606)](https://www.st.com/resource/en/application_note/cd00167594.pdf)

 

动手练习



编译 ` labs/m07_bootloader.c `（M3）、` labs/esp_m07_ota_boot.c `（Xtensa）、` labs/h7_m07_boot.c `（M7）。



**检查结果：** 跳转前完成关中断→重定位 VTOR→DSB/ISB→设 MSP 顺序；栈指针校验能拒绝非法镜像；App 向量表按分区偏移。

 

迁移练习：把本章的“能实现跳转前的完整清理序列（校验 MSP→关中断→重定位 VTOR→屏障→设 MSP→跳转）并校验镜像。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 07 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b07-m07","criterion":"跳转前完成关中断→重定位 VTOR→DSB/ISB→设 MSP 顺序；栈指针校验能拒绝非法镜像；App 向量表按分区偏移。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b07-guide)
