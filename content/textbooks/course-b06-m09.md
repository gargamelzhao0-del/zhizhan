# RT-Thread 与 Zephyr 对照

```zhizhan-anchor
m09
```



设备驱动模型、Kconfig、设备树、shell/msh、包管理；三者的选型矩阵。

 

> 前置：已掌握 [FreeRTOS](term:rtos) 的任务/信号量/临界区，了解 Kconfig 与设备树等配置方式。 · ◷ 约 42 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能对照 FreeRTOS/RT-Thread/Zephyr 的 API 与优先级方向，并给出按生态与工具链的选型结论。

 

本章速览




- FreeRTOS / RT-Thread / Zephyr 语义相近，差别在配置方式与调试工具。

- RT-Thread 对象化 \+ msh；Zephyr 静态对象 \+ Kconfig/设备树；FreeRTOS 宏配置 \+ 动态创建。

- 选型看生态、认证、团队经验与工具链，不只看调度算法。

 

```zhizhan-anchor
m09-compare
```



```zhizhan-anchor
m09-compare-t
```



## 9.1 概念一一对应，差异在方向与工具



三款内核概念几乎一一对应；真正影响移植的是优先级方向、配置方式与调试工具。尤其注意：FreeRTOS 数值越大优先级越高，RT-Thread 与 Zephyr 数值越小越高。



```zhizhan-anchor
fig-图-9-1
```



**图 9.1**  三内核 API 对照



```zhizhan-figure
<svg viewBox="0 0 800 160" width="100%" height="160" role="img" aria-label="三内核 API 对照" preserveAspectRatio="xMidYMid meet"><text x="185" y="24" text-anchor="middle" class="sv-lbl-dim">FreeRTOS</text><text x="295" y="24" text-anchor="middle" class="sv-lbl-dim">RT-Thread</text><text x="405" y="24" text-anchor="middle" class="sv-lbl-dim">Zephyr</text><text x="12" y="50" class="sv-lbl">任务</text><rect x="158" y="38" width="94" height="22" rx="4" class="sv-cyn-s"></rect><text x="205" y="53" text-anchor="middle" class="sv-lbl-hi">xTaskCreate</text><rect x="268" y="38" width="94" height="22" rx="4" class="sv-grn-s"></rect><text x="315" y="53" text-anchor="middle" class="sv-lbl-hi">rt_thread_create</text><rect x="378" y="38" width="94" height="22" rx="4" class="sv-amb-s"></rect><text x="425" y="53" text-anchor="middle" class="sv-lbl-hi">k_thread_create</text><text x="12" y="78" class="sv-lbl">优先级方向</text><rect x="158" y="66" width="94" height="22" rx="4" class="sv-red-s"></rect><text x="205" y="81" text-anchor="middle" class="sv-lbl-hi">越大越高</text><rect x="268" y="66" width="94" height="22" rx="4" class="sv-grn-s"></rect><text x="315" y="81" text-anchor="middle" class="sv-lbl-hi">越小越高</text><rect x="378" y="66" width="94" height="22" rx="4" class="sv-grn-s"></rect><text x="425" y="81" text-anchor="middle" class="sv-lbl-hi">越小越高</text><text x="12" y="106" class="sv-lbl">互斥</text><rect x="158" y="94" width="94" height="22" rx="4" class="sv-cyn-s"></rect><text x="205" y="109" text-anchor="middle" class="sv-lbl-hi">xSemaphore*Mutex</text><rect x="268" y="94" width="94" height="22" rx="4" class="sv-grn-s"></rect><text x="315" y="109" text-anchor="middle" class="sv-lbl-hi">rt_mutex_*</text><rect x="378" y="94" width="94" height="22" rx="4" class="sv-amb-s"></rect><text x="425" y="109" text-anchor="middle" class="sv-lbl-hi">k_mutex_*</text><text x="12" y="134" class="sv-lbl">临界区</text><rect x="158" y="122" width="94" height="22" rx="4" class="sv-cyn-s"></rect><text x="205" y="137" text-anchor="middle" class="sv-lbl-hi">taskENTER_CRITICAL</text><rect x="268" y="122" width="94" height="22" rx="4" class="sv-grn-s"></rect><text x="315" y="137" text-anchor="middle" class="sv-lbl-hi">rt_enter_critical</text><rect x="378" y="122" width="94" height="22" rx="4" class="sv-amb-s"></rect><text x="425" y="137" text-anchor="middle" class="sv-lbl-hi">irq_lock</text></svg>
```



任务/信号量/互斥/临界区/延时一一对应；优先级方向 FreeRTOS 与其他两者相反。



表 9.1 三内核 API



| 概念 | FreeRTOS | RT-Thread | Zephyr |
| --- | --- | --- | --- |
| 任务 | xTaskCreate | rt\_thread\_create | k\_thread\_create |
| 优先级方向 | 越大越高 | 越小越高 | 越小越高 |
| 信号量 | xSemaphore\* | rt\_sem\_\* | k\_sem\_\* |
| 互斥量 | xSemaphoreCreateMutex | rt\_mutex\_\* | k\_mutex\_\* |
| 临界区 | taskENTER\_CRITICAL | rt\_enter\_critical | irq\_lock |



```zhizhan-anchor
m09-evidence
```



```zhizhan-anchor
m09-evidence-t
```



## 9.2 真实证据：三份对照代码（交叉编译）



三套 API 的调用约定都能通过交叉编译；规模（含静态线程栈）可从 size 读出：



m09\_rtthread.cC

 

```text
/* m09_rtthread.c —— RT-Thread 侧写法（对象化 API）。
 * 线程有独立栈，信号量/互斥量都是内核对象，带名字便于 shell(msh) 调试。 */
#include "rtthread_api.h"

static rt_sem_t g_ready;

static void worker(void *param) {
    (void)param;
    for (;;) {
        rt_sem_take(g_ready, RT_WAITING_FOREVER);
        /* 事件处理 */
    }
}

void m09_rtthread_start(void) {
    g_ready = rt_sem_create("ready", 0, 0);
    rt_thread_t t = rt_thread_create("worker", worker, 0, 2048u, 10u, 20u);
    if (t) { (void)rt_thread_startup(t); }
}
```

RT-Thread 风格 · M3



真实运行



$



```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -Os -c labs/m09_rtthread.c -o m09.o && arm-none-eabi-size m09.o
   text    data     bss     dec     hex filename
    105       0       4     109      6d m09.o
```



真实交叉编译：m09\_rtthread.c（M3）text=105 B；Xtensa 侧含 2048 B 静态线程栈、M7 侧 84 B。



表 9.2 三内核规模



| 文件 | 平台 | 规模 |
| --- | --- | --- |
| m09\_rtthread.c | M3 | text=105 B |
| esp\_m09\_zephyr.c | Xtensa | text=70 B，bss≈2052 B |
| h7\_m09\_compare.c | M7 | text=84 B |
| 结论 | — | 三套 API 均可编译 |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm09-plat\n```\n\n\n\n```zhizhan-anchor\nm09-plat-t\n```\n\n\n\n## 9.3 三平台对照：配置与工具\n\n\n\n配置方式差异大：FreeRTOS 用 FreeRTOSConfig.h；RT-Thread 用 Kconfig\\+msh；Zephyr 用 Kconfig\\+设备树\\+west。\n\n\n\nm09\\_rtthread.cC\n\n \n\n```text\n/* m09_rtthread.c —— RT-Thread 侧写法（对象化 API）。\n * 线程有独立栈，信号量/互斥量都是内核对象，带名字便于 shell(msh) 调试。 */\n#include \"rtthread_api.h\"\n\nstatic rt_sem_t g_ready;\n\nstatic void worker(void *param) {\n    (void)param;\n    for (;;) {\n        rt_sem_take(g_ready, RT_WAITING_FOREVER);\n        /* 事件处理 */\n    }\n}\n\nvoid m09_rtthread_start(void) {\n    g_ready = rt_sem_create(\"ready\", 0, 0);\n    rt_thread_t t = rt_thread_create(\"worker\", worker, 0, 2048u, 10u, 20u);\n    if (t) { (void)rt_thread_startup(t); }\n}\n```\n\nSTM32F103 · RT-Thread 风格\n\n\n\nesp\\_m09\\_zephyr.cC\n\n \n\n```text\n/* esp_m09_zephyr.c —— Zephyr 侧写法（静态内核对象 + k_ 前缀 API）。\n * 内核对象在编译期定义，配置来自 Kconfig/设备树；线程栈也静态分配。 */\n#include \"zephyr_api.h\"\n\nK_SEM_DEFINE(g_ready, 0, 1);\n\nstatic void worker(void *p1, void *p2, void *p3) {\n    (void)p1; (void)p2; (void)p3;\n    for (;;) {\n        (void)k_sem_take(&g_ready, K_FOREVER);\n        /* 事件处理 */\n    }\n}\n\nstatic struct k_thread g_thread;\nstatic K_THREAD_STACK_DEFINE(g_stack, 2048);\n\nvoid esp_m09_start(void) {\n    (void)k_thread_create(&g_thread, g_stack, K_THREAD_STACK_SIZEOF(g_stack),\n                          worker, 0, 0, 0, 5, 0u, K_NO_WAIT);\n}\n```\n\nESP32 · Zephyr 风格\n\n\n\nh7\\_m09\\_compare.cC\n\n \n\n```text\n/* h7_m09_compare.c —— 同一块 H7 上三种内核的代码对照（FreeRTOS 侧）。\n *   FreeRTOS : xTaskCreate / xSemaphoreTake / taskENTER_CRITICAL(BASEPRI)\n *   RT-Thread: rt_thread_create / rt_sem_take / rt_enter_critical\n *   Zephyr   : k_thread_create / k_sem_take / irq_lock\n * 语义相近，差别在配置方式（宏/头文件 vs Kconfig/设备树）与调试工具。 */\n#include \"rtos_api.h\"\n\nstatic SemaphoreHandle_t g_lock;\n\nstatic void cmp_task(void *arg) {\n    (void)arg;\n    for (;;) {\n        (void)xSemaphoreTake(g_lock, portMAX_DELAY);\n        /* 临界区 */\n        (void)xSemaphoreGive(g_lock);\n        vTaskDelay(pdMS_TO_TICKS(20));\n    }\n}\n\nvoid h7_m09_compare(void) {\n    g_lock = xSemaphoreCreateMutex();\n    (void)xTaskCreate(cmp_task, \"cmp\", 256u, 0, 3u, 0);\n}\n```\n\nSTM32H7 · 对照\n\n\n\n表 9.3 三内核配置与选型\n\n\n\n| 维度 | FreeRTOS | RT-Thread | Zephyr |\n| --- | --- | --- | --- |\n| 配置 | FreeRTOSConfig.h | Kconfig\\+rtconfig.h | Kconfig\\+设备树 |\n| shell | — | msh | shell |\n| 构建 | make/IDE | scons/IDE | west/CMake |\n| 选型 | 生态大成商用 | 国产化/中文 | 标准/认证路径 |"}
````



```zhizhan-anchor
m09-check
```



```zhizhan-anchor
m09-check-t
```



## 9.4 自检



选型自检：API 对应、优先级方向、配置工具、按生态取舍。



```zhizhan-anchor
fig-图-9-2
```



**图 9.2**  选型决策



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="选型决策" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">看需求</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">看生态</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">看工具</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">选定</text></svg>
```



需要商用生态→FreeRTOS；国产化/中文→RT-Thread；长期维护/认证→Zephyr。



表 9.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 对照 | API 名称 | 照搬方向 |
| 方向 | 重映射优先级 | 方向搞反 |
| 配置 | Kconfig/dts | 写死寄存器 |
| 选型 | 按生态 | 只比性能 |



```zhizhan-anchor
m09-pitfalls
```



```zhizhan-anchor
m09-pitfalls-t
```



## 9.5 常见误区与排障



失败路径与排障




- **把优先级方向照搬** ：从 FreeRTOS 移植到 RT-Thread/Zephyr 方向相反，任务会“反过来”抢。

- **Kconfig 没开对应特性** ：对象未启用却调用，链接期报未定义符号。

- **忽略设备树** ：Zephyr 里外设地址/中断来自设备树，写死寄存器会不一致。

- **只比性能不看生态** ：选型失败通常因工具链/资料/认证。



◆ 自测 · Module 09（先答再看）




1. 从 FreeRTOS 迁移到 Zephyr，任务优先级 5（原意“中等”）要注意什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"方向相反。FreeRTOS 里 5 越大越紧急；Zephyr 里数字越小优先级越高。必须重新映射，否则高优先级变低优先级。"}
   ```

2. 三内核选型应该看什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"看生态与团队经验：商用与例程选 FreeRTOS；国产化/组件全/中文资料选 RT-Thread；长期维护/标准化/认证路径选 Zephyr。"}
   ```

3. Zephyr 里为什么不能写死外设寄存器？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"Zephyr 用设备树描述外设地址/中断；写死寄存器会与工程配置不一致，换板/换配置即失效。应通过设备树与驱动 API 访问。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你项目候选内核做一张 API 与优先级方向对照表，并按生态给出选型结论。



核对与延伸：[RT-Thread 官方文档](https://www.rt-thread.io/document/site/) · [Zephyr 官方文档 · Kernel](https://docs.zephyrproject.org/latest/kernel/index.html)

 

动手练习



编译三个对照文件：` labs/m09_rtthread.c `（M3）、` labs/esp_m09_zephyr.c `（Xtensa）、` labs/h7_m09_compare.c `（M7）。



**检查结果：** 三份代码各自编译通过；能指出“同一件事”在三内核里的 API 名与优先级方向差异。

 

迁移练习：把本章的“能对照 FreeRTOS/RT-Thread/Zephyr 的 API 与优先级方向，并给出按生态与工具链的选型结论。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 09 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-anchor
m09-sdk-project
```



```zhizhan-anchor
m09-sdk-project-t
```



## 从片段走到 SDK 工程

 

本章早期的 API 桩只能检查调用形状。配套 [sdk\_pipeline 实验](textbook-file:b06/labs/sdk_pipeline/README.txt)补入 Zephyr 与 ESP-IDF 的真实构建文件、共享数据核心和两个队列适配器。选择与你的硬件一致的一路。

 


1. 先在电脑运行 ` gcc -std=c11 -Wall -Wextra -Werror labs/sdk_pipeline/host_test.c -o host_test `，验证 0/2048/4095、越界与空指针；这个结果仅属于数据核心。
 
2. Zephyr 教学基线 v4.4.0：在配置好的工作区运行 ` west build -p always -b native_sim /absolute/path/sdk_pipeline/zephyr `，然后 ` west build -t run `。保存冻结 manifest、编译器和生成的 ` .config `。native\_sim 不能提供实板中断/功耗数据。
 
3. ESP-IDF 教学基线 v6.0：进入 ` sdk_pipeline/esp_idf `，用 ` idf.py set-target esp32 `、` idf.py build ` 构建；接对应板后才执行 flash/monitor。任务栈参数在 IDF 中按字节计，不沿用原生 FreeRTOS 的栈元素数。
 
4. 生产周期 50ms、消费周期 200ms、队列容量 4，满时丢新数据并计数。先预测积压趋势，再检查 SAMPLE 断号与 DROP 日志；日志不是时间测量仪。消费改为 20ms，解释差异。
 
5. 将合成源换成真实传感器，加入质量位、超时和断线恢复。Kconfig 管软件配置，devicetree/overlay 管硬件描述；检查生成的 ` zephyr.dts `，验证驱动已启用且设备就绪。


 

本次只验证共享核心的主机测试；两套 SDK 的目标构建与上板记录仍需补齐。入门工程含可工作的调用和构建入口，但未连接的硬件不能凭阅读验收。

 

核对：[Zephyr 应用构建](https://docs.zephyrproject.org/latest/develop/application/index.html) · [Kconfig](https://docs.zephyrproject.org/latest/build/kconfig/setting.html) · [设备树](https://docs.zephyrproject.org/latest/build/dts/howtos.html) · [消息队列](https://docs.zephyrproject.org/latest/kernel/services/data_passing/message_queues.html) · [IDF FreeRTOS](https://docs.espressif.com/projects/esp-idf/en/v6.0/esp32/api-reference/system/freertos_idf.html)。教学版本需配合维护状态及补丁核查。



```zhizhan-assessment
{"id":"course-b06-m09","criterion":"三份代码各自编译通过；能指出“同一件事”在三内核里的 API 名与优先级方向差异。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b06-guide)
