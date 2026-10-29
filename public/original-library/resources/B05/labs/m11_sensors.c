/* m11_sensors.c — B05-M11 传感器驱动实战（分层：总线层 / 器件层 / 服务层）
 * 用函数指针注入总线，使器件层可脱离具体 I²C 硬件、可在主机上 mock 测试。 */
#include <stdint.h>
#include <stddef.h>

/* ---- 总线层：只承诺“读一个寄存器” ---- */
typedef struct {
    int (*read_reg)(uint8_t addr7, uint8_t reg, uint8_t *out);
} i2c_bus_t;

/* ---- 器件层：知道 WHO_AM_I 与量程寄存器，不关心总线怎么实现 ---- */
typedef struct {
    i2c_bus_t bus;
    uint8_t   addr7;
    uint8_t   who;
} imu_t;

#define MPU6050_ADDR      0x68u
#define MPU6050_WHO_AM_I  0x75u
#define MPU6050_WHO_VALUE 0x68u

int imu_probe(imu_t *dev)
{
    if (dev == NULL || dev->bus.read_reg == NULL) {
        return -1;
    }
    uint8_t who = 0u;
    if (dev->bus.read_reg(dev->addr7, MPU6050_WHO_AM_I, &who) != 0) {
        return -2;                 /* 总线错误 */
    }
    dev->who = who;
    return (who == MPU6050_WHO_VALUE) ? 0 : -3;  /* -3：器件型号不符 */
}

/* ---- 服务层：一次“读温度”，带错误码与量纲换算 ---- */
typedef enum {
    SVC_OK = 0,
    SVC_ERR_BUS,
    SVC_ERR_NOT_READY
} svc_err_t;

typedef struct {
    svc_err_t (*read_temp_c10)(void *dev, int16_t *temp_c10);
} temp_service_t;

typedef struct {
    imu_t imu;
    int   probed;
} env_node_t;

static svc_err_t imu_read_temp_c10(void *ctx, int16_t *temp_c10)
{
    env_node_t *node = (env_node_t *)ctx;
    if (node == NULL || !node->probed) {
        return SVC_ERR_NOT_READY;
    }
    uint8_t hi = 0u, lo = 0u;
    if (node->imu.bus.read_reg(node->imu.addr7, 0x41u, &hi) != 0 ||
        node->imu.bus.read_reg(node->imu.addr7, 0x42u, &lo) != 0) {
        return SVC_ERR_BUS;
    }
    int16_t raw = (int16_t)(((int16_t)hi << 8) | lo);
    /* MPU6050 温度灵敏度 340 LSB/°C，零点约 36.53 °C。
     * c10 为“十分之一度”：c10 = raw×10/340 + 365 ≈ raw/34 + 365。 */
    *temp_c10 = (int16_t)(raw / 34 + 365);
    return SVC_OK;
}

temp_service_t env_temp_service(env_node_t *node)
{
    temp_service_t svc = { imu_read_temp_c10 };
    (void)node;
    return svc;
}
