/* h7_m08_i2c.c — STM32H7 I²C（v2）：TIMINGR 预置时序、CR2 发起、ISR 状态、TXDR/RXDR
 * 与 F1 的 I2C v1（CR1/SR1/SR2、手动 START/ACK）是两套不同的编程模型。
 * 教学片段：时钟、开漏引脚、滤波、单调期限和故障恢复由完整工程配置。
 * 仅用于独占单控制器；失败后须清理/重新初始化再重试。本轮未做目标板验证。 */
#include "stm32h7_regs.h"

void h7_i2c1_init(uint32_t timingr)
{
    H7_I2C1->CR1 &= ~1u;       /* TIMINGR 只能在 PE=0 时配置 */
    H7_I2C1->TIMINGR = timingr; /* SCLDEL/SDADEL/SCLH/SCLL，按 PCLK 与目标速率算，替代 F1 的 CCR/TRISE */
    H7_I2C1->CR1 |= 1u;
}

static int h7_i2c_wait(uint32_t mask)
{
    for (uint32_t t = 0u; t < 100000u; ++t) {
        if (H7_I2C1->ISR & H7_I2C_ISR_NACKF) { return -2; }
        if (H7_I2C1->ISR & mask) { return 0; }
    }
    return -1;
}

int h7_i2c1_read_reg(uint8_t addr7, uint8_t reg, uint8_t *val)
{
    if (addr7 > 0x7fu || val == 0) { return -3; }
    /* 写阶段：NBYTES=1，RELOAD=0、AUTOEND=0，完成后等 TC 再重复 START。
     * RELOAD=1 会进入 TCR，不能在该配置下等待 TC。 */
    H7_I2C1->CR2 = ((uint32_t)addr7 << 1) | (1u << 16) | (1u << 13);
    if (h7_i2c_wait(H7_I2C_ISR_TXIS)) { return -1; }
    H7_I2C1->TXDR = reg;
    if (h7_i2c_wait(H7_I2C_ISR_TC)) { return -1; }
    if (H7_I2C1->ISR & H7_I2C_ISR_NACKF) { return -2; }

    /* 读阶段：1 字节，AUTOEND=1 自动发 STOP */
    H7_I2C1->CR2 = ((uint32_t)addr7 << 1) | (1u << 16) | (1u << 10)
                 | (1u << 13) | (1u << 25);
    if (h7_i2c_wait(H7_I2C_ISR_RXNE)) { return -1; }
    uint8_t received = (uint8_t)H7_I2C1->RXDR;
    if (h7_i2c_wait(1u << 5)) { return -1; } /* STOPF：等 AUTOEND 真正结束 */
    H7_I2C1->ICR = 1u << 5;                 /* STOPCF */
    *val = received;
    return 0;
}
