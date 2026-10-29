/* esp_m17_twai.c — B05-M17 CAN（ESP32 / TWAI 控制器）+ RS-485（UART RTS 半双工）
 * ESP32 内置 TWAI（CAN 2.0B）控制器，需外接收发器。 */
#include <stdint.h>

/* ---- TWAI（CAN）：ESP-IDF API ---- */
typedef struct { int baud_rate; int tx_io; int rx_io; } twai_timing_t;
extern int twai_driver_install(const void *timing, const void *filter, const void *alerts);
extern int twai_start(void);
extern int twai_transmit(const void *msg, int ticks_to_wait);
extern int twai_receive(void *msg, int ticks_to_wait);
extern int twai_driver_uninstall(void);

int esp_can_init(int tx_io, int rx_io, int baud)
{
    twai_timing_t t = { baud, tx_io, rx_io };
    int a = twai_driver_install(&t, (const void *)0, (const void *)0);
    return a == 0 ? twai_start() : a;
}

int esp_can_send(const void *msg) { return twai_transmit(msg, 10); }
int esp_can_recv(void *msg) { return twai_receive(msg, 10); }

/* ---- RS-485：UART 半双工模式，由硬件自动控制 RTS 方向（省去手动 DE） ---- */
extern int uart_set_mode(int port, int mode);
#define ESP_UART_MODE_RS485_HALF_DUPLEX 0
int esp_rs485_enable(int port) { return uart_set_mode(port, ESP_UART_MODE_RS485_HALF_DUPLEX); }

/* Modbus RTU CRC16 与平台无关，可直接复用（见 STM32F103 版） */
uint16_t esp_modbus_crc16(const uint8_t *p, uint32_t n)
{
    uint16_t crc = 0xFFFFu;
    for (uint32_t i = 0; i < n; ++i) {
        crc ^= p[i];
        for (int b = 0; b < 8; ++b) {
            crc = (crc & 1u) ? (uint16_t)((crc >> 1) ^ 0xA001u) : (uint16_t)(crc >> 1);
        }
    }
    return crc;
}
