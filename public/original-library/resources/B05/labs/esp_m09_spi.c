/* esp_m09_spi.c — ESP32 SPI：时钟来自 APB，常用 spi_device_transmit 一次事务
 * ESP32 的 SPI 有 1..4 号控制器，SPI2/3 常作主模式接 Flash/传感器。 */
#include <stdint.h>

extern int spi_bus_initialize(int host, const void *cfg, int dma_chan);
extern int spi_bus_add_device(int host, const void *cfg, void **out_dev);
extern int spi_device_transmit(void *dev, void *trans);
extern int spi_bus_remove_device(void *dev);

int esp_spi1_xfer(void *dev, void *trans)
{
    return spi_device_transmit(dev, trans);   /* trans 里指定 tx_buffer/rx_buffer/length */
}

/* 与 STM32 的关键差异：ESP32 的片选、时钟相位/极性、位序都在 bus/device 配置结构里，
 * 且可走 GPIO Matrix 把 SPI 信号映射到任意可用引脚。 */
int esp_spi_bus_up(int host, const void *buscfg)
{
    return spi_bus_initialize(host, buscfg, 1);   /* dma_chan */
}
