/* h7_m13_rollback.c —— H7 双 Bank 升级确认（Cortex-M7）。
 * “待确认”标志与启动计数存在备份域；连续启动失败超过阈值就换回原 Bank。 */
#include <stdint.h>
#include "comm_api.h"

#define BKP_FLAG  (*(volatile uint32_t *)0x40006C04u)   /* 备份寄存器示例地址 */
#define BKP_TRIES (*(volatile uint32_t *)0x40006C08u)

void h7_mark_pending(void) { BKP_FLAG = 0xA5A5A5A5u; BKP_TRIES = 0u; }
void h7_mark_confirmed(void) { BKP_FLAG = 0u; }

/* 启动时决策：返回 1=继续运行并计数，0=正常运行（已确认），-1=回滚 */
int h7_boot_decision(int selfcheck_ok) {
    if (BKP_FLAG != 0xA5A5A5A5u) return 0;              /* 没有待确认标志 */
    if (selfcheck_ok) { h7_mark_confirmed(); return 0; }
    BKP_TRIES++;
    if (BKP_TRIES > 3u) return -1;                      /* 连续失败：回滚 */
    return 1;
}
