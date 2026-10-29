/* comm_api.h —— 本册自带的通信接口子集（仅声明，供交叉编译做语法/调用约定验证）。
 * 声明与常见 RTOS/外设抽象一致；运行期数值由本册主机程序（host_*.c）给出。
 * 真实平台上 these 由 HAL/IDF/lwIP 等提供。 */
#ifndef COMM_API_H
#define COMM_API_H

#include <stdint.h>
#include <stddef.h>
#include "rtos_api.h"

typedef struct {
    uint32_t id;      /* 11 位或 29 位标识符 */
    uint8_t  ide;     /* 1 = 扩展帧 */
    uint8_t  dlc;     /* 数据长度 0..8 */
    uint8_t  data[8];
} can_frame_t;

typedef struct { uint8_t addr; uint8_t func; uint16_t reg; uint16_t qty; } modbus_req_t;

uint16_t crc16_modbus(const uint8_t *p, size_t n);
uint32_t crc32_ieee(const uint8_t *p, size_t n);

int uart_send(const uint8_t *p, size_t n);
int uart_recv(uint8_t *p, size_t n, uint32_t timeout_ms);

int can_send(const can_frame_t *f);
int can_recv(can_frame_t *f, uint32_t timeout_ms);
int can_accept_filter(uint32_t id, uint32_t mask);

int ota_begin(uint32_t image_size, uint32_t crc32);
int ota_write(const uint8_t *p, size_t n);
int ota_finish(void);      /* 校验并切换 */
int ota_rollback(void);

int tcp_connect(const char *host, uint16_t port);
int tcp_send(const uint8_t *p, size_t n);
int tcp_recv(uint8_t *p, size_t n, uint32_t timeout_ms);

int mqtt_connect(const char *client_id, uint16_t keepalive_s);
int mqtt_publish(const char *topic, const uint8_t *p, size_t n, int qos);

#endif /* COMM_API_H */
