/* host_vec.c —— 线性代数与坐标变换：二维旋转矩阵（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_vec.c -o host_vec -lm && ./host_vec
 */
#include <stdio.h>
#include <math.h>
int main(void) {
    int ok = 1;
    double deg = 90.0, th = deg*3.14159265358979/180.0;
    double c = cos(th), s = sin(th);
    double x = 1, y = 0;
    double xr = c*x - s*y, yr = s*x + c*y;
    printf("旋转 (1,0) 90° → (%.3f, %.3f)（期望 (0,1)）\n", xr, yr);
    if (fabs(xr) > 1e-9 || fabs(yr-1.0) > 1e-9) ok = 0;
    /* 旋转矩阵正交：R^T R = I */
    double d = c*c + s*s;
    printf("R 正交性 c^2+s^2=%.3f（期望 1.000）\n", d);
    if (fabs(d-1.0) > 1e-9) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
