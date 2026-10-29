/* host_power.c —— 功耗预算与续航估算（主机可运行）。
 *
 * 平均电流 = Σ(外设工作电流 × 占空比)。续航 = 电池容量 / 平均电流。
 * 关键认知：占空比与“常开”外设主导平均电流，而不是峰值电流。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_power.c -o host_power && ./host_power
 */
#include <stdio.h>
#include <stdint.h>

typedef struct { const char *name; uint32_t active_ua; uint32_t duty_permille; } item_t;

static uint32_t avg_uA(const item_t *it, int n) {
    uint64_t sum = 0;
    for (int i = 0; i < n; i++) sum += (uint64_t)it[i].active_ua * it[i].duty_permille;
    return (uint32_t)(sum / 1000u);
}
static uint32_t life_days(uint32_t cap_mah, uint32_t ua) {
    if (ua == 0) return 0xFFFFFFFFu;
    uint64_t uah = (uint64_t)cap_mah * 1000u;      /* mAh → uAh */
    return (uint32_t)(uah / ua / 24u);             /* 小时 → 天 */
}

int main(void) {
    /* 低功耗配置：MCU 50‰、无线 5‰、传感器 10‰、睡眠常开 5µA */
    item_t good[] = {
        {"MCU",   3000, 50}, {"Radio", 20000, 5}, {"Sensor", 500, 10}, {"Sleep", 5, 1000}
    };
    /* 反面配置：无线常开 */
    item_t bad[]  = {
        {"MCU",   3000, 1000}, {"Radio", 20000, 1000}, {"Sensor", 500, 1000}, {"Sleep", 5, 1000}
    };
    uint32_t g = avg_uA(good, 4), b = avg_uA(bad, 4);
    uint32_t days_g = life_days(3000, g), days_b = life_days(3000, b);
    printf("低功耗配置平均电流 = %u µA  → 3000mAh 续航 %u 天\n", g, days_g);
    printf("无线常开平均电流   = %u µA  → 3000mAh 续航 %u 天\n", b, days_b);

    int ok = 1;
    if (g != 260u) ok = 0;                     /* 150+100+5+5 */
    if (b != 23505u) ok = 0;                   /* 3000+20000+500+5 */
    if (days_g < 365u) ok = 0;                 /* 目标：单节电池一年 */
    if (!(days_b * 10u < days_g)) ok = 0;      /* 反面配置明显更短 */
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
