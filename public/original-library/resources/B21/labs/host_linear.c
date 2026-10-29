/* host_linear.c —— 最小二乘线性回归（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_linear.c -o host_linear && ./host_linear
 */
#include <stdio.h>
int main(void) {
    int ok = 1;
    double x[]={0,1,2,3,4}, y[]={1,3,5,7,9};   /* y=2x+1 */
    int n=5; double sx=0,sy=0,sxx=0,sxy=0;
    for(int i=0;i<n;i++){sx+=x[i];sy+=y[i];sxx+=x[i]*x[i];sxy+=x[i]*y[i];}
    double w=(n*sxy-sx*sy)/(n*sxx-sx*sx), b=(sy-w*sx)/n;
    printf("拟合 y=%.3f x + %.3f（期望 2.000 1.000）\n", w, b);
    if (w<1.999||w>2.001||b<0.999||b>1.001) ok=0;
    printf("\n%s\n", ok?"RESULT: PASS":"RESULT: FAIL");
    return ok?0:1;
}
