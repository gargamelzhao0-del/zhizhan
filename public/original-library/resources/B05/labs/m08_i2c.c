/* m08_i2c.c — B05-M08 STM32F103 单字节读取教学片段。
 * 前置：单控制器、独占 I2C1、已配置时钟/开漏引脚/CR2/CCR/TRISE，POS=0。
 * 计数上限只限制循环次数，不是毫秒期限；产品驱动须换成单调时钟期限。
 * 返回失败后禁止直接重试：调用者须检查线路、复位并重新初始化控制器。
 * 这里只展示寄存器顺序，未在本轮用目标板验证。 */
#include "stm32f103_regs.h"

#define I2C_TIMEOUT 100000u

static int i2c_wait_sr1(uint32_t mask, int want_set)
{
    for (uint32_t t = 0u; t < I2C_TIMEOUT; ++t) {
        if (((I2C1->SR1 & mask) != 0u) == (want_set != 0)) {
            return 0;
        }
    }
    return -1; /* 超时：总线可能被从机拉死 */
}

/* 从机 7 位地址 addr7，读其内部寄存器 reg */
int i2c1_read_reg(uint8_t addr7, uint8_t reg, uint8_t *val)
{
    if (addr7 > 0x7fu || val == 0) return -2;
    if (I2C1->SR2 & I2C_SR2_BUSY) return -3;
    I2C1->CR1 |= I2C_CR1_START;
    if (i2c_wait_sr1(I2C_SR1_SB, 1)) return -1;      /* 起始已发 */
    I2C1->DR = (uint32_t)(addr7 << 1);               /* 写地址 */
    if (i2c_wait_sr1(I2C_SR1_ADDR, 1)) return -1;
    (void)I2C1->SR2;                                 /* 读 SR2 清 ADDR */
    I2C1->DR = reg;
    /* 等 BTF（字节完全移出）再发重复起始；只等 TXE 可能在数据仍在总线上时过早发起，
     * 这是 F1 上“偶尔读错/收到 NACK”的隐蔽原因。 */
    if (i2c_wait_sr1(I2C_SR1_BTF, 1)) return -1;

    I2C1->CR1 |= I2C_CR1_START;                      /* 重复起始 */
    if (i2c_wait_sr1(I2C_SR1_SB, 1)) return -1;
    I2C1->DR = (uint32_t)((addr7 << 1) | 1u);        /* 读地址 */
    if (i2c_wait_sr1(I2C_SR1_ADDR, 1)) return -1;

    /* F1 单字节接收：ADDR 清除与 STOP 设置不能被中断打断；恢复原 PRIMASK。 */
    uint32_t primask;
    __asm volatile ("mrs %0, primask\n\tcpsid i" : "=r"(primask) :: "memory");
    I2C1->CR1 &= ~I2C_CR1_ACK;                       /* 单字节读：先 NACK */
    (void)I2C1->SR2;
    I2C1->CR1 |= I2C_CR1_STOP;
    __asm volatile ("msr primask, %0" :: "r"(primask) : "memory");
    if (i2c_wait_sr1(I2C_SR1_RXNE, 1)) return -1;
    *val = (uint8_t)I2C1->DR;
    return 0;
}

/* 只复位本机控制器，不产生 SCL 脉冲，也不能释放被从机持续拉低的线路。
 * 保持 PE=0；调用者须先处理占线，再重新配置 CR2/CCR/TRISE 等并使能外设。 */
void i2c1_controller_reset(void)
{
    I2C1->CR1 |= I2C_CR1_SWRST;
    b05_dsb();
    I2C1->CR1 &= ~I2C_CR1_SWRST;
    I2C1->CR1 &= ~I2C_CR1_PE;
}
