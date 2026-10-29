/* host_search.c —— 二分查找与标定表线性插值（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_search.c -o host_search && ./host_search
 */
#include <stdio.h>
static int bsearch_int(const int *a, int n, int key) { int lo=0, hi=n-1; while (lo<=hi){ int m=(lo+hi)/2; if(a[m]==key) return m; if(a[m]<key) lo=m+1; else hi=m-1; } return -1; }
/* 标定点 (x,y) 线性插值 */
static float interp(const float *x, const float *y, int n, float xi) {
    if (xi <= x[0]) return y[0];
    if (xi >= x[n-1]) return y[n-1];
    for (int i = 0; i < n-1; i++)
        if (xi >= x[i] && xi <= x[i+1])
            return y[i] + (y[i+1]-y[i]) * (xi-x[i]) / (x[i+1]-x[i]);
    return y[n-1];
}
int main(void) {
    int ok = 1;
    int a[] = {1,3,5,7,9,11};
    printf("查找 7 → 下标 %d（期望 3）\n", bsearch_int(a,6,7));
    if (bsearch_int(a,6,7) != 3) ok = 0;
    printf("查找 4 → %d（期望 -1）\n", bsearch_int(a,6,4));
    if (bsearch_int(a,6,4) != -1) ok = 0;
    float x[] = {0,10,20}, y[] = {0,100,300};
    float v = interp(x,y,3,15);
    printf("插值 x=15 → %.1f（期望 200.0）\n", v);
    if (v < 199.9f || v > 200.1f) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
