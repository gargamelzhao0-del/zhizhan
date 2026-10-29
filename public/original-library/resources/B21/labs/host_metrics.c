/* host_metrics.c —— 分类指标与阈值权衡（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_metrics.c -o host_metrics -lm && ./host_metrics
 */
#include <stdio.h>
#include <math.h>
int main(void) {
    int ok=1;
    int TP=40,FP=10,FN=5,TN=45;
    double prec=(double)TP/(TP+FP), rec=(double)TP/(TP+FN);
    double f1=2*prec*rec/(prec+rec);
    printf("precision=%.3f recall=%.3f F1=%.3f\n",prec,rec,f1);
    if(fabs(prec-0.8)>1e-3||fabs(f1-0.8421)>1e-3) ok=0;
    printf("漏报率=%.3f 误报率=%.3f（按业务调阈值）\n",(double)FN/(TP+FN),(double)FP/(FP+TN));
    printf("\n%s\n", ok?"RESULT: PASS":"RESULT: FAIL");
    return ok?0:1;
}
