/* esp_m04_twai.c —— 内置 TWAI(CAN 2.0B)（ESP32 / Xtensa）。
 * 安装 → 启动 → 发送；接收用 twai_receive（中断/轮询由驱动负责）。 */
#include <stdint.h>
#include "esp_comm.h"
#include "comm_api.h"

void esp_can_init(void) {
    twai_general_config_t g = {0};
    twai_timing_config_t  t = {0};
    twai_filter_config_t  f = {0};
    (void)twai_driver_install(&g, &t, &f);
    (void)twai_start();
}

int esp_can_tx(uint32_t id, const uint8_t *d, uint8_t dlc) {
    twai_message_t m;
    m.identifier = id;
    m.data_length_code = dlc;
    m.flags = 0;
    for (uint8_t i = 0; i < dlc && i < 8u; i++) m.data[i] = d[i];
    return (int)twai_transmit(&m, pdMS_TO_TICKS(10));
}
