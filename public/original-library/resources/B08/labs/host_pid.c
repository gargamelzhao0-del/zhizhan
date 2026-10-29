/* host_pid.c —— 离散 PID 与积分抗饱和（主机可运行）。
 *
 * 被控对象：一阶加热模型 y' = (K·u − y)/tau，u∈[0,1]，K=100 → u=0.5 时稳态 50℃。
 * 对比：关闭抗饱和时执行器饱和期间积分无界累积（windup），回落设定后大幅超调；
 *       开启抗饱和（饱和且误差同号时停止积分）后积分有界、回落平顺。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_pid.c -o host_pid && ./host_pid
 */
#include <stdio.h>

typedef struct { double kp, ki; double I, last_e; int use_aw; } pid_t;

static double pid_step(pid_t *p, double sp, double y, double dt, int *sat) {
    double e = sp - y;
    double P = p->kp * e;
    double u = P + p->ki * p->I;          /* I = ∫e dt（积分状态） */
    *sat = 0;
    if (u > 1.0) { u = 1.0; *sat = 1; }
    if (u < 0.0) { u = 0.0; *sat = -1; }
    /* 抗饱和：饱和且误差会把执行器推得更满时，停止积分 */
    int freeze = p->use_aw && (*sat != 0) && ((*sat > 0 && e > 0) || (*sat < 0 && e < 0));
    if (!freeze) p->I += e * dt;
    p->last_e = e;
    return u;
}

static void run(int use_aw, double sp1, double sp2, double *peak_I, double *max_y_after2, int *within) {
    pid_t p = {0.03, 0.02, 0.0, 0.0, use_aw};
    double y = 0.0, dt = 0.05, K = 100.0, tau = 8.0, peak = 0.0, after2max = 0.0;
    int i, sat;
    for (i = 0; i < 400; i++) {                 /* 阶段 1：设定 sp1（可能不可达→饱和） */
        double u = pid_step(&p, sp1, y, dt, &sat);
        y += dt * (K * u - y) / tau;
        if (p.I > peak) peak = p.I;
    }
    for (i = 0; i < 400; i++) {                 /* 阶段 2：回落到 sp2 */
        double u = pid_step(&p, sp2, y, dt, &sat);
        y += dt * (K * u - y) / tau;
        if (y > after2max) after2max = y;
        if (p.I > peak) peak = p.I;
    }
    *peak_I = peak;
    *max_y_after2 = after2max;
    *within = (y > sp2 - 2.0 && y < sp2 + 2.0);
}

int main(void) {
    double peak_on, peak_off, ymax_on, ymax_off;
    int ok_on, ok_off;
    run(1, 150.0, 40.0, &peak_on, &ymax_on, &ok_on);    /* 开抗饱和 */
    run(0, 150.0, 40.0, &peak_off, &ymax_off, &ok_off); /* 关抗饱和 */

    printf("设定 150 不可达（执行器上限），再回落到 40：\n");
    printf("  开抗饱和：峰值积分=%.1f  回落后峰值 y=%.1f  最终在 40±2 内=%d\n", peak_on, ymax_on, ok_on);
    printf("  关抗饱和：峰值积分=%.1f  回落后峰值 y=%.1f  最终在 40±2 内=%d\n", peak_off, ymax_off, ok_off);

    int ok = 1;
    if (!ok_on) ok = 0;
    if (!(peak_off > peak_on * 1.5)) ok = 0;    /* 无抗饱和积分明显更大 */
    if (!(ymax_off > ymax_on + 2.0)) ok = 0;    /* 无抗饱和回落超调更大 */
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
