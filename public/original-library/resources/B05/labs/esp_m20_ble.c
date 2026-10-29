/* esp_m20_ble.c — B05-M20 蓝牙 / BLE（ESP32 内置）：广播、GATT、连接参数、低功耗
 * BLE 是事件驱动 + 属性表（GATT service/characteristic）。广播发起连接，连接后可协商参数。 */
#include <stdint.h>

typedef int esp_err_t;
typedef void *esp_gatt_if_t;

extern esp_err_t esp_bt_controller_init(void *cfg);
extern esp_err_t esp_bt_controller_enable(int mode);
extern esp_err_t esp_bluedroid_init(void);
extern esp_err_t esp_bluedroid_enable(void);
extern esp_err_t esp_ble_gap_register_callback(void *cb);
extern esp_err_t esp_ble_gap_set_device_name(const char *name);
extern esp_err_t esp_ble_gap_config_adv_data(void *adv);
extern esp_err_t esp_ble_gap_start_advertising(void *params);
extern esp_err_t esp_ble_gatts_app_register(uint16_t app_id);
extern esp_err_t esp_ble_gap_update_conn_params(const void *params);

/* 连接参数：interval×1.25ms、latency、timeout×10ms。低功耗设备常增大 latency。 */
typedef struct { uint16_t min_int; uint16_t max_int; uint16_t latency; uint16_t timeout; } ble_conn_par_t;

int esp_ble_peripheral_start(const char *name, void *adv, void *adv_params)
{
    esp_bt_controller_init((void *)0);
    esp_bt_controller_enable(0);        /* 0 = BLE */
    esp_bluedroid_init();
    esp_bluedroid_enable();
    esp_ble_gap_register_callback((void *)0);
    esp_ble_gap_set_device_name(name);
    esp_ble_gap_config_adv_data(adv);
    esp_ble_gatts_app_register(0);
    return esp_ble_gap_start_advertising(adv_params);
}

/* 连接后请求更省电的参数（外设侧发起） */
int esp_ble_request_lowpower(void)
{
    ble_conn_par_t p = { 80u, 160u, 4u, 600u };   /* 100~200ms 间隔，latency 4 */
    return esp_ble_gap_update_conn_params(&p);
}

/* GATT 通知（Notify）：把特征值推给已连接主机 */
extern esp_err_t esp_ble_gatts_send_indicate(esp_gatt_if_t iface, uint16_t conn_id,
                                             uint16_t attr_handle, uint16_t len,
                                             uint8_t *value, int need_confirm);
int esp_ble_notify(esp_gatt_if_t iface, uint16_t conn_id, uint16_t handle,
                   uint8_t *data, uint16_t len)
{
    return esp_ble_gatts_send_indicate(iface, conn_id, handle, len, data, 0);
}
