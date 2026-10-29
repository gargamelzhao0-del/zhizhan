/* stm32_comm.h —— STM32（M3/M7）通信相关寄存器与位定义子集。
 * 覆盖 bxCAN / FDCAN / USART / 硬件 CRC 的常用寄存器（地址取自 RM0008 / RM0433）。 */
#ifndef STM32_COMM_H
#define STM32_COMM_H

#include <stdint.h>

/* ---- bxCAN（STM32F1，基址 0x40006400） ---- */
#define CAN1_MCR   (*(volatile uint32_t *)0x40006400u)
#define CAN1_MSR   (*(volatile uint32_t *)0x40006404u)
#define CAN1_TSR   (*(volatile uint32_t *)0x40006408u)
#define CAN1_RF0R  (*(volatile uint32_t *)0x4000640Cu)
#define CAN1_IER   (*(volatile uint32_t *)0x40006414u)
#define CAN1_BTR   (*(volatile uint32_t *)0x4000641Cu)
#define CAN1_TI0R  (*(volatile uint32_t *)0x40006580u)
#define CAN1_TDT0R (*(volatile uint32_t *)0x40006584u)
#define CAN1_TDL0R (*(volatile uint32_t *)0x40006588u)
#define CAN1_TDH0R (*(volatile uint32_t *)0x4000658Cu)
#define CAN1_RI0R  (*(volatile uint32_t *)0x40006640u)
#define CAN1_RDL0R (*(volatile uint32_t *)0x40006648u)
#define CAN1_RDH0R (*(volatile uint32_t *)0x4000664Cu)

/* ---- 硬件 CRC（STM32F1，基址 0x40023000） ---- */
#define CRC_DR (*(volatile uint32_t *)0x40023000u)
#define CRC_CR (*(volatile uint32_t *)0x40023008u)

/* ---- USART1（STM32F1，基址 0x40013800） ---- */
#define USART1_SR   (*(volatile uint32_t *)0x40013800u)
#define USART1_DR   (*(volatile uint32_t *)0x40013804u)
#define USART1_BRR  (*(volatile uint32_t *)0x40013808u)
#define USART1_CR1  (*(volatile uint32_t *)0x4001380Cu)

/* ---- FDCAN（STM32H7，消息 RAM 由配置决定，这里给出控制寄存器示例） ---- */
#define FDCAN_CCCR (*(volatile uint32_t *)0x4000A018u)
#define FDCAN_NBTP (*(volatile uint32_t *)0x4000A01Cu)
#define FDCAN_IR   (*(volatile uint32_t *)0x4000A020u)
#define FDCAN_PSR  (*(volatile uint32_t *)0x4000A044u)

/* 把 36MHz 的 APB1 配置成 500kbps、18 tq（TS1=15, TS2=2, SJW=1, BRP=4）的 bxCAN BTR 值。
 * 位时间 = 1(同步) + TS1 + TS2 = 18 tq；tq = BRP / 36MHz。
 * BTR 字段：BRP[9:0]=(BRP-1)，TS1[19:16]=(TS1-1)，TS2[22:20]=(TS2-1)，SJW[25:24]=(SJW-1)。 */
static inline void bxcan_set_500k(void) {
    CAN1_MCR |= 1u;                    /* INRQ=1：请求进入初始化 */
    while ((CAN1_MSR & 1u) == 0u) { }  /* 等待 INAK 置位 */
    CAN1_BTR = (4u - 1u) | ((15u - 1u) << 16) | ((2u - 1u) << 20) | ((1u - 1u) << 24);
    CAN1_MCR &= ~1u;                   /* INRQ=0：退出初始化，进入正常模式 */
    while (CAN1_MSR & 1u) { }
}

#endif /* STM32_COMM_H */
