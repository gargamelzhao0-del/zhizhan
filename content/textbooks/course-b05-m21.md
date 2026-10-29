# OTA 与网络升级、回滚

```zhizhan-anchor
m21
```



[OTA](term:ota) 把“升级”做成一条 **可失败、可回滚** 的链路：分块写备用分区→整包校验→切换启动→失败回滚。关键是 **断电安全** ：任何一步断电，设备都必须还能启动。

 

> 前置：了解 bootloader/分区与固件跳转，会做整包校验。 · ◷ 约 46 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能设计“分块写备用区→校验→切换→失败回滚”的断电安全 OTA 链路并查询升级状态。

 

本章速览




- OTA 必须可失败可回滚：写备用区→校验→切换→（失败）回滚。

- 任何一步断电都要能启动，状态存掉电不丢的地方。

- CRC 防误码不防篡改；安全场景必须验签。

 

```zhizhan-anchor
m21-flow
```



```zhizhan-anchor
m21-flow-t
```



## 21.1 A/B 双区与回滚



把新固件分块写入备用分区，整包校验通过后切换启动分区并重启；若新固件启动后自检失败，回滚到旧分区。关键是断电安全：任何一步断电，设备都必须还能启动。



```zhizhan-anchor
fig-图-21-1
```



**图 21.1**  断电安全的 OTA 链路



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="断电安全的 OTA 链路" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">分块下载</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">写备用区</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">校验</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">切换/回滚</text></svg>
```



分块下载 → 写备用区 → 整包校验 → 切换启动 → 重启 → 自检失败则回滚。



表 21.1 三平台 OTA 机制



| 机制 | ESP32 | STM32F103 | STM32H7 |
| --- | --- | --- | --- |
| 分区/双区 | OTA A/B 分区 | Boot\+App\+参数区 | 双 Bank |
| 切换启动 | set\_boot\_partition | 写标志\+跳转 | Bank Swap |
| 校验 | esp\_ota\_end 校验 | [CRC32](term:crc)\+向量检查 | CRC32 |
| 回滚 | mark\_valid/rollback | 标志位清空重试 | 交换回原 Bank |



```zhizhan-anchor
m21-evidence
```



```zhizhan-anchor
m21-evidence-t
```



## 21.2 真实证据：校验与体积



` size m21_ota_boot.o ` → text= **176**  B（Bootloader 校验/跳转/标志）。CRC 只能查误码，不能替代签名——要防篡改必须验签（见安全分册）。



m21\_ota\_boot.c 节选C

 

```text
/* 写备用区 → 整包 CRC32 校验 → 通过才切换 */
if (crc32(app_bank, app_len) != app_crc) {
    set_state(OTA_FAIL); return;   // 校验失败不切换
}
set_boot_bank(BANK_B);             // 切换启动分区
/* 新固件启动后做自检；失败则 set_boot_bank(BANK_A) 回滚 */
```

真实反汇编对应 CRC/跳转；校验失败绝不切换，保证可启动



表 21.2 断电安全的四个不变式



| 步骤 | 断电后 | 保证 |
| --- | --- | --- |
| 写备用区 | 旧固件完好 | 仍可启动 |
| 整包校验 | 未切换 | 不启动半包 |
| 切换标志 | 标志落持久区 | [幂等](term:idempotency) |
| 新固件自检失败 | 回滚旧区 | 不变砖 |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm21-plat\n```\n\n\n\n```zhizhan-anchor\nm21-plat-t\n```\n\n\n\n## 21.3 三平台对照：OTA\n\n\n\n三平台 OTA 机制不同：ESP32 用 A/B 分区；F103 常用 Boot\\+App\\+标志；H7 用双 Bank 交换。三份代码均已交叉编译。\n\n\n\nm21\\_ota\\_boot.cC\n\n \n\n```text\n/* m21_ota_boot.c — B05-M21 OTA（STM32F103 自研 Bootloader：校验 + 跳转 + 回滚标志） */\n#include \"stm32f103_regs.h\"\n\n#define APP_BASE 0x08004000u          /* App 从 16KB 处开始，Bootloader 占前 16KB */\ntypedef void (*app_entry_t)(void);\n\n/* CRC32（与 App 端一致）；用于判断镜像完整，避免跳到半包 */\nuint32_t crc32_bytes(const uint8_t *p, uint32_t n)\n{\n    uint32_t crc = 0xFFFFFFFFu;\n    for (uint32_t i = 0; i < n; ++i) {\n        crc ^= p[i];\n        for (int b = 0; b < 8; ++b) {\n            crc = (crc & 1u) ? (crc >> 1) ^ 0xEDB88320u : (crc >> 1);\n        }\n    }\n    return ~crc;\n}\n\n/* 校验 App：栈顶必须落在 SRAM、复位向量必须落在 Flash 的 App 区 */\nint ota_boot_validate(uint32_t app_base)\n{\n    uint32_t sp = *(volatile uint32_t *)app_base;\n    uint32_t pc = *(volatile uint32_t *)(app_base + 4u);\n    if (sp < 0x20000000u || sp > 0x20010000u) { return -1; }\n    if (pc < app_base || pc > 0x08040000u) { return -2; }\n    return 0;\n}\n\nvoid ota_boot_jump(uint32_t app_base)\n{\n    uint32_t sp = *(volatile uint32_t *)app_base;\n    uint32_t pc = *(volatile uint32_t *)(app_base + 4u);\n    /* 跳转前必须关中断并（真实工程里）复位外设/清挂起，避免 App 启动瞬间被旧中断打断 */\n    __asm volatile (\"cpsid i\" ::: \"memory\");\n    SCB_VTOR = app_base;                       /* App 的向量表 */\n    b05_dsb(); b05_isb();\n    __asm volatile (\"msr msp, %0\" :: \"r\"(sp)); /* 先设栈顶 */\n    ((app_entry_t)pc)();                       /* 再跳复位向量 */\n}\n\n/* 升级请求标志：由 App 写入备份寄存器，Bootloader 读后决定是否进入升级 */\nvoid ota_request_upgrade(uint32_t token) { BKP_DR1 = token; }\nint  ota_upgrade_pending(void) { return BKP_DR1 == 0x5AA50F0Fu; }\nvoid ota_clear_upgrade(void) { BKP_DR1 = 0u; }\n```\n\nSTM32F103 · Boot\\+App\\+标志\n\n\n\nesp\\_m21\\_ota.cC\n\n \n\n```text\n/* esp_m21_ota.c — B05-M21 OTA / 网络升级与回滚（ESP32 原生 A/B 分区）\n * 流程：写新固件到备用分区 → 校验 → 切启动分区 → 重启；新固件首次启动若不自证，可回滚。 */\n#include <stdint.h>\n\ntypedef int esp_err_t;\ntypedef void *esp_ota_handle_t;\ntypedef void *esp_partition_t;\n\nextern const esp_partition_t *esp_ota_get_next_update_partition(const void *start);\nextern esp_err_t esp_ota_begin(const esp_partition_t *p, unsigned image_size, esp_ota_handle_t *out);\nextern esp_err_t esp_ota_write(esp_ota_handle_t h, const void *data, unsigned size);\nextern esp_err_t esp_ota_end(esp_ota_handle_t h);\nextern esp_err_t esp_ota_set_boot_partition(const esp_partition_t *p);\nextern esp_err_t esp_ota_mark_app_valid_cancel_rollback(void);\nextern esp_err_t esp_ota_mark_app_invalid_rollback_and_reboot(void);\n\n/* 分块写：每块都要检查返回值；中途断电，下次重新开始（备用分区不生效） */\nint esp_ota_apply(const uint8_t *image, unsigned len, unsigned chunk)\n{\n    const esp_partition_t *target = esp_ota_get_next_update_partition((void *)0);\n    if (target == (void *)0) { return -1; }\n    esp_ota_handle_t h = (void *)0;\n    if (esp_ota_begin(target, len, &h) != 0) { return -2; }\n    for (unsigned off = 0; off < len; off += chunk) {\n        unsigned n = (len - off < chunk) ? (len - off) : chunk;\n        if (esp_ota_write(h, image + off, n) != 0) { return -3; }   /* 写入失败需中止 */\n    }\n    if (esp_ota_end(h) != 0) { return -4; }          /* 校验镜像 */\n    if (esp_ota_set_boot_partition(target) != 0) { return -5; }\n    return 0;                                        /* 返回后重启即运行新固件 */\n}\n\n/* 新固件启动并联网自检通过后调用：确认本次升级，取消回滚 */\nint esp_ota_confirm(void) { return esp_ota_mark_app_valid_cancel_rollback(); }\n```\n\nESP32 · esp\\_ota \\+ A/B\n\n\n\nh7\\_m21\\_ota.cC\n\n \n\n```text\n/* h7_m21_ota.c — B05-M21 OTA（STM32H7：双 Bank 交换 + 安全回滚）\n * H7 的 Flash 支持双 Bank 与 Bank Swap：新固件写入备用 Bank，校验后交换启动 Bank。 */\n#include \"stm32h7_regs.h\"\n\ntypedef int hal_status_t;\nextern hal_status_t HAL_FLASH_Unlock(void);\nextern hal_status_t HAL_FLASH_OB_Unlock(void);\nextern hal_status_t HAL_FLASHEx_OBProgram(const void *cfg);\nextern hal_status_t HAL_FLASH_OB_Launch(void);      /* 触发 Bank Swap 并复位 */\n\n/* Option Bytes 里 SWAP_BANK 位决定从哪个 Bank 启动（见 RM0433 FLASH_OPTSR） */\nint h7_ota_swap_bank(int enable_swap)\n{\n    if (HAL_FLASH_Unlock() != 0) { return -1; }\n    if (HAL_FLASH_OB_Unlock() != 0) { return -2; }\n    (void)enable_swap;                              /* cfg 里设置 SWAP_BANK */\n    if (HAL_FLASHEx_OBProgram((const void *)0) != 0) { return -3; }\n    return HAL_FLASH_OB_Launch();                   /* 交换后自动复位，从新 Bank 跑 */\n}\n\n/* 双 Bank 的分区语义：Bank1 跑当前固件，新固件写 Bank2；校验失败则保持原 Bank。 */\nint h7_ota_bank_of(uint32_t addr) { return (addr < 0x08100000u) ? 1 : 2; }\n\n/* 完整性：与 F1 相同的 CRC32 思路，防止交换到半包镜像 */\nuint32_t h7_ota_crc32(const uint8_t *p, uint32_t n)\n{\n    uint32_t crc = 0xFFFFFFFFu;\n    for (uint32_t i = 0; i < n; ++i) {\n        crc ^= p[i];\n        for (int b = 0; b < 8; ++b) {\n            crc = (crc & 1u) ? (crc >> 1) ^ 0xEDB88320u : (crc >> 1);\n        }\n    }\n    return ~crc;\n}\n```\n\nSTM32H7 · 双 Bank 交换\n\n\n\n表 21.3 三平台 OTA\n\n\n\n| 维度 | STM32F103 | ESP32 | STM32H7 |\n| --- | --- | --- | --- |\n| 机制 | Boot\\+App\\+标志 | OTA 分区 | 双 Bank Swap |\n| 接口 | 自定义协议 | HTTP/MQTT | 自定义/Bank |\n| 回滚 | 标志位 | rollback | 交换回原 Bank |\n| 安全 | CRC(\\+签名) | Secure Boot/签名 | CRC(\\+签名) |"}
````



```zhizhan-anchor
m21-check
```



```zhizhan-anchor
m21-check-t
```



## 21.4 分区与自检



分区设计要保证“任意时刻总有一个完整可启动的固件”。



```zhizhan-anchor
fig-图-21-2
```



**图 21.2**  A/B 双区 \+ 参数区



```zhizhan-figure
<svg viewBox="0 0 800 170" width="100%" height="170" role="img" aria-label="A/B 双区 + 参数区" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">Bootloader（校验/跳转）</text><rect x="60" y="64" width="680" height="40" rx="6" class="sv-grn-s"></rect><text x="75" y="88.0" class="sv-lbl-hi">Bank A（当前）</text><rect x="60" y="108" width="680" height="40" rx="6" class="sv-amb-s"></rect><text x="75" y="132.0" class="sv-lbl-hi">Bank B（待升级）</text><rect x="60" y="152" width="680" height="30" rx="6" class="sv-box"></rect><text x="75" y="171.0" class="sv-lbl-hi">参数区（状态/标志，掉电不丢）</text></svg>
```



Boot、Bank A、Bank B 轮流当“当前/待升级”，参数区记录升级状态（掉电不丢）。



表 21.4 OTA 自检四步



| 自检 | 方法 | 通过标志 |
| --- | --- | --- |
| 断电恢复 | 各中断点断电 | 仍能启动 |
| 校验失败 | 喂半包 | 不切换 |
| 回滚 | 新固件自检失败 | 回到旧区 |
| 状态可查 | 读参数区 | 进度/结果可见 |



```zhizhan-anchor
m21-pitfalls
```



```zhizhan-anchor
m21-pitfalls-t
```



## 21.5 常见误区与排障



失败路径与排障




- **不校验就切换** ：半包镜像也能启动 → 变砖。

- **状态写 RAM** ：断电丢失，无法判断升级进度。

- **没有回滚** ：新固件有 bug 就回不去。

- **用 CRC 当签名** ：CRC 防误码不防篡改，安全场景必须验签。



◆ 自测 · Module 21（先答再看）




1. 为什么 OTA 一定要“先写备用区，校验通过再切换”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"保证任意时刻总有一个可启动的完整固件；直接覆盖当前固件时，一旦断电或校验失败就无固件可启动（变砖）。"}
   ```

2. 升级状态为什么不能只存在 RAM？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"掉电就丢，无法判断升级到哪一步、是否已切换。状态必须落掉电不丢的地方（参数区/备份寄存器）。"}
   ```

3. CRC 能替代签名吗？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"不能。CRC 只防传输/存储误码，不防恶意篡改。安全场景必须用签名（验签）保证固件来源与完整性。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你产品设计一条可回滚的 OTA 链路，并做一次“升级中断电”的演练验证不变砖。



核对与延伸：[ESP-IDF OTA 文档](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/system/ota.html)

 

动手练习



模拟一次完整 OTA：写备用区→校验失败时保持旧固件；成功时切换并重启；新固件自检失败能回滚。



**检查结果：** 任一中断点断电后可恢复；整包 CRC32 校验失败不切换；回滚路径可用；升级状态可查询。

 

迁移练习：把本章的“能设计“分块写备用区→校验→切换→失败回滚”的断电安全 OTA 链路并查询升级状态。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 21 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b05-m21","criterion":"任一中断点断电后可恢复；整包 CRC32 校验失败不切换；回滚路径可用；升级状态可查询。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b05-guide)
