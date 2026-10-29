# 升级确认与版本兼容深化

```zhizhan-anchor
m13
```



镜像/参数/协议版本；升级确认；迁移；回退边界。

 

> 前置：了解固件镜像/参数/协议三种版本的差异与 [OTA](term:ota) 确认回滚流程（M08/M12）。 · ◷ 约 42 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能分别管理镜像/参数/协议三种版本，设定“不降级、先迁移”的准入与明确的回退边界。

 

本章速览




- 镜像/参数/协议三个版本要分开管理。

- 升级准入：不降级、跨大版本先迁移。

- 确认失败或自检不通过就回滚；回退边界要写清楚。

 

```zhizhan-anchor
m13-version
```



```zhizhan-anchor
m13-version-t
```



## 13.1 三种版本各自演进



一个能长期维护的设备要同时管住三种版本：镜像版本（固件）、参数版本（配置结构）、协议版本（对外接口）。它们各自独立演进，又必须互相兼容。



```zhizhan-anchor
fig-图-13-1
```



**图 13.1**  三种版本与兼容



```zhizhan-figure
<svg viewBox="0 0 800 130" width="100%" height="130" role="img" aria-label="三种版本与兼容" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-grn-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">镜像版本</text><rect x="60" y="64" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="83.0" class="sv-lbl-hi">参数版本</text><rect x="60" y="98" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="117.0" class="sv-lbl-hi">协议版本</text></svg>
```



镜像（签名\+不降级）| 参数（带默认值的迁移）| 协议（版本协商向后兼容）。



表 13.1 三种版本



| 版本 | 变更示例 | 兼容策略 |
| --- | --- | --- |
| 镜像 | 新增功能/修 bug | 签名 \+ 准入：不降级 |
| 参数 | 新增/重排配置项 | 带默认值的迁移函数 |
| 协议 | 新增字段/改变量纲 | 版本协商 \+ 向后兼容 |



```zhizhan-anchor
m13-evidence
```



```zhizhan-anchor
m13-evidence-t
```



## 13.2 真实证据：版本/回滚代码（交叉编译）



三平台的版本管理与回滚代码均通过交叉编译；结合 host\_ota.c 的真实运行（未确认可退回）：



m13\_version.cC

 

```text
/* m13_version.c —— 镜像/协议版本比较与升级准入（Cortex-M3）。
 * 版本用整型打包（如高 16 位主版本、低 16 位次版本）便于比较；
 * 升级准入规则：不降级、跨度过大先迁移。 */
#include <stdint.h>
#include "comm_api.h"

int ver_cmp(uint32_t a, uint32_t b) { return a < b ? -1 : (a > b ? 1 : 0); }

/* 返回 1=允许，0=不升（同版或更旧），-1=需先迁移到最低兼容版本 */
int upgrade_allowed(uint32_t cur, uint32_t img, uint32_t min_from) {
    if (img <= cur) return 0;          /* 不允许降级/同版 */
    if (cur < min_from) return -1;     /* 跨度过大：先做参数迁移 */
    return 1;
}
```

STM32F103 · 版本管理



真实运行



$



```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -Os -c labs/m13_version.c -o m13.o && arm-none-eabi-size m13.o
   text    data     bss     dec     hex filename
     38       0       0      38      26 m13.o
```



真实工具输出：m13\_version.c（M3）text=38 B；esp\_m13\_rollback.c text=46 B；h7\_m13\_rollback.c text=96 B；未确认固件可退回见 host\_ota.c。



表 13.2 版本管理规模



| 文件 | 平台 | text | 看点 |
| --- | --- | --- | --- |
| m13\_version.c | M3 | 38 B | 三版本 |
| esp\_m13\_rollback.c | Xtensa | 46 B | 回滚 |
| h7\_m13\_rollback.c | M7 | 96 B | 回退边界 |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm13-plat\n```\n\n\n\n```zhizhan-anchor\nm13-plat-t\n```\n\n\n\n## 13.3 三平台对照：版本与回滚\n\n\n\n三平台的版本存储与回滚机制不同，但“三版本\\+准入\\+回退边界”一致。\n\n\n\nm13\\_version.cC\n\n \n\n```text\n/* m13_version.c —— 镜像/协议版本比较与升级准入（Cortex-M3）。\n * 版本用整型打包（如高 16 位主版本、低 16 位次版本）便于比较；\n * 升级准入规则：不降级、跨度过大先迁移。 */\n#include <stdint.h>\n#include \"comm_api.h\"\n\nint ver_cmp(uint32_t a, uint32_t b) { return a < b ? -1 : (a > b ? 1 : 0); }\n\n/* 返回 1=允许，0=不升（同版或更旧），-1=需先迁移到最低兼容版本 */\nint upgrade_allowed(uint32_t cur, uint32_t img, uint32_t min_from) {\n    if (img <= cur) return 0;          /* 不允许降级/同版 */\n    if (cur < min_from) return -1;     /* 跨度过大：先做参数迁移 */\n    return 1;\n}\n```\n\nSTM32F103 · 版本\n\n\n\nesp\\_m13\\_rollback.cC\n\n \n\n```text\n/* esp_m13_rollback.c —— ESP32 升级确认与回滚（Xtensa）。\n * 新固件首次启动后必须在自检通过时调用 confirm，否则复位时自动回滚。 */\n#include \"esp_comm.h\"\n\nvoid esp_confirm_ok(void) { (void)esp_ota_mark_app_valid_cancel_rollback(); }\nvoid esp_rollback_now(void) { (void)esp_ota_mark_app_invalid_rollback_and_reboot(); }\n\n/* 启动自检：联网、外设、参数版本都正常才算“确认” */\nint esp_selfcheck(int net_ok, int periph_ok, int cfg_ok) {\n    if (net_ok && periph_ok && cfg_ok) { esp_confirm_ok(); return 0; }\n    return -1;      /* 不确认：留给下次复位回滚 */\n}\n```\n\nESP32 · 回滚\n\n\n\nh7\\_m13\\_rollback.cC\n\n \n\n```text\n/* h7_m13_rollback.c —— H7 双 Bank 升级确认（Cortex-M7）。\n * “待确认”标志与启动计数存在备份域；连续启动失败超过阈值就换回原 Bank。 */\n#include <stdint.h>\n#include \"comm_api.h\"\n\n#define BKP_FLAG  (*(volatile uint32_t *)0x40006C04u)   /* 备份寄存器示例地址 */\n#define BKP_TRIES (*(volatile uint32_t *)0x40006C08u)\n\nvoid h7_mark_pending(void) { BKP_FLAG = 0xA5A5A5A5u; BKP_TRIES = 0u; }\nvoid h7_mark_confirmed(void) { BKP_FLAG = 0u; }\n\n/* 启动时决策：返回 1=继续运行并计数，0=正常运行（已确认），-1=回滚 */\nint h7_boot_decision(int selfcheck_ok) {\n    if (BKP_FLAG != 0xA5A5A5A5u) return 0;              /* 没有待确认标志 */\n    if (selfcheck_ok) { h7_mark_confirmed(); return 0; }\n    BKP_TRIES++;\n    if (BKP_TRIES > 3u) return -1;                      /* 连续失败：回滚 */\n    return 1;\n}\n```\n\nSTM32H7 · 回退\n\n\n\n表 13.3 三平台版本与回滚\n\n\n\n| 维度 | STM32F103 | ESP32 | STM32H7 |\n| --- | --- | --- | --- |\n| 镜像版本 | 标志区 | 分区表 | 标志区/双 Bank |\n| 参数版本 | 结构\\+迁移 | NVS\\+迁移 | 结构\\+迁移 |\n| 协议版本 | 协商字段 | 协商字段 | 协商字段 |\n| 回滚 | 标志驱动 | 原生回滚 | 标志驱动 |"}
````



```zhizhan-anchor
m13-check
```



```zhizhan-anchor
m13-check-t
```



## 13.4 自检



版本自检：分清三版本、准入不降级、先迁移、明确回退边界。



```zhizhan-anchor
fig-图-13-2
```



**图 13.2**  升级准入与确认



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="升级准入与确认" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="88.0" y="66" text-anchor="middle" class="sv-lbl-hi">准入校验</text><path d="M158,69 H174" class="sv-arrow"></path><rect x="176" y="44" width="136" height="50" rx="7" class="sv-cyn-s"></rect><text x="244.0" y="66" text-anchor="middle" class="sv-lbl-hi">切换</text><path d="M314,69 H330" class="sv-arrow"></path><rect x="332" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="400.0" y="66" text-anchor="middle" class="sv-lbl-hi">自检</text><path d="M470,69 H486" class="sv-arrow"></path><rect x="488" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="556.0" y="66" text-anchor="middle" class="sv-lbl-hi">确认</text><path d="M626,69 H642" class="sv-arrow"></path><rect x="644" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="712.0" y="66" text-anchor="middle" class="sv-lbl-hi">失败回滚</text></svg>
```



校验镜像\+版本准入（不降级/跨大版本先迁移）→ 切换 → 自检 → 确认；失败则回滚。



表 13.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 版本 | 分清三种 | 混为一谈 |
| 准入 | 不降级 | 允许降级 |
| 迁移 | 带默认值 | 无迁移 |
| 回退 | 写清边界 | 承诺不可逆的回滚 |



```zhizhan-anchor
m13-pitfalls
```



```zhizhan-anchor
m13-pitfalls-t
```



## 13.5 常见误区与排障



失败路径与排障




- **只升镜像不管参数** ：新固件按新结构读旧配置，读出垃圾。

- **允许降级** ：旧固件读不懂新参数/新协议，直接把设备弄坏。

- **无回退边界** ：迁移不可逆却承诺“可回滚”，回滚后状态错乱。

- **确认时机太晚** ：跑了几小时才确认，期间坏固件一直在现场运行。



◆ 自测 · Module 13（先答再看）




1. 为什么协议要“向后兼容”，而镜像往往“不允许降级”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"协议对端（网关/云）可能版本不一，需兼容旧客户端；而固件降级常伴随不可逆的参数迁移与安全补丁回退，允许降级会引入更大风险，通常只允许受控回滚到已知版本。"}
   ```

2. 参数版本变更为什么要配“带默认值的迁移函数”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"新固件可能读到旧结构或旧固件读到新结构；迁移函数按默认值补齐缺失字段、转换含义，使配置在版本升级时仍然可用。"}
   ```

3. “回退边界”为什么必须写清楚？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"有些迁移不可逆（如参数结构升级后旧固件读不懂新参数）。若不写清哪些能回、哪些不能，回滚后状态错乱，反而更危险。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你的设备写一张“镜像/参数/协议”三版本表，注明准入规则（不降级、跨大版本先迁移）与明确的回退边界。



核对与延伸：[MCUboot 设计文档](https://docs.mcuboot.com/design.html) · [MQTT 规范 (OASIS)](https://mqtt.org/mqtt-specification/)

 

动手练习



编译三个平台的版本/回滚代码；为你的设备写一张“三版本 \+ 准入 \+ 回退边界”说明。



**检查结果：** 三种版本分别可查；准入规则明确（镜像不降级、跨大版本先迁移）；确认失败可回滚且回退边界有据。

 

迁移练习：把本章的“能分别管理镜像/参数/协议三种版本，设定“不降级、先迁移”的准入与明确的回退边界。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 13 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b07-m13","criterion":"三种版本分别可查；准入规则明确（镜像不降级、跨大版本先迁移）；确认失败可回滚且回退边界有据。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b07-guide)
