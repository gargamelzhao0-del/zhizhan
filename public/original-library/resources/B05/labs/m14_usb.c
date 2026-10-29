/* m14_usb.c — B05-M14 USB 与复杂外设入门
 * CDC 设备描述符 + 端点状态机骨架（不依赖 USB 协议栈，仅硬件相关的描述符与状态）。
 * 注意：描述符必须 __attribute__((packed))，否则编译器插入填充会破坏 bLength 链路。 */
#include <stdint.h>

#define USB_DT_DEVICE    0x01u
#define USB_DT_CONFIG    0x02u
#define USB_DT_STRING    0x03u
#define USB_DT_INTERFACE 0x04u
#define USB_DT_ENDPOINT  0x05u

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
} usb_device_desc_t;

typedef struct __attribute__((packed)) {
    uint8_t  bLength;
    uint8_t  bDescriptorType;
    uint8_t  bEndpointAddress;
    uint8_t  bmAttributes;
    uint16_t wMaxPacketSize;
    uint8_t  bInterval;
} usb_endpoint_desc_t;

static const usb_device_desc_t g_dev_desc = {
    .bLength = sizeof(usb_device_desc_t), .bDescriptorType = USB_DT_DEVICE,
    .bcdUSB = 0x0200u, .bDeviceClass = 0x02u /* CDC */, .bMaxPacketSize0 = 64u,
    .idVendor = 0x0483u, .idProduct = 0x5740u, .bcdDevice = 0x0100u,
    .bNumConfigurations = 1u
};

/* 端点收发状态：USB 是主机驱动的，设备只能在被轮询时响应，不能“主动发” */
typedef enum { EP_IDLE, EP_RX_READY, EP_TX_BUSY, EP_STALLED } ep_state_t;

typedef struct {
    ep_state_t state;
    uint16_t   rx_len;
    uint16_t   tx_len;
    uint8_t    buf[64];
} usb_ep_t;

void usb_ep_on_setup(usb_ep_t *ep, uint16_t len)
{
    if (len > sizeof(ep->buf)) {
        ep->state = EP_STALLED;      /* 超长请求：按规范回 STALL，而不是截断 */
        return;
    }
    ep->rx_len = len;
    ep->state = EP_RX_READY;
}

void usb_ep_clear_stall(usb_ep_t *ep) { ep->state = EP_IDLE; }

const usb_device_desc_t *usb_device_descriptor(void) { return &g_dev_desc; }
