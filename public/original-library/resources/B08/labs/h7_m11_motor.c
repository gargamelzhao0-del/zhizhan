/* h7_m11_motor.c —— H7 电机控制：定时器 PWM + 保护（Cortex-M7）。 */
#include "stm32_app.h"
#include "pid_api.h"

static pid_t g_pid = { 8.0f, 0.5f, 0.1f, 0.0f, 0.0f };

int h7_motor_tick(float sp, float speed, float dt, int fault) {
    if (fault) { TIM2_CCR1 = 0u; return 0; }
    int d = pid_step(&g_pid, sp, speed, dt, 0, 1000);
    TIM2_CCR1 = (uint32_t)d * (TIM2_ARR + 1u) / 1000u;
    return d;
}
