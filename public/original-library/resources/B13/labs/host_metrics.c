/* host_metrics.c —— 分类指标：混淆矩阵 → precision/recall/F1（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_metrics.c -o host_metrics && ./host_metrics
 */
#include <stdio.h>
#include <math.h>
int main(void) {
    int ok = 1;
    /* TP=40 FP=10 FN=5 TN=45 */
    int TP=40, FP=10, FN=5, TN=45;
    float prec = (float)TP/(TP+FP);
    float rec = (float)TP/(TP+FN);
    float f1 = 2*prec*rec/(prec+rec);
    float acc = (float)(TP+TN)/(TP+FP+FN+TN);
    printf("precision=%.3f recall=%.3f F1=%.3f acc=%.3f\n", prec, rec, f1, acc);
    if (fabsf(prec-0.8f) > 1e-3 || fabsf(rec-0.8889f) > 1e-3) ok = 0;
    if (fabsf(f1-0.8421f) > 1e-3 || fabsf(acc-0.85f) > 1e-3) ok = 0;
    printf("漏报率(FN rate)=%.3f 误报率(FP rate)=%.3f（按业务权衡阈值）\n", (float)FN/(TP+FN), (float)FP/(FP+TN));
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
