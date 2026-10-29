/* h7_m11_sensors.c — STM32H7 上的传感器分层：与 F1 同结构，但多两条 H7 专属约束
 * ① DMA 缓冲与 D-cache 一致性；② 外设时钟在 D2/D3 域，需先选内核时钟源。 */
#include <stdint.h>
#include <stddef.h>

typedef struct {
    int (*read_reg)(uint8_t addr7, uint8_t reg, uint8_t *out);
} i2c_bus_t;

typedef struct {
    i2c_bus_t bus;
    uint8_t   addr7;
    uint8_t   who;
} imu_t;

#define MPU6050_ADDR     0x68u
#define MPU6050_WHO_AM_I 0x75u

int h7_imu_probe(imu_t *dev)
{
    if (dev == NULL || dev->bus.read_reg == NULL) { return -1; }
    uint8_t who = 0u;
    if (dev->bus.read_reg(dev->addr7, MPU6050_WHO_AM_I, &who) != 0) { return -2; }
    dev->who = who;
    return (who == MPU6050_ADDR) ? 0 : -3;
}

/* 若 IMU 走高带宽 SPI + DMA：缓冲必须按 cache line 对齐，并在 DMA 前后做 clean/invalidate。
 * 分层不变，但“对齐与一致性”是 H7 新增的实现细节。 */
int h7_imu_dma_ok(void) { return 1; }
