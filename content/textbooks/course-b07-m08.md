# OTA 全链路

```zhizhan-anchor
m08
```



传输方式、分块与断点续传、签名与验签、掉电保护与回滚、A/B 双区、差分升级。

 

> 前置：了解 Flash 分区/双 Bank 与固件镜像 CRC 校验的基本概念。 · ◷ 约 44 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能设计“下载分块→写备用区→校验→切换→（自检通过）确认”的 [OTA](term:ota) 流程，保证掉电与篡改都可回滚。

 

本章速览




- 写备用区 → 校验 → 切换 → 确认；任一步断电都要能启动。

- 分块要能断点续传；整镜像 CRC \+ 版本防降级。

- 确认前可回滚；ESP32/双 Bank 各有原生机制。

 

```zhizhan-anchor
m08-ota
```



```zhizhan-anchor
m08-ota-t
```



## 8.1 可失败、可回滚的 OTA



OTA 的目标是“可失败、可回滚”：升级中任何一步断电或出错，设备都必须还能启动并正常工作。



```zhizhan-anchor
fig-图-8-1
```



**图 8.1**  OTA 标准流程



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="OTA 标准流程" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="88.0" y="66" text-anchor="middle" class="sv-lbl-hi">下载分块</text><path d="M158,69 H174" class="sv-arrow"></path><rect x="176" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="244.0" y="66" text-anchor="middle" class="sv-lbl-hi">写备用区</text><path d="M314,69 H330" class="sv-arrow"></path><rect x="332" y="44" width="136" height="50" rx="7" class="sv-cyn-s"></rect><text x="400.0" y="66" text-anchor="middle" class="sv-lbl-hi">校验</text><path d="M470,69 H486" class="sv-arrow"></path><rect x="488" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="556.0" y="66" text-anchor="middle" class="sv-lbl-hi">切换</text><path d="M626,69 H642" class="sv-arrow"></path><rect x="644" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="712.0" y="66" text-anchor="middle" class="sv-lbl-hi">确认</text></svg>
```



下载分块 → 写备用区 → 校验 → 切换 → 新固件自检通过后确认；任一步失败则继续跑旧固件。



表 8.1 OTA 失败点



| 失败点 | 现象 | 正确行为 |
| --- | --- | --- |
| 下载中断 | 备用区不完整 | 校验失败→继续旧固件 |
| 写入掉电 | 备用区半包 | 不切换；可断点续传 |
| 镜像损坏 | CRC 不匹配 | 拒绝切换 |
| 新固件启动失败 | 反复重启 | 未确认→回滚旧固件 |



```zhizhan-anchor
m08-evidence
```



```zhizhan-anchor
m08-evidence-t
```



## 8.2 真实证据：四种情形的判定



下面这段主机程序模拟正常升级、掉电、被篡改、未确认四种情形：



host\_ota.cC

 

```text
/* host_ota.c —— OTA 分块写入 + 校验 + 掉电回滚模型（主机可运行）。
 *
 * 双区模型：A 区运行当前固件，B 区接收新固件。规则：
 *   ① 只有“所有分块写完 + 整镜像 CRC 校验通过”才切换运行区；
 *   ② 中途掉电 → B 区不完整，校验失败 → 继续运行 A 区（回滚）；
 *   ③ 切换后若新固件未“确认”，下次仍可退回 A 区。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_ota.c -o host_ota && ./host_ota
 */
#include <stdio.h>
#include <stdint.h>
#include <string.h>

#define NCHUNK 4
#define CLEN 8

static uint16_t crc16(const uint8_t *p, int n) {
    uint16_t c = 0xFFFF;
    for (int i = 0; i < n; i++) {
        c ^= p[i];
        for (int b = 0; b < 8; b++) c = (c & 1) ? (uint16_t)((c >> 1) ^ 0xA001) : (uint16_t)(c >> 1);
    }
    return c;
}

/* 返回 1=已切换运行区，0=保持/回滚；*reason 记录原因 */
static int ota_run(const uint8_t img[NCHUNK][CLEN], int fail_after, uint16_t expected_crc,
                   int confirm, const char **reason) {
    uint8_t staging[NCHUNK][CLEN];
    int written = 0;
    memset(staging, 0, sizeof(staging));
    for (int i = 0; i < NCHUNK; i++) {
        if (i == fail_after) { *reason = "掉电：分块未写完"; }
        if (fail_after >= 0 && i >= fail_after) break;
        memcpy(staging[i], img[i], CLEN);
        written++;
    }
    if (written != NCHUNK) return 0;                       /* 不完整 → 回滚 */
    uint16_t c = crc16((const uint8_t *)staging, NCHUNK * CLEN);
    if (c != expected_crc) { *reason = "整镜像 CRC 不匹配"; return 0; }
    if (!confirm) { *reason = "已切换但未确认：下次可退回"; return 1; }
    *reason = "校验通过并确认：切换完成";
    return 1;
}

int main(void) {
    int ok = 1;
    uint8_t img[NCHUNK][CLEN];
    for (int i = 0; i < NCHUNK; i++)
        for (int j = 0; j < CLEN; j++) img[i][j] = (uint8_t)(i * CLEN + j);
    uint16_t good = crc16((const uint8_t *)img, NCHUNK * CLEN);

    const char *r;
    int a = ota_run(img, -1, good, 1, &r);
    printf("正常升级：结果=%s（%s）\n", a ? "切换" : "回滚", r);
    if (a != 1) ok = 0;

    int b = ota_run(img, 2, good, 1, &r);
    printf("第 2 块后掉电：结果=%s（%s）\n", b ? "切换" : "回滚", r);
    if (b != 0) ok = 0;

    int c = ota_run(img, -1, (uint16_t)(good ^ 0xFFFF), 1, &r);
    printf("镜像被篡改：结果=%s（%s）\n", c ? "切换" : "回滚", r);
    if (c != 0) ok = 0;

    int d = ota_run(img, -1, good, 0, &r);
    printf("校验通过但未确认：结果=%s（%s）\n", d ? "切换" : "回滚", r);
    if (d != 1) ok = 0;

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

OTA 状态机模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_ota.c -o labs/host_ota && ./labs/host_ota
正常升级：结果=切换（校验通过并确认：切换完成）
第 2 块后掉电：结果=回滚（掉电：分块未写完）
镜像被篡改：结果=回滚（整镜像 CRC 不匹配）
校验通过但未确认：结果=切换（已切换但未确认：下次可退回）
RESULT: PASS
```



只有全部写完\+整镜像 CRC 通过才切换；掉电与篡改都回滚；未确认的固件下次可退回。



表 8.2 OTA 判定



| 情形 | 结果 | 依据 |
| --- | --- | --- |
| 正常升级 | 切换 | 校验通过并确认 |
| 第 2 块掉电 | 回滚 | 分块未写完 |
| 镜像被篡改 | 回滚 | 整镜像 CRC 不匹配 |
| 未确认 | 切换 | 下次可退回 |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm08-plat\n```\n\n\n\n```zhizhan-anchor\nm08-plat-t\n```\n\n\n\n## 8.3 三平台对照：OTA\n\n\n\n三平台的 OTA 机制不同（ESP-IDF 原生 OTA、STM32 双 Bank、自定义 Boot），但“备用区\\+校验\\+确认”一致。\n\n\n\nm08\\_ota.cC\n\n \n\n```text\n/* m08_ota.c —— 串口分块 OTA（Cortex-M3）。\n * 边收边写；任一步失败或超时都保留旧固件；全部写完并校验通过才切换。 */\n#include <stdint.h>\n#include <stddef.h>\n#include \"comm_api.h\"\n\nint ota_over_uart(uint32_t total, uint32_t crc) {\n    uint8_t buf[256];\n    if (ota_begin(total, crc) != 0) return -1;\n    uint32_t got = 0;\n    while (got < total) {\n        int n = uart_recv(buf, sizeof(buf), 5000u);\n        if (n <= 0) return -2;                      /* 超时：回滚 */\n        if (ota_write(buf, (size_t)n) != 0) return -3;\n        got += (uint32_t)n;\n    }\n    return ota_finish();                            /* 校验 + 切换 */\n}\n```\n\nSTM32F103 · OTA\n\n\n\nesp\\_m08\\_ota.cC\n\n \n\n```text\n/* esp_m08_ota.c —— ESP32 原生 OTA（Xtensa）。\n * 写备用分区 → 校验 → 设置启动分区；启动后未调用 mark_valid 会触发回滚。 */\n#include \"esp_comm.h\"\n\nint esp_ota_apply(const uint8_t *img, size_t n) {\n    esp_ota_handle_t h;\n    const esp_partition_t *p = esp_ota_get_next_update_partition(0);\n    if (!p) return -1;\n    if (esp_ota_begin(p, n, &h) != ESP_OK) return -2;\n    if (esp_ota_write(h, img, n) != ESP_OK) return -3;\n    if (esp_ota_end(h) != ESP_OK) return -4;\n    if (esp_ota_set_boot_partition(p) != ESP_OK) return -5;\n    return 0;\n}\n\nvoid esp_ota_confirm(void) { (void)esp_ota_mark_app_valid_cancel_rollback(); }\nvoid esp_ota_reject(void)  { (void)esp_ota_mark_app_invalid_rollback_and_reboot(); }\n```\n\nESP32 · OTA\n\n\n\nh7\\_m08\\_ota.cC\n\n \n\n```text\n/* h7_m08_ota.c —— 双 Bank OTA（STM32H7 / Cortex-M7）。\n * 新固件写入备用 Bank，校验通过后做 Bank Swap；失败则不交换，继续跑原 Bank。 */\n#include <stdint.h>\n#include <stddef.h>\n#include \"comm_api.h\"\n\nint h7_ota_dualbank(const uint8_t *img, size_t n, uint32_t image_crc) {\n    if (ota_begin((uint32_t)n, image_crc) != 0) return -1;\n    if (ota_write(img, n) != 0) return -2;\n    return ota_finish();        /* 校验通过后交换 Bank，并记录“待确认”标志 */\n}\n\nint h7_ota_confirm(void)  { return 0; }             /* 运行正常：清除待确认标志 */\nint h7_ota_rollback(void) { return ota_rollback(); }/* 启动超时：换回原 Bank */\n```\n\nSTM32H7 · OTA/双 Bank\n\n\n\n表 8.3 三平台 OTA\n\n\n\n| 维度 | STM32F103 | ESP32 | STM32H7 |\n| --- | --- | --- | --- |\n| 分区 | 手工 | 分区表 | 双 Bank |\n| 切换 | 写备用区\\+跳转 | OTA 分区切换 | Bank 交换 |\n| 校验 | CRC/签名 | 安全启动 | CRC/签名 |\n| 回滚 | 标志驱动 | 原生回滚 | 标志驱动 |"}
````



```zhizhan-anchor
m08-check
```



```zhizhan-anchor
m08-check-t
```



## 8.4 自检



OTA 自检：写备用区、验签、断点续传、未确认可回滚。



```zhizhan-anchor
fig-图-8-2
```



**图 8.2**  四种情形结果（真实判定）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="四种情形结果（真实判定）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">掉电</text><rect x="150" y="26" width="2" height="18" rx="4" class="sv-red-s"></rect><text x="160" y="43" class="sv-lbl-hi">0(切换=1/回滚=0)</text><text x="12" y="67" class="sv-lbl">篡改</text><rect x="150" y="50" width="2" height="18" rx="4" class="sv-red-s"></rect><text x="160" y="67" class="sv-lbl-hi">0(切换=1/回滚=0)</text><text x="12" y="91" class="sv-lbl">正常</text><rect x="150" y="74" width="600" height="18" rx="4" class="sv-grn-s"></rect><text x="758" y="91" class="sv-lbl-hi">1(切换=1/回滚=0)</text><text x="12" y="115" class="sv-lbl">未确认</text><rect x="150" y="98" width="600" height="18" rx="4" class="sv-amb-s"></rect><text x="758" y="115" class="sv-lbl-hi">1(切换=1/回滚=0)</text></svg>
```



掉电与篡改→回滚；正常与未确认→切换（未确认下次可退回）。



表 8.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 写入 | 备用区 | 覆盖运行区 |
| 校验 | CRC\+签名 | 只 CRC |
| 续传 | 分块重试 | 全量重传 |
| 确认 | 自检后落定 | 切换后不确认 |



```zhizhan-anchor
m08-pitfalls
```



```zhizhan-anchor
m08-pitfalls-t
```



## 8.5 常见误区与排障



失败路径与排障




- **直接覆盖运行区** ：写一半掉电就没有可启动固件，必砖。

- **只校验不验签** ：攻击者可推 CRC 正确的恶意固件。

- **无断点续传** ：大固件在弱网下反复重传，成功率低。

- **切换后不确认** ：坏固件“坐实”，失去回滚机会。



◆ 自测 · Module 08（先答再看）




1. 为什么“CRC 通过”不等于“固件安全可信”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"CRC 只保证数据未被误码破坏，任何人都能算出正确 CRC。防篡改/防伪造必须校验数字签名（或带密钥的 MAC），密钥留在可信存储。"}
   ```

2. 为什么回滚能力是 OTA 的最后一道保险？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"新固件可能因兼容/资源问题启动失败；未确认前保留旧固件并在自检失败时退回，才能避免设备变砖。"}
   ```

3. 断点续传解决什么问题？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"大固件在弱网下常下载中断；按块记录已收进度，重连后只补未收块，避免全量重传、提高成功率。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你设备实现 OTA：写备用区、分块续传、CRC\+签名校验、未确认可回滚，并写出掉电/篡改的处置表。



核对与延伸：[ESP-IDF · OTA 文档](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/system/ota.html) · [MCUboot 设计文档](https://docs.mcuboot.com/design.html)

 

动手练习



运行 ` labs/host_ota.c `：模拟正常升级、第 2 块后掉电、镜像被篡改、校验通过但未确认四种情形。



**检查结果：** 只有“全部写完 \+ 整镜像 CRC 通过”才切换；掉电与篡改都回滚；未确认的固件下次可退回。

 

迁移练习：把本章的“能设计“下载分块→写备用区→校验→切换→（自检通过）确认”的 OTA 流程，保证掉电与篡改都可回滚。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 08 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b07-m08","criterion":"只有“全部写完 + 整镜像 CRC 通过”才切换；掉电与篡改都回滚；未确认的固件下次可退回。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b07-guide)
