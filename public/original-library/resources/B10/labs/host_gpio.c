/* Host resource state machine only. model_* functions are NOT Linux APIs.
 * This model keeps an object alive after model_put to check logical misuse.
 * A real descriptor must never be used after gpiod_put. Real gpiod_get errors
 * use ERR_PTR/IS_ERR, not this model's NULL. MMIO with a disabled clock may
 * fault, hang, or behave differently on different SoCs. */
#include <stdio.h>
#include <string.h>

#define ENODEV 19    /* 资源不可用（未使能 / 已释放） */
#define ENOENT  2    /* 设备树中找不到该资源 */

typedef struct { int in_use; } gpio_desc;
typedef struct { int enabled; } clk;

static int g_led_value = 0;

/* 申请 GPIO 描述符：只有设备树里存在的名字才成功 */
static gpio_desc *model_gpiod_get(const char *name) {
    if (strcmp(name, "led") != 0) return 0;   /* 无此资源 */
    static gpio_desc d;
    d.in_use = 1;
    return &d;
}
/* 设置输出电平：未申请或已释放一律拒绝 */
static int model_gpiod_set_value(gpio_desc *d, int v) {
    if (!d || !d->in_use) return -ENODEV;     /* use-after-put 被拒 */
    g_led_value = v;
    return 0;
}
static void model_gpiod_put(gpio_desc *d) { if (d) d->in_use = 0; }

static int model_clk_prepare_enable(clk *c) { c->enabled = 1; return 0; }
static void model_clk_disable_unprepare(clk *c) { c->enabled = 0; }
/* 读外设寄存器：时钟未使能时访问非法 */
static int model_reg_read(clk *c) { return c->enabled ? 0 : -ENODEV; }

int main(void) {
    int ok = 1;
    gpio_desc *led = model_gpiod_get("led");
    clk uart = {0};

    printf("model_gpiod_get(\"led\")=%s\n", led ? "ok" : "NULL");
    if (!led) ok = 0;

    if (model_gpiod_set_value(led, 1) != 0) ok = 0;
    printf("model_gpiod_set_value(1) → value=%d\n", g_led_value);
    if (g_led_value != 1) ok = 0;

    printf("clk 未 enable 访问寄存器 → %d（期望 -%d）\n", model_reg_read(&uart), ENODEV);
    if (model_reg_read(&uart) != -ENODEV) ok = 0;

    model_clk_prepare_enable(&uart);
    printf("clk enable 后访问寄存器 → %d（期望 0）\n", model_reg_read(&uart));
    if (model_reg_read(&uart) != 0) ok = 0;
    model_clk_disable_unprepare(&uart);

    model_gpiod_put(led);
    printf("model_gpiod_put 后 set_value → %d（期望 -%d，use-after-put 被拒）\n",
           model_gpiod_set_value(led, 0), ENODEV);
    if (model_gpiod_set_value(led, 0) != -ENODEV) ok = 0;

    printf("model_gpiod_get(\"missing\")=%s → -%d\n",
           model_gpiod_get("missing") ? "ok" : "NULL", ENOENT);
    if (model_gpiod_get("missing") != 0) ok = 0;

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
