/* h7_m14_usb.c — STM32H7 USB OTG HS/FS：描述符结构与 F1 相同，控制器与 DMA 不同
 * H7 的 OTG_HS 可达 480Mbps（需 ULPI PHY），端点为 FIFO 模式，DMA 配置更复杂。 */
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
} h7_usb_device_desc_t;

static const h7_usb_device_desc_t g_h7_dev = {
    .bLength = sizeof(h7_usb_device_desc_t), .bDescriptorType = 0x01u,
    .bcdUSB = 0x0200u, .bDeviceClass = 0x02u, .bMaxPacketSize0 = 64u,
    .idVendor = 0x0483u, .idProduct = 0x5740u, .bNumConfigurations = 1u
};

/* OTG_HS 端点 FIFO 需要按字数分配；这是 F1（USB FS 固定缓冲）没有的一步 */
void h7_usb_ep_fifo_alloc(uint16_t *dfifo_words)
{
    uint16_t *p = dfifo_words;
    p[0] = 128u;   /* EP0 RX 字数（示意） */
    p[1] = 0u;
    p[2] = 64u;    /* EP1 TX */
}

const h7_usb_device_desc_t *h7_usb_descriptor(void) { return &g_h7_dev; }
