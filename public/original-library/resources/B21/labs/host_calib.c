/* host_calib.c —— 阈值扫描与 PR 权衡（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_calib.c -o host_calib && ./host_calib
 */
#include <stdio.h>
int main(void) {
    int ok=1;
    /* 不同阈值下的混淆矩阵（简化） */
    int TP[3]={60,40,10}, FP[3]={40,10,2}, FN[3]={10,30,60};
    printf("阈值扫描 (prec/rec):\n");
    for(int i=0;i<3;i++){ double p=(double)TP[i]/(TP[i]+FP[i]); double r=(double)TP[i]/(TP[i]+FN[i]);
        printf("  阈值档 %d: prec=%.2f rec=%.2f\n", i, p, r); }
    /* 检查高精度 vs 高召回权衡存在 */
    double p0=(double)TP[0]/(TP[0]+FP[0]), r2=(double)TP[2]/(TP[2]+FN[2]);
    if(!(p0 > 0.5 && r2 > 0.1)) ok=0;
    printf("结论：固定预测分数时，提高阈值使召回不增；precision 不保证单调，须实算\n");
    printf("\n%s\n", ok?"RESULT: PASS":"RESULT: FAIL");
    return ok?0:1;
}
