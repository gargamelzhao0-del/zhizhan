/* esp_m05_pid.c —— ESP32 速度环 + LEDC PWM（Xtensa）。 */
#include "esp_app.h"
#include "pid_api.h"

static pid_t g_pid = { 8.0f, 0.5f, 0.1f, 0.0f, 0.0f };

int esp_motor_ctrl(float sp, float speed, float dt) {
    int duty = pid_step(&g_pid, sp, speed, dt, 0, 1023);
    ledc_set_duty(0, 0, (uint32_t)duty);
    ledc_update_duty(0, 0);
    return duty;
}
