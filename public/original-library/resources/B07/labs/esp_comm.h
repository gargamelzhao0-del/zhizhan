/* esp_comm.h —— ESP-IDF（ESP32 / Xtensa）通信相关接口子集（仅声明）。
 * 覆盖 UART / TWAI(CAN) / WiFi / BLE-GATT / OTA / netif 的常用 API。 */
#ifndef ESP_COMM_H
#define ESP_COMM_H

#include <stdint.h>
#include <stddef.h>
#include "rtos_api.h"

typedef int esp_err_t;
#define ESP_OK 0
#define IRAM_ATTR __attribute__((section(".iram1")))

/* ---- TWAI（内置 CAN 2.0B） ---- */
typedef struct {
    uint32_t identifier;
    uint8_t  data_length_code;
    uint8_t  data[8];
    uint8_t  flags;              /* 含自接收/扩展帧标志 */
} twai_message_t;
typedef struct { int dummy; } twai_general_config_t;
typedef struct { int dummy; } twai_filter_config_t;
typedef struct { int dummy; } twai_timing_config_t;

esp_err_t twai_driver_install(const twai_general_config_t *g, const twai_timing_config_t *t, const twai_filter_config_t *f);
esp_err_t twai_start(void);
esp_err_t twai_transmit(const twai_message_t *m, uint32_t timeout_ticks);
esp_err_t twai_receive(twai_message_t *m, uint32_t timeout_ticks);

/* ---- UART ---- */
int  uart_write_bytes(int port, const void *src, size_t size);
int  uart_read_bytes(int port, void *buf, uint32_t length, uint32_t ticks_to_wait);

/* ---- WiFi ---- */
typedef struct { uint8_t bssid[6]; int8_t rssi; uint8_t ssid[33]; } wifi_ap_record_t;
typedef struct { char ssid[32]; char password[64]; } wifi_config_t;
esp_err_t esp_wifi_start(void);
esp_err_t esp_wifi_connect(void);
esp_err_t esp_wifi_set_config(int interface, wifi_config_t *conf);
esp_err_t esp_wifi_sta_get_ap_info(wifi_ap_record_t *rec);
int       esp_wifi_sta_get_rssi(void);

/* ---- BLE GATT ---- */
esp_err_t esp_ble_gap_start_advertising(void *adv);
esp_err_t esp_ble_gatts_register_callback(void *cb);
esp_err_t esp_ble_gatts_create_attr_tab(const void *tab, void *out, uint16_t n);
esp_err_t esp_ble_gatts_send_indicate(void *gatt, uint16_t conn_id, uint16_t attr, uint16_t len, uint8_t *val, int need_confirm);

/* ---- OTA ---- */
typedef struct { int dummy; } esp_partition_t;
typedef struct { int dummy; } esp_ota_handle_t;
const esp_partition_t *esp_ota_get_next_update_partition(const esp_partition_t *start);
esp_err_t esp_ota_begin(const esp_partition_t *p, size_t size, esp_ota_handle_t *out);
esp_err_t esp_ota_write(esp_ota_handle_t h, const void *data, size_t size);
esp_err_t esp_ota_end(esp_ota_handle_t h);
esp_err_t esp_ota_set_boot_partition(const esp_partition_t *p);
esp_err_t esp_ota_mark_app_valid_cancel_rollback(void);
esp_err_t esp_ota_mark_app_invalid_rollback_and_reboot(void);

/* ---- netif / HTTP ---- */
typedef struct esp_netif_obj esp_netif_t;
esp_err_t   esp_netif_init(void);
esp_netif_t *esp_netif_create_default_wifi_sta(void);

#endif /* ESP_COMM_H */
