/* capstone_node.c — B05 贯穿项目：电池供电环境采集节点（控制器骨架）
 * 串联 M01 时钟、M04 定时、M05/M06 ADC+DMA、M07 UART、M10 看门狗/低功耗、M13 存储。
 * 只做单文件编译（-c）；外设函数在对应模块中实现，此处用原型引用。 */
#include "stm32f103_regs.h"

/* 其它模块提供的接口（原型，便于单独编译本文件） */
extern uint32_t clock_init_72m(void);
extern void     systick_init_1ms(uint32_t sysclk_hz);
extern void     adc_dma_start(uint16_t *buf, uint16_t len);
extern void     iwdg_init(uint16_t reload);
extern void     iwdg_feed(void);
extern void     enter_stop_mode(void);
extern void     backup_marker_write(uint32_t marker);
extern int      uart_rb_pop(void *rb, uint8_t *out);

/* 与 M13 一致的块设备类型；g_log_dev 由存储模块提供 */
typedef struct {
    int      (*read)(uint32_t block, void *buf);
    int      (*write)(uint32_t block, const void *buf);
    int      (*erase)(uint32_t block);
    uint32_t block_size;
} blk_dev_t;
extern blk_dev_t g_log_dev;
extern int log_append(blk_dev_t *dev, uint32_t block, uint32_t seq,
                      const void *payload, uint32_t len);

extern volatile uint32_t g_systick_ms;

#define ADC_BUF_LEN 64u
static uint16_t s_adc_buf[ADC_BUF_LEN];
static uint32_t s_last_report_ms;

typedef struct {
    uint32_t boot_marker;
    uint16_t sample_period_ms;
    uint32_t report_period_ms;     /* 用 uint16 会溢出（600000→10176），这是 -Woverflow 抓到的真实 bug */
    uint32_t watchdog_reload;
} node_cfg_t;

static const node_cfg_t g_cfg = {
    .sample_period_ms = 10u,
    .report_period_ms = 600000u,   /* 每 10 分钟上报一次 */
    .watchdog_reload  = 3000u,     /* ~4.8 s 超时 */
};

/* 初始化：失败即返回，绝不带着半初始化硬件继续跑 */
int node_init(void)
{
    if (clock_init_72m() == 0u) {
        return -1;                 /* HSE 起振失败 */
    }
    systick_init_1ms(72000000u);
    backup_marker_write(0x0BADF00Du);
    iwdg_init((uint16_t)g_cfg.watchdog_reload);
    adc_dma_start(s_adc_buf, ADC_BUF_LEN);
    return 0;
}

/* 主循环：非阻塞调度，采集与上报解耦 */
void node_loop(void)
{
    for (;;) {
        iwdg_feed();               /* 只有走到这里才喂狗：卡死则复位 */

        if ((uint32_t)(g_systick_ms - s_last_report_ms) >= g_cfg.report_period_ms) {
            s_last_report_ms = g_systick_ms;
            uint32_t avg = 0u;
            for (uint32_t i = 0u; i < ADC_BUF_LEN; ++i) {
                avg += s_adc_buf[i];
            }
            avg /= ADC_BUF_LEN;
            uint16_t mv = (uint16_t)(avg * 3300u / 4095u);
            /* 记录一条并进入 STOP，由 RTC/EXTI 唤醒 */
            (void)log_append(&g_log_dev, 0u, g_systick_ms, &mv, sizeof(mv));
            enter_stop_mode();
        }
    }
}
