/* host_keys.c —— 按键语义：消抖 + 短按/长按/双击（主机可运行）。
 *
 * 输入是按 tick 采样的原始电平（1=按下）。先做消抖，再按“按下时长/两次间隔”分类。
 * 本程序用手工波形验证分类结果与期望一致，并验证毛刺被消抖吃掉。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_keys.c -o host_keys && ./host_keys
 */
#include <stdio.h>
#include <stdint.h>
#include <string.h>

#define TICKS 320
#define DEBOUNCE 3
#define LONG_TICKS 50     /* 持续 >=500ms(10ms/tick) 判长按 */
#define DOUBLE_GAP 30     /* 两次按下间隔 <300ms 判双击 */

typedef struct { int start, end; } press_t;
typedef enum { EV_SHORT, EV_LONG, EV_DOUBLE, EV_NONE } ev_t;
static const char *EVNAME[4] = {"SHORT", "LONG", "DOUBLE", "NONE"};

int main(void) {
    /* 波形：毛刺(2..3) 短按(5..14) 长按(100..169) 双击(200..209 与 220..229) */
    uint8_t sig[TICKS]; memset(sig, 0, sizeof(sig));
    for (int t = 2; t <= 3; t++) sig[t] = 1;              /* 毛刺：< 消抖阈值 */
    for (int t = 5; t <= 14; t++) sig[t] = 1;             /* 短按 10 tick */
    for (int t = 100; t <= 169; t++) sig[t] = 1;          /* 长按 70 tick */
    for (int t = 200; t <= 209; t++) sig[t] = 1;          /* 双击第一下 */
    for (int t = 220; t <= 229; t++) sig[t] = 1;          /* 双击第二下 */

    /* 消抖 + 提取按下区间 */
    press_t pr[8]; int np = 0;
    int stable = 0, count = 0, start = -1;
    for (int t = 0; t < TICKS; t++) {
        if (sig[t] != stable) count++;
        else count = 0;
        if (count >= DEBOUNCE) {
            stable = sig[t];
            if (stable && start < 0) start = t;           /* 确认按下 */
            if (!stable && start >= 0 && np < 8) { pr[np].start = start; pr[np].end = t; np++; start = -1; }
        }
    }

    /* 分类：先按时长，再把相邻两个短按合并为双击 */
    ev_t ev[8]; int ne = 0;
    for (int i = 0; i < np; i++) {
        int dur = pr[i].end - pr[i].start;
        if (dur >= LONG_TICKS) ev[ne++] = EV_LONG;
        else if (i > 0 && (pr[i].start - pr[i - 1].end) < DOUBLE_GAP && ev[ne - 1] == EV_SHORT) {
            ev[ne - 1] = EV_DOUBLE;                        /* 与上一个短按合并 */
        } else ev[ne++] = EV_SHORT;
    }

    printf("按下区间=%d：", np);
    for (int i = 0; i < np; i++) printf("[%d,%d] ", pr[i].start, pr[i].end);
    printf("\n识别事件=%d：", ne);
    for (int i = 0; i < ne; i++) printf("%s ", EVNAME[ev[i]]);
    printf("\n");

    int ok = 1;
    if (np != 4) ok = 0;                                  /* 毛刺被消抖，剩 4 次真实按下 */
    if (ne != 3) ok = 0;
    if (!(ev[0] == EV_SHORT && ev[1] == EV_LONG && ev[2] == EV_DOUBLE)) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
