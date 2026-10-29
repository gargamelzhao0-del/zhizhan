/* m17_can.c — B05-M17 有线现场总线（STM32F103）
 * ① bxCAN：位定时 + 发送/接收；② RS-485 半双工方向控制；③ Modbus RTU 的 CRC16；④ 1-Wire 位操作。 */
#include "stm32f103_regs.h"

/* ---- ① bxCAN：0x40006400 ---- */
#define CAN_BASE 0x40006400u
#define CAN_MCR  R32(CAN_BASE + 0x00u)
#define CAN_MSR  R32(CAN_BASE + 0x04u)
#define CAN_TSR  R32(CAN_BASE + 0x08u)
#define CAN_RF0R R32(CAN_BASE + 0x0Cu)
#define CAN_BTR  R32(CAN_BASE + 0x1Cu)
#define CAN_TI0R R32(CAN_BASE + 0x180u)
#define CAN_TDT0R R32(CAN_BASE + 0x184u)
#define CAN_TDL0R R32(CAN_BASE + 0x188u)
#define CAN_TDH0R R32(CAN_BASE + 0x18Cu)
#define CAN_RI0R R32(CAN_BASE + 0x1B0u)
#define CAN_RDL0R R32(CAN_BASE + 0x1B8u)
#define CAN_RDH0R R32(CAN_BASE + 0x1BCu)
#define CAN_TI0R_TXRQ (1u << 0)

int can_init(uint32_t prescaler, uint32_t bs1, uint32_t bs2)
{
    RCC_APB1ENR |= (1u << 25);              /* CANEN */
    CAN_MCR |= (1u << 0);                   /* INRQ：进入初始化 */
    for (uint32_t t = 0; t < 100000u && !(CAN_MSR & (1u << 0)); ++t) { }
    if (!(CAN_MSR & (1u << 0))) { return -1; }
    CAN_BTR = ((bs2 - 1u) << 20) | ((bs1 - 1u) << 16) | (prescaler - 1u);
    CAN_MCR &= ~(1u << 0);                  /* 退出初始化 */
    for (uint32_t t = 0; t < 100000u && (CAN_MSR & (1u << 0)); ++t) { }
    return (CAN_MSR & (1u << 0)) ? -2 : 0;
}

int can_send(uint32_t std_id, const uint8_t data[8], uint8_t dlc)
{
    if (CAN_TSR & (1u << 26)) { return -1; }   /* 邮箱 0 未空 */
    CAN_TDT0R = dlc;
    CAN_TDL0R = (uint32_t)data[0] | ((uint32_t)data[1] << 8)
              | ((uint32_t)data[2] << 16) | ((uint32_t)data[3] << 24);
    CAN_TDH0R = (uint32_t)data[4] | ((uint32_t)data[5] << 8)
              | ((uint32_t)data[6] << 16) | ((uint32_t)data[7] << 24);
    CAN_TI0R = (std_id << 21) | CAN_TI0R_TXRQ;
    return 0;
}

uint32_t can_recv(uint8_t out[8])
{
    if (!(CAN_RF0R & 0x3u)) { return 0xFFFFFFFFu; }  /* 无报文 */
    uint32_t id = CAN_RI0R >> 21;
    uint32_t lo = CAN_RDL0R, hi = CAN_RDH0R;
    out[0] = (uint8_t)lo; out[1] = (uint8_t)(lo >> 8); out[2] = (uint8_t)(lo >> 16); out[3] = (uint8_t)(lo >> 24);
    out[4] = (uint8_t)hi; out[5] = (uint8_t)(hi >> 8); out[6] = (uint8_t)(hi >> 16); out[7] = (uint8_t)(hi >> 24);
    CAN_RF0R = (1u << 5);                   /* RFOM0=1 释放 FIFO0 输出邮箱（写 bit0 是只读计数，无效） */
    return id;
}

/* ---- ② RS-485 半双工：发送前拉 DE，发完（TC）再拉低 ---- */
void rs485_begin_tx(void) { GPIOA->BSRR = (1u << 1); }        /* DE=PA1 高 */
void rs485_end_tx(void)   { GPIOA->BSRR = (1u << (1 + 16)); } /* DE 低 */

/* ---- ③ Modbus RTU CRC16（多项式 0xA001，反射，初值 0xFFFF） ---- */
uint16_t modbus_crc16(const uint8_t *p, uint32_t n)
{
    uint16_t crc = 0xFFFFu;
    for (uint32_t i = 0; i < n; ++i) {
        crc ^= p[i];
        for (int b = 0; b < 8; ++b) {
            crc = (crc & 1u) ? (uint16_t)((crc >> 1) ^ 0xA001u) : (uint16_t)(crc >> 1);
        }
    }
    return crc;
}

/* ---- ④ 1-Wire 位操作（开漏 + 外部上拉） ---- */
#define OW_PIN 12u
static void ow_release(void) { GPIOB->BSRR = (1u << OW_PIN); }          /* 释放=高 */
static void ow_drive_low(void) { GPIOB->BSRR = (1u << (OW_PIN + 16)); } /* 拉低 */
static void ow_delay(uint32_t n) { while (n--) { __asm volatile ("nop"); } }

int ow_reset(void)
{
    ow_drive_low(); ow_delay(480);          /* 复位脉冲 ≥480µs */
    ow_release(); ow_delay(70);
    int presence = (GPIOB->IDR & (1u << OW_PIN)) == 0u;  /* 从机拉低=存在 */
    ow_delay(410);
    return presence;
}
