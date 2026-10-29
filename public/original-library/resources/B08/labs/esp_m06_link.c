/* esp_m06_link.c —— ESP32 上报链路质量与断线判断（Xtensa）。
 * RSSI 分级决定是否降速/重连；断线由事件驱动重连（B07 M12）。 */
#include "esp_app.h"
#include "app_api.h"

int esp_link_quality(void) {
    int r = esp_wifi_sta_get_rssi();
    if (r >= -60) return 2;      /* 好 */
    if (r >= -80) return 1;      /* 一般 */
    return 0;                    /* 差：应降速或重连 */
}
