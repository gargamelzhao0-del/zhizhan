/* h7_m09_board.c —— H7 自制板电源与内核电压检查（Cortex-M7）。
 * H7 需要正确的外部供电与 VCORE 去耦；VOS 档位与频率相关。 */
#include "stm32_app.h"

int h7_power_rails_ok(void) {
    /* 真实工程测量 VDD/VCORE 并核对 VOS 档位；这里给出占位判定 */
    return (H7_PWR_CR1 == 0xFFFFFFFFu) ? 0 : 1;   /* 1 = 正常 */
}
