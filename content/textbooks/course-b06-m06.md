# 内存管理

```zhizhan-anchor
m06
```



heap\_1..heap\_5 的差异；静态创建（xTaskCreateStatic）；内存池；ESP heap\_caps；M7 MPU 保护。

 

> 前置：了解任务栈与堆的概念，知道动态分配的时间不确定性问题。 · ◷ 约 42 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能用静态创建把栈与 TCB 放进 .bss，并用高水位校正栈大小、按内存能力分配 [DMA](term:dma) 缓冲。

 

本章速览




- 动态堆有碎片与不确定性；高可靠场景用静态创建（xTaskCreateStatic）。

- ESP32 用 heap\_caps 指定内存能力（DMA 可见）；M7 用 MPU 给栈/内核数据加保护。

- 栈大小按最坏调用链给，并用高水位持续校正。

 

```zhizhan-anchor
m06-heap
```



```zhizhan-anchor
m06-heap-t
```



## 6.1 堆实现与静态创建



动态内存的问题不是“能不能用”，而是碎片、时间不确定、耗尽。工程做法：任务栈/队列/事件组尽量静态创建，把运行期堆分配降到最低。



```zhizhan-anchor
fig-图-6-1
```



**图 6.1**  heap\_1..5 的取舍



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="heap_1..5 的取舍" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-grn-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">heap_1：只增不释放（安全）</text><rect x="60" y="64" width="680" height="30" rx="6" class="sv-red-s"></rect><text x="75" y="83.0" class="sv-lbl-hi">heap_2：最优匹配不合并（碎片）</text><rect x="60" y="98" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="117.0" class="sv-lbl-hi">heap_4：首次匹配+合并（常用）</text><rect x="60" y="132" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="151.0" class="sv-lbl-hi">heap_5：多内存区（外扩 SRAM）</text></svg>
```



heap\_1 只增不释放（最安全）；heap\_4 首次匹配\+相邻合并（最常用）；heap\_5 支持多内存区。



表 6.1 堆实现



| 堆实现 | 行为 | 适用/风险 |
| --- | --- | --- |
| heap\_1 | 只增不释放 | 安全；不支持删除任务 |
| heap\_2 | 最优匹配不合并 | 会产生碎片 |
| heap\_3 | 包一层 malloc/free | 依赖标准库 |
| heap\_4 | 首次匹配\+相邻合并 | 最常用 |
| heap\_5 | heap\_4 \+ 多内存区域 | 跨多块 RAM |



```zhizhan-anchor
m06-evidence
```



```zhizhan-anchor
m06-evidence-t
```



## 6.2 真实证据：静态栈进 .bss（交叉编译）



静态创建把栈与 TCB 放到 .bss，编译期确定、启动后零分配：



m06\_heap\_static.cC

 

```text
/* m06_heap_static.c —— 静态创建任务：不碰堆（Cortex-M3）。
 * 栈与 TCB 在编译期分配；启动后不再 malloc，适合高可靠/安全场景。 */
#include <stdint.h>
#include "rtos_api.h"

static StackType_t g_stack[256];
static StaticTask_t g_tcb;

static void worker(void *arg) {
    (void)arg;
    for (;;) { vTaskDelay(pdMS_TO_TICKS(100)); }
}

TaskHandle_t m06_create_static(void) {
    return xTaskCreateStatic(worker, "static", 256u, 0, 2u, g_stack, &g_tcb);
}
```

STM32F103 · 静态栈/TCB



真实运行



$



```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -Os -c labs/m06_heap_static.c -o m06.o && arm-none-eabi-size m06.o
   text    data     bss     dec     hex filename
     63       0    1028    1091     443 m06.o
```



真实交叉编译：bss=1028 B，其中 256 字×4=1024 B 即编译期栈；启动后不再调用分配器。



表 6.2 静态创建



| 量 | 值 | 说明 |
| --- | --- | --- |
| text | 63 B | 代码 |
| bss | 1028 B | 含 1024 B 静态栈 |
| 堆分配 | 0 | 编译期确定 |
| 校正 | 高水位 | 确认余量 |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm06-plat\n```\n\n\n\n```zhizhan-anchor\nm06-plat-t\n```\n\n\n\n## 6.3 三平台对照：内存/保护\n\n\n\nESP32 按内存能力分配（MALLOC\\_CAP\\_DMA），M7 可用 MPU 保护任务栈/内核数据。\n\n\n\nm06\\_heap\\_static.cC\n\n \n\n```text\n/* m06_heap_static.c —— 静态创建任务：不碰堆（Cortex-M3）。\n * 栈与 TCB 在编译期分配；启动后不再 malloc，适合高可靠/安全场景。 */\n#include <stdint.h>\n#include \"rtos_api.h\"\n\nstatic StackType_t g_stack[256];\nstatic StaticTask_t g_tcb;\n\nstatic void worker(void *arg) {\n    (void)arg;\n    for (;;) { vTaskDelay(pdMS_TO_TICKS(100)); }\n}\n\nTaskHandle_t m06_create_static(void) {\n    return xTaskCreateStatic(worker, \"static\", 256u, 0, 2u, g_stack, &g_tcb);\n}\n```\n\nSTM32F103 · 静态创建\n\n\n\nesp\\_m06\\_heap.cC\n\n \n\n```text\n/* esp_m06_heap.c —— 按能力分配内存（ESP32 / Xtensa）。\n * 默认堆在内部 DRAM；DMA 缓冲需要 MALLOC_CAP_DMA，才能被外设直接搬运。 */\n#include <stdint.h>\n#include \"esp_idf_api.h\"\n\nvoid *esp_alloc_dma(size_t n) {\n    return heap_caps_malloc(n, MALLOC_CAP_DMA | MALLOC_CAP_8BIT);\n}\n\nuint32_t esp_heap_free_dma(void) {\n    return heap_caps_get_free_size(MALLOC_CAP_DMA);\n}\n```\n\nESP32 · heap\\_caps\n\n\n\nh7\\_m06\\_mpu.cC\n\n \n\n```text\n/* h7_m06_mpu.c —— 用 MPU 给内核数据/任务栈加保护（STM32H7 / Cortex-M7）。\n * 越界写会触发 MemManage 异常，比“魔数检查”更及时。寄存器布局以 M7 为例（示意）。 */\n#include <stdint.h>\n#include \"rtos_cm.h\"\n\n#define MPU_CTRL (*(volatile uint32_t *)0xE000ED94u)\n#define MPU_RNR  (*(volatile uint32_t *)0xE000ED98u)\n#define MPU_RBAR (*(volatile uint32_t *)0xE000ED9Cu)\n#define MPU_RASR (*(volatile uint32_t *)0xE000EDA0u)\n\nvoid h7_mpu_guard_region(uint32_t base, uint32_t attr) {\n    MPU_RNR  = 0u;                 /* 选区域 0 */\n    MPU_RBAR = base & 0xFFFFFFE0u; /* 32 字节对齐基址 */\n    MPU_RASR = attr;               /* 由调用者给出大小/权限/使能位 */\n    MPU_CTRL = 0x5u;               /* ENABLE | PRIVDEFENA */\n    cm_dsb();\n    cm_isb();\n}\n```\n\nSTM32H7 · MPU 保护\n\n\n\n表 6.3 三平台内存\n\n\n\n| 维度 | STM32F103 | ESP32 | STM32H7 |\n| --- | --- | --- | --- |\n| 静态创建 | xTaskCreateStatic | xTaskCreateStatic | xTaskCreateStatic |\n| 能力堆 | — | MALLOC\\_CAP\\_DMA | — |\n| 保护 | — | — | MPU 区域 |\n| 校正 | 高水位 | 高水位 | 高水位 |"}
````



```zhizhan-anchor
m06-check
```



```zhizhan-anchor
m06-check-t
```



## 6.4 自检



内存自检：静态优先、栈按最坏链、DMA 用能力堆、有余量。



```zhizhan-anchor
fig-图-6-2
```



**图 6.2**  静态栈预算（真实值）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="静态栈预算（真实值）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">text</text><rect x="150" y="26" width="34" height="18" rx="4" class="sv-cyn-s"></rect><text x="192" y="43" class="sv-lbl-hi">63B</text><text x="12" y="67" class="sv-lbl">静态栈</text><rect x="150" y="50" width="559" height="18" rx="4" class="sv-grn-s"></rect><text x="717" y="67" class="sv-lbl-hi">1024B</text><text x="12" y="91" class="sv-lbl">其他 bss</text><rect x="150" y="74" width="2" height="18" rx="4" class="sv-box"></rect><text x="160" y="91" class="sv-lbl-hi">4B</text></svg>
```



静态栈 1024 B 进 .bss，text 仅 63 B；启动后零分配。



表 6.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 创建 | 静态优先 | 运行期分配 |
| 栈 | 最坏调用链 | 拍脑袋 |
| DMA | 能力堆 | 普通堆 |
| 余量 | 30% | 余量为 0 |



```zhizhan-anchor
m06-pitfalls
```



```zhizhan-anchor
m06-pitfalls-t
```



## 6.5 常见误区与排障



失败路径与排障




- **栈给太小** ：偶发跑飞，实为栈溢出。

- **运行期频繁 malloc/free** ：碎片累积，有总量却分配不出。

- **大缓冲放任务栈** ：撑大栈需求，耗尽 RAM。

- **DMA 缓冲用普通堆** ：不在 DMA 可访问范围，传输静默失败。



◆ 自测 · Module 06（先答再看）




1. 为什么安全相关产品倾向禁止运行期动态分配？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"动态分配时间不确定、可能失败，碎片让“最坏情况”无法证明。静态分配把资源在编译期定死，行为可预测可验证。"}
   ```

2. ESP32 分配 DMA 缓冲要注意什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"必须来自 MALLOC\\_CAP\\_DMA 的能力堆。普通 malloc 的地址可能不在 DMA 可访问范围，外设无法直接搬运，传输静默失败。"}
   ```

3. 栈大小怎么定、怎么校正？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"按最坏调用链估并留 30% 余量，然后用 uxTaskGetStackHighWaterMark() 读最小剩余来校正。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：把你任务栈/队列改为静态创建，用高水位校正栈，并按内存能力为 DMA 缓冲选堆。



核对与延伸：[FreeRTOS 内存管理 heap\_1..heap\_5](https://www.freertos.org/a00111.html) · [ESP-IDF · FreeRTOS (IDF) 与任务 API](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/system/freertos.html)

 

动手练习



编译 ` labs/m06_heap_static.c `（M3）与 ` labs/esp_m06_heap.c `（Xtensa），确认静态栈进 .bss。



**检查结果：** 静态版本无堆分配（text=63 B、bss=1028 B，其中 1024 B 即编译期栈）；DMA 缓冲来自正确的能力堆。

 

迁移练习：把本章的“能用静态创建把栈与 TCB 放进 .bss，并用高水位校正栈大小、按内存能力分配 DMA 缓冲。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 06 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b06-m06","criterion":"静态版本无堆分配（text=63 B、bss=1028 B，其中 1024 B 即编译期栈）；DMA 缓冲来自正确的能力堆。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b06-guide)
