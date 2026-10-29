/* h7_m05_lora.c —— 外挂 LoRa 模组配置（STM32H7 / Cortex-M7）。
 * 设置扩频因子；注意各地区占空比限制（如 EU868 需满足 1% 占空比调度）。 */
#include <stdint.h>
#include "comm_api.h"

int lora_config(uint8_t sf) {
    uint8_t cmd[16];
    int n = 0;
    const char *p = "AT+SF=";
    while (*p) { cmd[n++] = (uint8_t)*p++; }
    cmd[n++] = (uint8_t)('0' + (sf / 10u) % 10u);
    cmd[n++] = (uint8_t)('0' + (sf % 10u));
    cmd[n++] = '\r';
    cmd[n++] = '\n';
    return uart_send(cmd, (size_t)n);
}

/* 占空比约束：两次上行之间至少要等 (1/占空比 - 1) 倍的发送时长（示意） */
uint32_t lora_min_gap_ms(uint32_t airtime_ms, uint32_t duty_permille) {
    if (duty_permille == 0u) return 0u;
    return airtime_ms * (1000u - duty_permille) / duty_permille;
}
