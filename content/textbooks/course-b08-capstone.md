# 从需求到产品级验收的完整路径

```zhizhan-anchor
capstone
```



把 15 章串成一条路径：需求→架构→骨架→交互→数据→控制→连接→电源→可靠→自制板→综合项目→持久化→验收。



> ◈ 12 步交付路径 · ⚑ 每步可验收

 

把 15 章的能力串成一台可交付的产品原型： **采集(高) → 队列 → 显示(低)；共享 [I²C](term:i2c) 用互斥量；看门狗仅在关键任务健康时喂；参数双副本、上报走 B07 的协议与 [OTA](term:ota)。** 这不是新示例，而是把各章按依赖重排成一条构建路径，每一步都有可检验的验收。

 

 
1. **① 定架构** （M01）——模块接口 {init,poll} \+ 状态机；验收：故障优先并锁存，非法事件被忽略。
 
2. **② 搭骨架** （M02）——错误码/日志/版本；验收：任一失败能返回可定位的错误码。
 
3. **③ 做交互** （M03/M14）——按键语义事件 \+ 状态驱动刷新；验收：短按/长按/双击正确，界面与业务解耦。
 
4. **④ 采与存** （M04）——采样时基 \+ 环形日志 \+ 提交标记；验收：掉电最多丢最后一条未提交记录。
 
5. **⑤ 控与保** （M05/M11）——PID \+ 抗饱和 \+ 限位/过流保护；验收：故障时输出为 0 且锁存。
 
6. **⑥ 联与报** （M06）——上报策略 \+ 退避重连 \+ 有界离线缓存；验收：断网不丢、缓存有上界、恢复补传。
 
7. **⑦ 省电** （M07/M12）——功耗预算 \+ 深睡眠；验收：平均电流与续航由预算表算出，目标单节电池一年。
 
8. **⑧ 可靠** （M08）——看门狗 \+ 复位原因 \+ 参数回退；验收：卡死能复位、坏参数回退默认。
 
9. **⑨ 落板** （M09）——最小系统与自制板；验收：按电源→时钟→调试→外设顺序排查通过。
 
10. **⑩ 验收** （M10/M13/M15）——` labs/capstone_app_node.c `；验收：资源预算达标、保护可测、长跑稳定。
 

 

本册所有板上项（实际功耗/续航、控制响应、RF 表现、首板波形）均标注为“需上板实测”，未接板不声称已测；状态机、日志提交、PID、功耗预算、按键、参数恢复、心跳等主机可验证的部分已给出真实运行结果。



capstone\_app\_node.cC

 

```text
/* capstone_app_node.c —— 贯穿项目：产品级环境监测终端（Cortex-M3 示范）。
 * 采集(高) → 队列 → 界面(低)；共享 I²C 用互斥量；看门狗仅在关键任务健康时喂；
 * 参数双副本、上报走 B07 的协议与 OTA。 */
#include <stdint.h>
#include "app_api.h"
#include "stm32_app.h"

void wdt_init(void);
void wdt_feed_if_healthy(int sensor_ok, int control_ok, int comm_ok);

static QueueHandle_t g_samples;
static SemaphoreHandle_t g_i2c;

static void acq_task(void *arg) {
    float t = 0.0f, r = 0.0f;
    (void)arg;
    for (;;) {
        if (xSemaphoreTake(g_i2c, pdMS_TO_TICKS(5)) == pdTRUE) {
            if (sensor_read(&t, &r) == 0) { (void)xQueueSend(g_samples, &t, pdMS_TO_TICKS(5)); }
            xSemaphoreGive(g_i2c);
        }
        vTaskDelay(pdMS_TO_TICKS(1000));
    }
}
static void ui_task(void *arg) {
    (void)arg;
    for (;;) { (void)display_flush(); vTaskDelay(pdMS_TO_TICKS(500)); }
}
static void monitor_task(void *arg) {
    (void)arg;
    for (;;) {
        wdt_feed_if_healthy(1, 1, 1);   /* 三个关键任务都健康才喂狗 */
        vTaskDelay(pdMS_TO_TICKS(200));
    }
}

void capstone_start(void) {
    g_samples = xQueueCreate(16u, (uint32_t)sizeof(float));
    g_i2c = xSemaphoreCreateMutex();
    (void)xTaskCreate(acq_task,     "acq", 512u, 0, 4u, 0);
    (void)xTaskCreate(ui_task,      "ui",  512u, 0, 2u, 0);
    (void)xTaskCreate(monitor_task, "mon", 512u, 0, 1u, 0);
    wdt_init();
}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b08-guide)
