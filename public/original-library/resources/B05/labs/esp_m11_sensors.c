/* esp_m11_sensors.c — ESP32 上的传感器分层：总线层换成 IDF 的 i2c_master，
 * 器件层/服务层结构不变。ESP-IDF 用 esp_err_t 返回码，而不是全局 errno。 */
#include <stdint.h>
#include <stddef.h>

typedef int esp_err_t;
#define ESP_OK 0
#define ESP_FAIL -1

typedef struct {
    esp_err_t (*read_reg)(void *bus, uint8_t addr7, uint8_t reg, uint8_t *out);
} esp_i2c_bus_t;

typedef struct {
    void         *bus_ctx;
    esp_i2c_bus_t bus;
    uint8_t       addr7;
    uint8_t       who;
} esp_imu_t;

#define MPU6050_ADDR     0x68u
#define MPU6050_WHO_AM_I 0x75u

esp_err_t esp_imu_probe(esp_imu_t *dev)
{
    if (dev == NULL || dev->bus.read_reg == NULL) { return ESP_FAIL; }
    uint8_t who = 0u;
    if (dev->bus.read_reg(dev->bus_ctx, dev->addr7, MPU6050_WHO_AM_I, &who) != ESP_OK) {
        return -2;   /* 总线错误（示意：可用 ESP_ERR_TIMEOUT 等具体码） */
    }
    dev->who = who;
    return (who == MPU6050_ADDR) ? ESP_OK : -3;   /* -3：型号不符 */
}
