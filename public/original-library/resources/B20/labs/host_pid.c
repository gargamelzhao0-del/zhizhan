/* host_pid.c —— PID 与执行器约束（限幅/抗饱和）（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_pid.c -o host_pid && ./host_pid
 */
#include <stdio.h>
int main(void) {
    int ok = 1;
    double kp=2, ki=0.5, I=0, hi=10, lo=0;
    double set=5, y=0, dt=0.1; int aw=1;
    for (int i=0;i<200;i++) {
        double e = set - y;
        double u = kp*e + ki*I;
        int sat = 0;
        if (u > hi) { u = hi; sat = 1; }
        if (u < lo) { u = lo; sat = -1; }
        if (!(aw && sat && ((sat>0&&e>0)||(sat<0&&e<0)))) I += e*dt;
        y += dt*(u - y);                 /* 一阶对象 */
    }
    printf("最终 y=%.3f（期望 ~5）输出限幅 [%.0f,%.0f]\n", y, lo, hi);
    if (y < 4.5 || y > 5.5) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
