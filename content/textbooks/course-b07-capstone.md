# 一个可远程升级、断网可恢复的传感器节点

```zhizhan-anchor
capstone
```



把 13 章串成一条路径：协议设计 → 校验 → 总线/无线 → 应用层 → Bootloader/[OTA](term:ota) → 断网重传 → 升级确认。



> ◈ 10 步集成路径 · ⚑ 每步可验收

 

把 13 章的能力串成一个可交付节点： **平时按 Modbus 轮询传感器并经 MQTT 上报；收到升级命令后，下载固件写入备用区，校验通过再切换；新固件自检通过前不确认，失败可回滚。** 这不是新示例，而是把各章按依赖重排成一条构建路径，每一步都有可检验的验收。

 

 
1. **① 定协议** （M01/M02）——帧头\+长度\+CRC，序号去重；验收：注入噪声后仍能重同步，坏帧不影响好帧。
 
2. **② 现场总线** （M03/M04）——Modbus 轮询 \+ CAN 采集；验收：整帧 CRC 自洽、异常码可分、CAN 位定时/终端正确。
 
3. **③ 联网** （M11）——以太网/WiFi \+ TCP；验收：分层（link→IP→TCP）逐层可观测。
 
4. **④ 上行** （M06）——MQTT QoS1 上报；验收：重复消息被去重，掉线由遗嘱暴露。
 
5. **⑤ 断网兜底** （M12）——指数退避 \+ 有界缓存；验收：断网不丢数据、缓存有上界、重连后补传。
 
6. **⑥ 无线补充** （M05）——BLE/LoRa 视场景接入；验收：连接参数/占空比符合约束。
 
7. **⑦ 分区与跳转** （M07）——Boot/App/备份分区；验收：跳转前关中断、重定位 VTOR、设 MSP。
 
8. **⑧ 升级链路** （M08）——分块下载 \+ 断点续传 \+ 校验；验收：任一步掉电都能启动。
 
9. **⑨ 确认与回滚** （M13）——版本准入 \+ 自检确认；验收：不降级、跨版本先迁移、失败回滚。
 
10. **⑩ 整合** （M09/M10）——` labs/capstone_ota_node.c `：共享链路加锁、升级优先级低于业务、现场可诊断。
 

 

本册所有板上项（真实总线波形、无线 RSSI/时延、功耗、OTA 掉电表现）均标注为“需上板实测”，未接板不声称已测；协议编解码与可调度性等主机可验证的部分已给出真实运行结果。



capstone\_ota\_node.cC

 

```text
/* capstone_ota_node.c —— 贯穿项目骨架：可远程升级传感器节点（Cortex-M3 示范）。
 * 采样轮询（Modbus）与升级分块共用串口，用互斥量串行化；
 * 升级写入备用区，校验通过才切换；新固件自检通过前不确认（可回滚）。 */
#include <stdint.h>
#include "comm_api.h"
#include "rtos_cm.h"

static SemaphoreHandle_t g_bus;
static QueueHandle_t g_uplink;

typedef struct { uint16_t reg; uint16_t val; } sample_t;

static void poll_task(void *arg) {
    uint8_t req[8] = {0x01, 0x03, 0x00, 0x00, 0x00, 0x02};
    uint16_t c = crc16_modbus(req, 6);
    req[6] = (uint8_t)c; req[7] = (uint8_t)(c >> 8);
    (void)arg;
    for (;;) {
        if (xSemaphoreTake(g_bus, pdMS_TO_TICKS(50)) == pdTRUE) {
            (void)uart_send(req, 8u);
            xSemaphoreGive(g_bus);
        }
        vTaskDelay(pdMS_TO_TICKS(1000));
    }
}

static void ota_task(void *arg) {
    (void)arg;
    for (;;) {
        /* 收到命令：ota_begin(total, crc)；循环 uart_recv + ota_write；ota_finish() 校验并切换 */
        vTaskDelay(pdMS_TO_TICKS(5000));
    }
}

static void mode_switch(int enter_ota) {
    cm_set_primask(enter_ota ? 1u : 0u);   /* 进入升级前后对关键窗口做保护（示意） */
}

void capstone_start(void) {
    g_bus = xSemaphoreCreateMutex();
    g_uplink = xQueueCreate(16u, (uint32_t)sizeof(sample_t));
    (void)g_uplink;
    (void)xTaskCreate(poll_task, "poll", 512u, 0, 3u, 0);
    (void)xTaskCreate(ota_task,  "ota",  768u, 0, 2u, 0);
    mode_switch(0);
}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b07-guide)
