/* esp_m14_usb.c — ESP32 的 USB：经典 ESP32 无原生 USB 设备控制器
 * 与 STM32/H7 自带 USB 外设不同：
 *   · 经典 ESP32：只有 UART 桥（外置 USB-UART 芯片），不是真 USB 设备；
 *   · ESP32-S2/S3/C3 等：有内置 USB Serial/JTAG 或全速 USB-OTG，可跑 TinyUSB/CDC。 */
#include <stdint.h>

typedef struct __attribute__((packed)) {
    uint8_t  bLength;
    uint8_t  bDescriptorType;
    uint16_t bcdUSB;
    uint8_t  bDeviceClass;
    uint8_t  bDeviceSubClass;
    uint8_t  bDeviceProtocol;
    uint8_t  bMaxPacketSize0;
    uint16_t idVendor;
    uint16_t idProduct;
    uint16_t bcdDevice;
    uint8_t  iManufacturer;
    uint8_t  iProduct;
    uint8_t  iSerialNumber;
    uint8_t  bNumConfigurations;
} esp_usb_device_desc_t;

/* 在支持 USB 的型号上，TinyUSB 暴露 tud_* 回调与描述符表；结构与 STM32 等价 */
static const esp_usb_device_desc_t g_esp_dev = {
    .bLength = sizeof(esp_usb_device_desc_t), .bDescriptorType = 0x01u,
    .bcdUSB = 0x0200u, .bDeviceClass = 0x02u, .bMaxPacketSize0 = 64u,
    .idVendor = 0x303Au, .idProduct = 0x4002u, .bNumConfigurations = 1u
};

const esp_usb_device_desc_t *esp_usb_descriptor(void) { return &g_esp_dev; }

/* 经典 ESP32 的“替代实验”：用 UART0 经外置桥做虚拟串口，功能等价但非 USB 设备本身 */
int esp_uart_bridge_available(void) { return 1; }
