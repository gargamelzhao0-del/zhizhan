/* host_dft.c —— DFT 幅度与峰值检测（N=8）（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_dft.c -o host_dft -lm && ./host_dft
 */
#include <stdio.h>
#include <math.h>
int main(void) {
    int ok = 1;
    int N = 8;
    double x[8];
    for (int n=0;n<N;n++) x[n] = cos(2*3.14159265358979*2*n/N);   /* 频率 bin=2 */
    int peak = 0; double pmax = 0;
    for (int k=0;k<N;k++) {
        double re=0, im=0;
        for (int n=0;n<N;n++){ re += x[n]*cos(2*3.14159265358979*k*n/N); im -= x[n]*sin(2*3.14159265358979*k*n/N); }
        double mag = sqrt(re*re+im*im);
        if (mag > pmax) { pmax = mag; peak = k; }
    }
    printf("峰值 bin=%d（期望 2）幅度=%.2f\n", peak, pmax);
    if (peak != 2) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
