/* host_irqhalf.c —— 中断上半部/下半部（bottom half）模型（主机可运行）。
 *
 * 硬中断（上半部）必须极短：只清标志、取数据、调度下半部；重活留给 tasklet/workqueue。
 * 本程序验证：ISR 只执行 1 步且只登记下半部；下半部在 ISR 返回后才运行。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_irqhalf.c -o host_irqhalf && ./host_irqhalf
 */
#include <stdio.h>
#include <string.h>

static int g_irq_steps = 0, g_bh_runs = 0, g_pending = 0;
static int g_in_isr = 0;
static char g_trace[64]; static int g_tl = 0;
static void trace(const char *s) { g_tl += sprintf(g_trace + g_tl, "%s ", s); }

/* 上半部：极短 */
static void hard_irq(void) {
    g_in_isr = 1; trace("IRQ");
    g_irq_steps++;                 /* 只做一步：读数据/清标志 */
    g_pending = 1;                 /* 调度下半部 */
    g_in_isr = 0;
}
/* 下半部：在 ISR 返回后运行 */
static void bh_run(void) {
    if (!g_pending || g_in_isr) return;
    g_pending = 0; g_bh_runs++; trace("BH");
}

int main(void) {
    int ok = 1;
    hard_irq();
    printf("ISR 后：pending=%d bh_runs=%d（下半部尚未运行）\n", g_pending, g_bh_runs);
    if (!(g_pending == 1 && g_bh_runs == 0)) ok = 0;

    bh_run();                      /* 调度器在稍后运行下半部 */
    printf("调度后：pending=%d bh_runs=%d  trace=\"%s\"\n", g_pending, g_bh_runs, g_trace);
    if (!(g_pending == 0 && g_bh_runs == 1)) ok = 0;
    if (strcmp(g_trace, "IRQ BH ") != 0) ok = 0;      /* 顺序：先上半部后下半部 */

    printf("ISR 步数=%d（期望 1，必须是极短）\n", g_irq_steps);
    if (g_irq_steps != 1) ok = 0;

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
