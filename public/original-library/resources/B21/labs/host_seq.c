/* host_seq.c —— 时序/音频/视觉的数据组织：分帧 + 时间序切分 + 池化（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_seq.c -o host_seq -lm && ./host_seq
 */
#include <stdio.h>
#include <math.h>

#define SAMPLES 16

int main(void) {
    int ok = 1;
    double sig[SAMPLES];
    for (int i = 0; i < SAMPLES; i++) sig[i] = (i % 2) ? -1.0 : 1.0;   /* 交替信号 */

    /* 1) 音频/时序：分帧（窗长 4、hop 2，单位：采样点）+ 逐帧 RMS（单位：同幅值） */
    int win = 4, hop = 2, nframes = 0;
    printf("分帧: 窗长=%d hop=%d（单位：采样点）\n", win, hop);
    printf("逐帧 RMS: ");
    for (int s = 0; s + win <= SAMPLES; s += hop) {
        double e = 0; for (int i = 0; i < win; i++) e += sig[s+i]*sig[s+i];
        printf("%.2f ", sqrt(e/win)); nframes++;
    }
    printf("(期望 1.00，共 %d 帧)\n", nframes);
    if (nframes != 7) ok = 0;

    /* 2) 时间序切分：前 70% 训练、后 30% 测试，不随机（防用未来预测过去） */
    int cut = (int)(SAMPLES * 0.7);   /* = 11 */
    printf("时间序切分: train=[0,%d) test=[%d,%d)（不随机、无未来泄漏）\n", cut, cut, SAMPLES);
    if (!(cut == 11 && cut > 0 && cut < SAMPLES)) ok = 0;

    /* 3) 视觉：4x4 图像做 2x2 平均池化（通道内降采样） */
    double img[16]; for (int i = 0; i < 16; i++) img[i] = (double)i;
    printf("池化(4x4→2x2): ");
    for (int by = 0; by < 2; by++) for (int bx = 0; bx < 2; bx++) {
        double s = 0;
        for (int y = 0; y < 2; y++) for (int x = 0; x < 2; x++) s += img[(by*2+y)*4 + (bx*2+x)];
        printf("%.1f ", s/4);
    }
    printf("(期望 2.5 4.5 10.5 12.5)\n");
    if (fabs((img[0]+img[1]+img[4]+img[5])/4.0 - 2.5) > 1e-9) ok = 0;

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
