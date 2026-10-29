/* ESP-IDF 6.0 I2C 主机 API；组件依赖 esp_driver_i2c。
 * dev 来自已配置总线上的 i2c_master_bus_add_device；器件地址在设备配置中设置。
 * 只支持同步模式（未注册异步回调），缓冲区在调用返回前有效。
 * 此文件是 SDK 函数片段；构建入口见 B06，I2C 接线和故障恢复仍须目标板验证。 */
#include <stdint.h>
#include <stddef.h>
#include "driver/i2c_master.h"
#include "esp_err.h"

esp_err_t esp_i2c_read_reg(i2c_master_dev_handle_t dev, uint8_t reg, uint8_t *val)
{
    if (dev == NULL || val == NULL) return ESP_ERR_INVALID_ARG;
    uint8_t received = 0;
    /* 写寄存器地址后重复 START，再读一个字节；100 是毫秒，不是 RTOS tick。 */
    esp_err_t err = i2c_master_transmit_receive(dev, &reg, 1, &received, 1, 100);
    if (err == ESP_OK) *val = received; /* 失败时不提交不完整结果 */
    return err;
}
