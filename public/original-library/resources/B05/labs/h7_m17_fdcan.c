/* h7_m17_fdcan.c — B05-M17 CAN（STM32H7 / FDCAN，Bosch M_CAN 内核）
 * 与 F1 的 bxCAN 不同：FDCAN 用消息 RAM + 描述符环，支持 CAN-FD。这里给初始化与发送骨架。 */
#include "stm32h7_regs.h"

#define H7_FDCAN_BASE 0x4000A000u
#define H7_FDCAN_CCCR R32(H7_FDCAN_BASE + 0x18u)
#define H7_FDCAN_NBTP R32(H7_FDCAN_BASE + 0x1Cu)
#define H7_FDCAN_TXBAR R32(H7_FDCAN_BASE + 0x90u)
#define H7_FDCAN_IR    R32(H7_FDCAN_BASE + 0x40u)
#define H7_CCCR_INIT  (1u << 0)
#define H7_CCCR_CCE   (1u << 1)

/* 消息 RAM 起始地址由 FDCAN->SIDFC/XIDFC 等指向的存储区决定（见 RM0433） */
extern volatile uint32_t g_fdcan_msg_ram[64];

int h7_fdcan_init(uint32_t nbtp_value)
{
    R32(0x580244E8u) |= (1u << 28);          /* 开 FDCAN 时钟（示意） */
    H7_FDCAN_CCCR |= H7_CCCR_INIT | H7_CCCR_CCE;
    H7_FDCAN_NBTP = nbtp_value;              /* 位定时：见 RM0433 的 NBTP 字段 */
    H7_FDCAN_CCCR &= ~H7_CCCR_INIT;          /* 退出初始化，进入正常 */
    return (H7_FDCAN_CCCR & H7_CCCR_INIT) ? -1 : 0;
}

/* 把报文写进 TX 缓冲元素，再置 TXBAR 请求发送（描述符环的规则见手册） */
void h7_fdcan_send(uint32_t id, const uint8_t *data, uint8_t len)
{
    (void)id; (void)data; (void)len;
    H7_FDCAN_TXBAR = 1u;                     /* 请求发送缓冲 0 */
}

int h7_fdcan_poll(void) { return (int)(H7_FDCAN_IR & 1u); }
