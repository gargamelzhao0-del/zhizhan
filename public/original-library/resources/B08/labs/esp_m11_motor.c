/* esp_m11_motor.c —— ESP32 电机控制：LEDC + 保护（Xtensa）。 */
#include "esp_app.h"
#include "pid_api.h"

static pid_t g_pid = { 8.0f, 0.5f, 0.1f, 0.0f, 0.0f };

int esp_motor_tick(float sp, float speed, float dt, int fault) {
    if (fault) {
        ledc_set_duty(0, 0, 0u);
        ledc_update_duty(0, 0);
        return 0;
    }
    int d = pid_step(&g_pid, sp, speed, dt, 0, 1023);
    ledc_set_duty(0, 0, (uint32_t)d);
    ledc_update_duty(0, 0);
    return d;
}
