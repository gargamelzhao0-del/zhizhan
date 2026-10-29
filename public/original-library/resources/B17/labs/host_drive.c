/* host_drive.c —— 执行器驱动：续流保护与驱动电流校核（主机可运行）。
 * 感性负载（继电器/电机）关断需续流二极管钳位反峰；驱动电流超过 GPIO 上限须加三极管/MOS。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_drive.c -o host_drive && ./host_drive
 */
#include <stdio.h>
int main(void) {
    int ok = 1;
    /* 5V 继电器线圈 R=120Ω → 稳态电流 */
    float vs = 5.0f, rcoil = 120.0f;
    float icoil = vs / rcoil;
    printf("线圈 5V/120Ω → 稳态电流=%.1fmA（期望 ~41.7）\n", icoil * 1000.0f);
    if (icoil < 0.040f || icoil > 0.043f) ok = 0;
    /* GPIO 典型灌/拉上限 8mA，直驱线圈不够 */
    float gpio_max = 0.008f;
    int need_stage = icoil > gpio_max;
    printf("GPIO 上限 8mA < 线圈 %.1fmA → 须三极管/MOS 驱动=%d（期望 1）\n",
           icoil * 1000.0f, need_stage);
    if (!need_stage) ok = 0;
    /* 续流二极管把关断反峰钳位到正向压降，避免击穿驱动级 */
    float vf = 0.7f;
    printf("续流二极管钳位关断反峰 → %.1fV（无续流则反峰击穿驱动级）\n", vf);
    if (vf <= 0) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
