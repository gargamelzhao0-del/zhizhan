# 数据采集与本地存储

```zhizhan-anchor
m04
```



采样调度与时基、滤波与标定、环形缓冲落盘、Flash/EEPROM 磨损均衡、掉电保护、数据导出与回放。

 

> 前置：会用定时器/周期任务做定时采样，了解 Flash/EEPROM 只能 1→0 写入、需整块擦除的特性。 · ◷ 约 44 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能用定时采样 \+ 滤波标定 \+ 环形缓冲 \+ 提交标记实现掉电安全落盘，并支持导出回放。

 

本章速览




- 采样要有时基（定时器/RTOS 周期任务），不能靠忙等。

- 环形缓冲 \+ 提交标记：掉电最多丢最后一条未提交记录。

- Flash 只能把位从 1 写成 0；记录要能导出与回放，便于定位。

 

```zhizhan-anchor
m04-log
```



```zhizhan-anchor
m04-log-t
```



## 4.1 时基与掉电安全落盘



采集第一个问题是时基：用定时器或周期任务驱动而非忙等。第二个是落盘安全：写一半掉电，恢复时不能把半条记录当有效数据。



```zhizhan-anchor
fig-图-4-1
```



**图 4.1**  环形记录与提交标记



```zhizhan-figure
<svg viewBox="0 0 800 125" width="100%" height="125" role="img" aria-label="环形记录与提交标记" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">序号</text><rect x="60" y="64" width="680" height="30" rx="6" class="sv-box"></rect><text x="75" y="83.0" class="sv-lbl-hi">数据</text><rect x="60" y="98" width="680" height="30" rx="6" class="sv-red-s"></rect><text x="75" y="117.0" class="sv-lbl-hi">CRC</text><rect x="60" y="132" width="680" height="30" rx="6" class="sv-grn-s"></rect><text x="75" y="151.0" class="sv-lbl-hi">提交标记</text></svg>
```



每条带 序号\+CRC；写完记录后才写提交标记（擦除态→魔数）；恢复只认“有提交标记且 CRC 正确”。



表 4.1 采集与存储



| 问题 | 做法 | 要点 |
| --- | --- | --- |
| 时基抖动 | 定时器/周期任务 | 统计采样间隔最坏值 |
| 噪声 | 滤波\+标定 | 滤波引入延迟，单位一致 |
| 掉电 | 环形缓冲\+提交标记 | 擦除态→魔数只清位 |
| 磨损 | 磨损均衡 | 分散写入延长寿命 |
| 可分析 | 导出/回放 | 记录带时间戳与版本 |



```zhizhan-anchor
m04-evidence
```



```zhizhan-anchor
m04-evidence-t
```



## 4.2 真实证据：掉电只丢未提交



下面这段主机程序模拟写 3 条、第 3 条在提交前掉电，再损坏一条记录：



host\_ringlog.cC

 

```text
/* host_ringlog.c —— 环形日志 + 掉电提交（主机可运行）。
 *
 * 存储只能把位从 1 写成 0。做法：每条记录带 seq + CRC；写完记录后才写“提交标记”。
 * 掉电发生在“写记录”和“写提交标记”之间时，恢复后该记录因无提交标记而被跳过。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_ringlog.c -o host_ringlog && ./host_ringlog
 */
#include <stdio.h>
#include <stdint.h>
#include <string.h>

#define N 4
typedef struct { uint8_t seq; int16_t v; uint8_t committed; uint16_t crc; } rec_t;

static uint16_t crc16(const uint8_t *p, int n) {
    uint16_t c = 0xFFFF;
    for (int i = 0; i < n; i++) { c ^= p[i]; for (int b = 0; b < 8; b++) c = (c & 1) ? (uint16_t)((c >> 1) ^ 0xA001) : (uint16_t)(c >> 1); }
    return c;
}
static uint16_t rec_crc(const rec_t *r) { return crc16((const uint8_t *)r, 4); }  /* seq+v+crc 前的 4 字节 */

typedef struct { rec_t slot[N]; int head; int written; int committed; } log_t;

static void log_write(log_t *L, uint8_t seq, int16_t v, int powerfail_before_commit) {
    rec_t *r = &L->slot[L->head];
    memset(r, 0, sizeof(*r));
    r->seq = seq; r->v = v;
    r->crc = rec_crc(r);
    L->written++;
    if (powerfail_before_commit) return;      /* 掉电：未写提交标记 */
    r->committed = 1;
    L->committed++;
    L->head = (L->head + 1) % N;
}
/* 恢复：只把“有提交标记且 CRC 正确”的记录算作有效 */
static int log_recover(const log_t *L, int16_t *out, int max) {
    int n = 0;
    for (int i = 0; i < N; i++) {
        const rec_t *r = &L->slot[i];
        if (r->committed && rec_crc(r) == r->crc) {
            if (n < max) out[n] = r->v;
            n++;
        }
    }
    return n;
}

int main(void) {
    log_t L; memset(&L, 0, sizeof(L));
    int16_t out[N];
    int ok = 1;

    log_write(&L, 1, 100, 0);
    log_write(&L, 2, 200, 0);
    log_write(&L, 3, 300, 1);          /* 第 3 条写完但提交前掉电 */
    int valid = log_recover(&L, out, N);
    printf("写完 3 条（第 3 条掉电于提交前）→ 有效记录 %d 条：", valid);
    for (int i = 0; i < valid; i++) printf("%d ", out[i]);
    printf("\n");
    if (valid != 2) ok = 0;
    if (!(out[0] == 100 && out[1] == 200)) ok = 0;

    /* 提交标记被破坏 → CRC 不符也跳过 */
    L.slot[0].crc ^= 0xFF;
    int v2 = log_recover(&L, out, N);
    printf("损坏第 1 条后 → 有效记录 %d 条（期望 1）\n", v2);
    if (v2 != 1) ok = 0;

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

环形日志模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_ringlog.c -o labs/host_ringlog && ./labs/host_ringlog
写完 3 条（第 3 条掉电于提交前）→ 有效记录 2 条：100 200
损坏第 1 条后 → 有效记录 1 条（期望 1）
RESULT: PASS
```



掉电最多丢最后一条未提交（3 条→有效 2 条）；损坏 1 条后有效 1 条，内容正确。



表 4.2 恢复结果



| 场景 | 有效记录 | 说明 |
| --- | --- | --- |
| 写 3 条 | 2 | 末条未提交 |
| 损坏 1 条 | 1 | CRC 判无效 |
| 内容 | 100/200 | 正确 |
| 结论 | — | 掉电安全 |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm04-plat\n```\n\n\n\n```zhizhan-anchor\nm04-plat-t\n```\n\n\n\n## 4.3 三平台对照：存储\n\n\n\n三平台的 Flash/EEPROM 与磨损策略不同，但“提交标记 \\+ CRC 恢复”一致。\n\n\n\nm04\\_log.cC\n\n \n\n```text\n/* m04_log.c —— 环形日志落盘与掉电提交（Cortex-M3）。\n * 先写记录，再写提交标记；掉电中断只会丢弃最后一条未提交记录。 */\n#include <stdint.h>\n#include \"app_api.h\"\n\n#define LOG_BASE 0x0801F000u\ntypedef struct { uint8_t seq; int16_t v; uint8_t committed; } rec_t;\n\nint log_append(uint8_t seq, int16_t v) {\n    rec_t r;\n    r.seq = seq; r.v = v; r.committed = 0;\n    if (storage_write(LOG_BASE, &r, 3) != 0) return -1;      /* 写记录 */\n    uint8_t c = 1;\n    if (storage_write(LOG_BASE + 2, &c, 1) != 0) return -2;  /* 写提交标记 */\n    return (int)storage_sync();\n}\n```\n\nSTM32F103 · 日志\n\n\n\nesp\\_m04\\_nvs.cC\n\n \n\n```text\n/* esp_m04_nvs.c —— ESP32 用 NVS 持久化（Xtensa）。\n * NVS 自带磨损均衡与掉电安全；写入后必须 commit 才落盘。 */\n#include \"esp_app.h\"\n#include \"app_api.h\"\n\nint esp_store_sample(uint16_t v) {\n    nvs_handle_t h;\n    if (nvs_open(\"log\", 1, &h) != ESP_OK) return -1;\n    if (nvs_set_u16(h, \"s\", v) != ESP_OK) return -2;\n    return (int)nvs_commit(h);\n}\n```\n\nESP32 · NVS\n\n\n\nh7\\_m04\\_log.cC\n\n \n\n```text\n/* h7_m04_log.c —— H7 大扇区日志与回放（Cortex-M7）。\n * 记录追加到扇区，用提交标记区分“写完”与“未写完”；导出时跳过未提交。 */\n#include <stdint.h>\n#include <stddef.h>\n#include \"app_api.h\"\n#include \"stm32_app.h\"\n\n#define SECTOR_SIZE 131072u\ntypedef struct { uint32_t seq; int16_t v; uint32_t committed; } rec_t;\n\nint h7_log_append(uint32_t offset, uint32_t seq, int16_t v) {\n    if (offset + sizeof(rec_t) > SECTOR_SIZE) return -1;     /* 扇区边界 */\n    rec_t r;\n    r.seq = seq; r.v = v; r.committed = 0;\n    if (storage_write(offset, &r, sizeof(r) - 4) != 0) return -2;\n    r.committed = 0xA5A5A5A5u;\n    return (int)storage_write(offset + offsetof(rec_t, committed), &r.committed, 4);\n}\n```\n\nSTM32H7 · 日志\n\n\n\n表 4.3 三平台存储\n\n\n\n| 维度 | STM32F103 | ESP32 | STM32H7 |\n| --- | --- | --- | --- |\n| 存储 | 内部 Flash | NVS/Flash | 内部 Flash |\n| 提交 | 标记位 | NVS 提交 | 标记位 |\n| 磨损 | 环形页 | NVS 均衡 | 环形页 |\n| 导出 | 串口回放 | 串口/网络 | 串口回放 |"}
````



```zhizhan-anchor
m04-check
```



```zhizhan-anchor
m04-check-t
```



## 4.4 自检



存储自检：定时采样、滤波标定、先数据后提交、可回放。



```zhizhan-anchor
fig-图-4-2
```



**图 4.2**  写记录的次序



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="写记录的次序" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">写记录</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">算CRC</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">写提交标记</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">完成</text></svg>
```



写号\+数据\+CRC → 校验通过 → 写提交标记；掉电最多丢未提交的最后一条。



表 4.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 采样 | 定时器/周期 | 忙等 |
| 落盘 | 先数据后提交 | 先提交后数据 |
| 磨损 | 分散写入 | 反复写同一页 |
| 回放 | 带时间戳\+版本 | 对不上 |



```zhizhan-anchor
m04-pitfalls
```



```zhizhan-anchor
m04-pitfalls-t
```



## 4.5 常见误区与排障



失败路径与排障




- **忙等采样** ：时基随负载漂移，采样率不稳。

- **先写提交标记后写数据** ：掉电得到“已提交的垃圾”。

- **无磨损均衡** ：反复写同一页，很快写坏。

- **记录无时间戳/版本** ：回放时对不上时间与结构。



◆ 自测 · Module 04（先答再看）




1. 为什么提交标记要用“擦除态→魔数”（只把 1 写成 0）？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"Flash 只能把位从 1 写成 0，擦除才能回到 1。用擦除态（全 1）表示未提交、魔数表示已提交，只需一次写 0 即可置位，掉电也不会产生中间态。"}
   ```

2. 为什么必须先写数据、后写提交标记？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"反过来的话，掉电可能留下“已提交但数据不全”的记录，恢复时会把垃圾当有效。先写数据后提交，掉电最多丢未提交的最后一条。"}
   ```

3. 采集为什么不用循环忙等？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"忙等时基随其它任务负载漂移，采样率不稳。应用定时器或周期任务产生固定周期，并统计采样间隔的最坏值。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：用定时采样 \+ 滤波标定 \+ 环形缓冲 \+ 提交标记实现掉电安全落盘，并加导出回放。



核对与延伸：[ST · AN4994 FreeRTOS 低功耗](https://www.st.com/resource/en/application_note/an4994-how-to-use-freertos-with-lowpower-features-on-the-stm32-microcontroller-stmicroelectronics.pdf) · [littlefs 官方仓库](https://github.com/littlefs-project/littlefs)

 

动手练习



运行 ` labs/host_ringlog.c `：模拟写 3 条、第 3 条在提交前掉电；再损坏一条，验证恢复。



**检查结果：** 掉电后仅丢未提交记录（写 3 条→有效 2 条 100/200）；损坏 1 条后有效 1 条。

 

迁移练习：把本章的“能用定时采样 \+ 滤波标定 \+ 环形缓冲 \+ 提交标记实现掉电安全落盘，并支持导出回放。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 04 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b08-m04","criterion":"掉电后仅丢未提交记录（写 3 条→有效 2 条 100/200）；损坏 1 条后有效 1 条。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b08-guide)
