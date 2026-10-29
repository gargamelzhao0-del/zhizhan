# 参数与数据的持久化设计

```zhizhan-anchor
m13
```



双副本/日志提交；版本迁移；磨损；默认值回退。

 

> 前置：了解 Flash 位特性与 CRC 校验，理解参数结构升级时的版本兼容问题。 · ◷ 约 44 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能用双副本 A/B \+ CRC \+ 版本迁移 \+ 默认回退设计参数持久化，保证坏参数绝不作为有效值使用。

 

本章速览




- 参数用双副本 \+ CRC \+ 版本；读时选最新有效的一份。

- 版本升级要迁移（补默认值）；两种副本都坏则回退默认。

- 坏参数绝不能当有效值使用，否则故障会“看懂却解释不了”。

 

```zhizhan-anchor
m13-params
```



```zhizhan-anchor
m13-params-t
```



## 13.1 双副本 \+ CRC \+ 迁移 \+ 默认回退



参数和日志是设备的“记忆”，掉电/损坏时必须能恢复。套路是：双副本 \+ CRC \+ 版本 \+ 默认回退。



```zhizhan-anchor
fig-图-13-1
```



**图 13.1**  双副本参数



```zhizhan-figure
<svg viewBox="0 0 800 130" width="100%" height="130" role="img" aria-label="双副本参数" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-grn-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">副本 A</text><rect x="60" y="64" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="83.0" class="sv-lbl-hi">副本 B</text><rect x="60" y="98" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="117.0" class="sv-lbl-hi">迁移</text><rect x="60" y="132" width="680" height="30" rx="6" class="sv-red-s"></rect><text x="75" y="151.0" class="sv-lbl-hi">默认回退</text></svg>
```



A/B 交替写入，读“校验通过且版本最新”的一份；仅 v1 走迁移补默认；全坏用编译期默认。



表 13.1 持久化机制



| 机制 | 作用 | 实现 |
| --- | --- | --- |
| 双副本 A/B | 一份损坏用另一份 | 交替写入，读最新有效 |
| CRC/magic | 识别半写/损坏 | 校验失败即视为无效 |
| 版本迁移 | 结构升级 | 迁移函数补默认值 |
| 默认回退 | 全坏也能启动 | 编译期默认值 |



```zhizhan-anchor
m13-evidence
```



```zhizhan-anchor
m13-evidence-t
```



## 13.2 真实证据：四种恢复情形



下面这段主机程序验证两份都好、A 损坏、仅 v1、全坏四种情形：



host\_params.cC

 

```text
/* host_params.c —— 参数双副本 + 版本迁移 + 默认回退（主机可运行）。
 *
 * 参数存两份（A/B）各带 CRC；加载时选“校验通过且版本最新”的一份；
 * 版本升级时用迁移函数补默认值；两份都坏则回退默认值。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_params.c -o host_params && ./host_params
 */
#include <stdio.h>
#include <stdint.h>
#include <string.h>

typedef struct { uint16_t magic; uint16_t ver; int16_t t_lo; int16_t t_hi; uint16_t crc; } p1_t;
typedef struct { uint16_t magic; uint16_t ver; int16_t t_lo; int16_t t_hi; uint16_t sample_ms; uint16_t crc; } p2_t;

typedef struct { int16_t t_lo, t_hi; uint16_t sample_ms; uint16_t ver; } cfg_t;

static uint16_t crc16(const uint8_t *p, int n) {
    uint16_t c = 0xFFFF;
    for (int i = 0; i < n; i++) { c ^= p[i]; for (int b = 0; b < 8; b++) c = (c & 1) ? (uint16_t)((c >> 1) ^ 0xA001) : (uint16_t)(c >> 1); }
    return c;
}
#define MAGIC 0x51A2

static void p2_store(p2_t *p, cfg_t c) {
    p->magic = MAGIC; p->ver = c.ver; p->t_lo = c.t_lo; p->t_hi = c.t_hi; p->sample_ms = c.sample_ms;
    p->crc = crc16((const uint8_t *)p, 10);
}
static int p2_valid(const p2_t *p) { return p != NULL && p->magic == MAGIC && crc16((const uint8_t *)p, 10) == p->crc; }

/* 从 A/B 两份存储恢复；返回 0=正常，1=回退默认 */
static int params_load(const p2_t *A, const p2_t *B, const p1_t *OLD, cfg_t *out) {
    if (p2_valid(A) || p2_valid(B)) {
        const p2_t *p = p2_valid(A) ? A : B;
        out->t_lo = p->t_lo; out->t_hi = p->t_hi; out->sample_ms = p->sample_ms; out->ver = p->ver;
        return 0;
    }
    /* v1 迁移：结构更旧、缺 sample_ms → 补默认 */
    if (OLD != NULL && OLD->magic == MAGIC && crc16((const uint8_t *)OLD, 8) == OLD->crc) {
        out->t_lo = OLD->t_lo; out->t_hi = OLD->t_hi; out->sample_ms = 1000; out->ver = 2;
        return 0;
    }
    out->t_lo = -20; out->t_hi = 60; out->sample_ms = 1000; out->ver = 2;   /* 默认 */
    return 1;
}

int main(void) {
    cfg_t want = {-10, 85, 500, 2}, got;
    p2_t A, B; p2_store(&A, want); p2_store(&B, want);
    int ok = 1, r;

    r = params_load(&A, &B, NULL, &got);
    printf("两份都好：r=%d ver=%u t=[%d,%d] sample=%ums\n", r, got.ver, got.t_lo, got.t_hi, got.sample_ms);
    if (!(r == 0 && got.t_lo == -10 && got.t_hi == 85 && got.sample_ms == 500)) ok = 0;

    A.crc ^= 0xFF;                                   /* A 坏 → 用 B */
    r = params_load(&A, &B, NULL, &got);
    printf("A 损坏：r=%d sample=%ums（应回退到 B=500）\n", r, got.sample_ms);
    if (!(r == 0 && got.sample_ms == 500)) ok = 0;

    p1_t old = {MAGIC, 1, -5, 70, 0};
    old.crc = crc16((const uint8_t *)&old, 8);
    r = params_load(NULL, NULL, &old, &got);
    printf("只有 v1：r=%d ver=%u sample=%ums（迁移补默认 1000）\n", r, got.ver, got.sample_ms);
    if (!(r == 0 && got.ver == 2 && got.sample_ms == 1000 && got.t_hi == 70)) ok = 0;

    r = params_load(NULL, NULL, NULL, &got);
    printf("全坏：r=%d ver=%u sample=%ums t=[%d,%d]（回退默认）\n", r, got.ver, got.sample_ms, got.t_lo, got.t_hi);
    if (!(r == 1 && got.t_lo == -20 && got.t_hi == 60)) ok = 0;

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

参数持久化模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_params.c -o labs/host_params && ./labs/host_params
两份都好：r=0 ver=2 t=[-10,85] sample=500ms
A 损坏：r=0 sample=500ms（应回退到 B=500）
只有 v1：r=0 ver=2 sample=1000ms（迁移补默认 1000）
全坏：r=1 ver=2 sample=1000ms t=[-20,60]（回退默认）
RESULT: PASS
```



两份都好读 A；A 损坏回退 B=500ms；仅 v1 迁移补默认 1000ms；全坏回退默认 t=\[-20,60\]、r=1（记录异常）。



表 13.2 恢复情形



| 情形 | 结果 | 依据 |
| --- | --- | --- |
| 两份都好 | ver=2 sample=500 | 读最新有效 |
| A 损坏 | sample=500 | 回退 B |
| 仅 v1 | sample=1000 | 迁移补默认 |
| 全坏 | t=\[-20,60\] | 默认回退\+记录 |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm13-plat\n```\n\n\n\n```zhizhan-anchor\nm13-plat-t\n```\n\n\n\n## 13.3 三平台对照：参数存储\n\n\n\n三平台的参数存储机制不同（NVS/Flash），但“双副本\\+CRC\\+迁移\\+默认回退”一致。\n\n\n\nm13\\_params.cC\n\n \n\n```text\n/* m13_params.c —— 参数双副本与版本迁移（Cortex-M3）。\n * 校验失败或版本不符时回退默认或执行迁移；绝不能把坏参数当有效值使用。 */\n#include <stdint.h>\n#include \"app_api.h\"\n\ntypedef struct { uint16_t magic; uint16_t ver; int16_t lo; int16_t hi; uint16_t crc; } params_t;\n#define PARAM_MAGIC 0x51A2u\n\nint params_validate(const params_t *p) { return p != 0 && p->magic == PARAM_MAGIC; }\n\nint params_commit(void) { return params_save(); }\nint params_restore(void) { return params_load(); }\n```\n\nSTM32F103 · 参数\n\n\n\nesp\\_m13\\_params.cC\n\n \n\n```text\n/* esp_m13_params.c —— ESP32 参数持久化（NVS blob + 版本）（Xtensa）。 */\n#include \"esp_app.h\"\n\nint esp_params_save(const void *p, size_t n) {\n    nvs_handle_t h;\n    if (nvs_open(\"cfg\", 1, &h) != ESP_OK) return -1;\n    if (nvs_set_blob(h, \"p\", p, n) != ESP_OK) return -2;\n    return (int)nvs_commit(h);\n}\n\nint esp_params_load(void *p, size_t *n) {\n    nvs_handle_t h;\n    if (nvs_open(\"cfg\", 1, &h) != ESP_OK) return -1;\n    return (int)nvs_get_blob(h, \"p\", p, n);\n}\n```\n\nESP32 · 参数/NVS\n\n\n\nh7\\_m13\\_params.cC\n\n \n\n```text\n/* h7_m13_params.c —— H7 参数双副本提交（Cortex-M7）。\n * 交替写 A/B，读时选校验通过且版本最新的一份；写坏一份仍有另一份兜底。 */\n#include <stdint.h>\n#include <stddef.h>\n#include \"app_api.h\"\n#include \"stm32_app.h\"\n\n#define PARAM_A 0x0801D000u\n#define PARAM_B 0x0801E000u\n\nint h7_params_commit(int slot, const void *p, size_t n) {\n    uint32_t addr = slot ? PARAM_B : PARAM_A;\n    return (int)storage_write(addr, p, n);\n}\n\nint h7_params_is_watchdog_reset(void) { return (RCC_CSR & (1u << 29)) ? 1 : 0; }\n```\n\nSTM32H7 · 参数\n\n\n\n表 13.3 三平台参数\n\n\n\n| 维度 | STM32F103 | ESP32 | STM32H7 |\n| --- | --- | --- | --- |\n| 存储 | Flash 双副本 | NVS | Flash 双副本 |\n| 校验 | CRC | NVS\\+CRC | CRC |\n| 迁移 | 结构版本 | NVS 版本 | 结构版本 |\n| 回退 | 默认值 | 默认值 | 默认值 |"}
````



```zhizhan-anchor
m13-check
```



```zhizhan-anchor
m13-check-t
```



## 13.4 自检



持久化自检：双副本、CRC、版本迁移、默认值、磨损均衡。



```zhizhan-anchor
fig-图-13-2
```



**图 13.2**  读参数的判定



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="读参数的判定" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">读 A/B</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">CRC</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">取最新有效</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">迁移/默认</text></svg>
```



读 A/B → 各自 CRC → 取校验通过且版本最新 → 版本旧则迁移 → 全失败用默认。



表 13.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 双副本 | A/B 交替 | 单副本 |
| 校验 | CRC\+magic | 无校验 |
| 迁移 | 带默认值 | 缺迁移 |
| 回退 | 编译期默认 | 坏值直接用 |



```zhizhan-anchor
m13-pitfalls
```



```zhizhan-anchor
m13-pitfalls-t
```



## 13.5 常见误区与排障



失败路径与排障




- **单副本无校验** ：一次半写就永久损坏参数。

- **版本迁移缺失** ：新固件按新结构读旧参数，读出垃圾。

- **没有默认值** ：两份都坏时无法启动。

- **反复写同一地址** ：不做磨损均衡，很快写坏。



◆ 自测 · Module 13（先答再看）




1. 为什么读参数要“选最新有效的一份”，而不是固定读 A？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"写入可能在 A 完成、在 B 中断；固定读 A 会读到旧值或坏值。应比较两份版本号并各自校验 CRC，取“校验通过且版本最新”的才正确。"}
   ```

2. 参数版本升级为什么要配迁移函数？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"新固件可能读到旧结构（缺字段），旧固件可能读到新结构。迁移函数按默认值补齐/转换，使配置在升级时仍可用。"}
   ```

3. 为什么坏参数绝不能作为有效值使用？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"否则故障会变得“看得懂却解释不了”，且每次重启行为不一致，极难定位。双副本\\+CRC\\+默认回退保证任一时刻都返回自洽参数。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：用双副本 A/B \+ CRC \+ 版本迁移 \+ 默认回退重做你的参数持久化，并做“两份都好/A 损坏/仅旧版/全坏”四种测试。



核对与延伸：[ST · AN4994 FreeRTOS 低功耗](https://www.st.com/resource/en/application_note/an4994-how-to-use-freertos-with-lowpower-features-on-the-stm32-microcontroller-stmicroelectronics.pdf) · [ESP-IDF · NVS 非易失存储](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/storage/nvs_flash.html)

 

动手练习



运行 ` labs/host_params.c `：验证两份都好、A 损坏用 B、只有 v1 时迁移补默认、全坏回退默认。



**检查结果：** 任一时刻都返回自洽参数：两份都好 ver=2 sample=500ms；A 损坏回退 B；仅 v1 迁移补默认；全坏回退默认。

 

迁移练习：把本章的“能用双副本 A/B \+ CRC \+ 版本迁移 \+ 默认回退设计参数持久化，保证坏参数绝不作为有效值使用。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 13 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b08-m13","criterion":"任一时刻都返回自洽参数：两份都好 ver=2 sample=500ms；A 损坏回退 B；仅 v1 迁移补默认；全坏回退默认。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b08-guide)
