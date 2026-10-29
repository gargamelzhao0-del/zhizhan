/* host_train.c —— 梯度下降训练一个标量参数（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_train.c -o host_train && ./host_train
 */
#include <stdio.h>
int main(void) {
    int ok = 1;
    /* 拟合 y=w x，样本 (1,2),(2,4),(3,6) → w→2；损失 MSE */
    double xs[]={1,2,3}, ys[]={2,4,6}; int n=3;
    double w=0, lr=0.03;
    for (int ep=0; ep<2000; ep++) {
        double g=0; for(int i=0;i<n;i++){ double e=w*xs[i]-ys[i]; g+=2*e*xs[i]; }
        g/=n; w -= lr*g;
    }
    printf("训练后 w=%.4f（期望 2.0000）\n", w);
    if (w<1.999||w>2.001) ok=0;
    printf("\n%s\n", ok?"RESULT: PASS":"RESULT: FAIL");
    return ok?0:1;
}
