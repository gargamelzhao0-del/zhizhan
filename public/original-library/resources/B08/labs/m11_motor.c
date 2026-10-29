/* m11_motor.c —— 综合项目 B：电机运动控制（Cortex-M3）。
 * 保护优先：限位/过流一触发立即停输出，再谈控制。 */
#include "app_api.h"
#include "pid_api.h"

static pid_t g_pid = { 8.0f, 0.5f, 0.1f, 0.0f, 0.0f };

int motor_tick(float sp, float speed, float dt, int limit_hit, int overcurrent) {
    if (limit_hit || overcurrent) {           /* 安全动作：先关输出并锁存 */
        (void)motor_set_pwm(0);
        return 0;
    }
    int d = pid_step(&g_pid, sp, speed, dt, 0, 1000);
    (void)motor_set_pwm(d);
    return d;
}
