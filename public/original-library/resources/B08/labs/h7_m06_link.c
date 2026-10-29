/* h7_m06_link.c —— H7 以太网/网关上报与补传（Cortex-M7）。
 * 应用层只关心“入队/上报成功”，底层链路细节由 B07 的协议栈处理。 */
#include <stdint.h>
#include "app_api.h"

int h7_link_report(const uint8_t *frame, int len) {
    (void)frame;
    return len > 0 ? 0 : -1;      /* 成功=0（真实实现走 TCP/MQTT） */
}
