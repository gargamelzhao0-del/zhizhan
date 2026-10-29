/* h7_m05_pid.c —— H7 速度环 + 定时器 PWM + 编码器（Cortex-M7）。 */
#include "pid_api.h"
#include "stm32_app.h"

static pid_t g_pid = { 8.0f, 0.5f, 0.1f, 0.0f, 0.0f };

int h7_motor_ctrl(float sp, float speed, float dt) {
    int d = pid_step(&g_pid, sp, speed, dt, 0, 1000);
    TIM2_CCR1 = (uint32_t)d * (TIM2_ARR + 1u) / 1000u;   /* 千分比 → 比较值 */
    return d;
}
