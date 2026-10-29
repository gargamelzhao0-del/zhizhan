/* esp_m13_rollback.c —— ESP32 升级确认与回滚（Xtensa）。
 * 新固件首次启动后必须在自检通过时调用 confirm，否则复位时自动回滚。 */
#include "esp_comm.h"

void esp_confirm_ok(void) { (void)esp_ota_mark_app_valid_cancel_rollback(); }
void esp_rollback_now(void) { (void)esp_ota_mark_app_invalid_rollback_and_reboot(); }

/* 启动自检：联网、外设、参数版本都正常才算“确认” */
int esp_selfcheck(int net_ok, int periph_ok, int cfg_ok) {
    if (net_ok && periph_ok && cfg_ok) { esp_confirm_ok(); return 0; }
    return -1;      /* 不确认：留给下次复位回滚 */
}
