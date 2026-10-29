/* m05_pid.c —— 离散 PID 与抗饱和（Cortex-M3）。 */
#include "app_api.h"
#include "pid_api.h"

int pid_step(pid_t *p, float sp, float y, float dt, int out_min, int out_max) {
    float e = sp - y;
    p->I += e * dt;                                   /* 积分 */
    float u = p->kp * e + p->ki * p->I + p->kd * (e - p->last_e) / dt;
    p->last_e = e;
    int uu = (int)u, sat = 0;
    if (uu > out_max) { uu = out_max; sat = 1; }
    if (uu < out_min) { uu = out_min; sat = -1; }
    if (sat && ((sat > 0 && e > 0) || (sat < 0 && e < 0))) p->I -= e * dt;  /* 抗饱和回退 */
    return uu;
}
