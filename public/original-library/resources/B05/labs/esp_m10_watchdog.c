/* esp_m10_watchdog.c — ESP32 看门狗与低功耗：RTC_WDT 跨 deep-sleep，复位原因用 API 读
 * 与 STM32 的 IWDG + RCC_CSR 不同，ESP32 分 RTC_WDT（可跨睡眠）与 TWDT（任务看门狗）。 */
#include "esp32_regs.h"

typedef enum {
    ESP_RST_UNKNOWN, ESP_RST_POWERON, ESP_RST_EXT, ESP_RST_SW,
    ESP_RST_PANIC, ESP_RST_INT_WDT, ESP_RST_TASK_WDT, ESP_RST_WDT,
    ESP_RST_DEEPSLEEP, ESP_RST_BROWNOUT, ESP_RST_SDIO
} esp_reset_reason_t;

extern esp_reset_reason_t esp_reset_reason(void);   /* 比裸寄存器可靠，避免位义记错 */
extern void esp_deep_sleep_start(void);
extern unsigned long long esp_sleep_get_wakeup_cause(void);
extern int esp_sleep_enable_timer_wakeup(unsigned long long us);

/* 每 10 分钟唤醒一次的低功耗节点：定时器唤醒 + deep sleep */
int esp_lowpower_node_start(unsigned int period_s)
{
    esp_sleep_enable_timer_wakeup((unsigned long long)period_s * 1000000ull);
    return (int)esp_sleep_get_wakeup_cause();
}

void esp_enter_deep_sleep(void) { esp_deep_sleep_start(); }

/* RTC 域在 deep sleep 中保持：RTC GPIO / RTC memory 可用于唤醒与保存现场 */
int esp_reset_is_poweron(void) { return esp_reset_reason() == ESP_RST_POWERON; }
