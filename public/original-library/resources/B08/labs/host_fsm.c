/* host_fsm.c —— 应用状态机：正常/降级/故障锁存（主机可运行）。
 *
 * 把界面的“模式”与业务的“状态”统一成一张显式状态机：
 *   BOOT → IDLE → RUN →（STOP）IDLE；RUN 遇 SENSOR_INVALID → FAULT（锁存）。
 * 关键规则：① 故障优先并锁存，必须显式 RESET 才能清除；② 非法的 (状态,事件) 组合被忽略，不改变状态。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_fsm.c -o host_fsm && ./host_fsm
 */
#include <stdio.h>
#include <string.h>

typedef enum { BOOT, IDLE, RUN, FAULT, SLEEP, NSTATE } state_t;
typedef enum { EV_START, EV_ARM, EV_STOP, EV_SENSOR_INVALID, EV_RESET, EV_SLEEP, EV_WAKE, NEVENT } event_t;

static const char *SNAME[NSTATE]  = {"BOOT", "IDLE", "RUN", "FAULT", "SLEEP"};
static const char *ENAME[NEVENT]  = {"START", "ARM", "STOP", "SENSOR_INVALID", "RESET", "SLEEP", "WAKE"};

/* 返回下一个状态；无效组合返回当前状态 */
static state_t step(state_t s, event_t e) {
    switch (s) {
        case BOOT:  return (e == EV_START) ? IDLE : s;
        case IDLE:  if (e == EV_ARM) return RUN;
                    if (e == EV_SLEEP) return SLEEP;
                    return s;
        case RUN:   if (e == EV_STOP) return IDLE;
                    if (e == EV_SLEEP) return SLEEP;
                    if (e == EV_SENSOR_INVALID) return FAULT;   /* 故障优先且锁存 */
                    return s;
        case FAULT: return (e == EV_RESET) ? IDLE : s;          /* 只能显式复位 */
        case SLEEP: return (e == EV_WAKE) ? IDLE : s;
        default:    return s;
    }
}

int main(void) {
    event_t script[] = {EV_START, EV_ARM, EV_SENSOR_INVALID, EV_ARM, EV_RESET, EV_ARM};
    state_t s = BOOT;
    int entered_fault = 0, ignored_in_fault = 0;
    printf("起始状态: %s\n", SNAME[s]);
    for (unsigned i = 0; i < sizeof(script) / sizeof(script[0]); i++) {
        state_t ns = step(s, script[i]);
        printf("  %-14s: %s -> %s%s\n", ENAME[script[i]], SNAME[s], SNAME[ns],
               ns == s ? "（忽略）" : "");
        if (ns == FAULT) entered_fault = 1;
        if (s == FAULT && ns == FAULT) ignored_in_fault++;
        s = ns;
    }
    printf("最终状态: %s\n", SNAME[s]);

    int ok = 1;
    if (!entered_fault) ok = 0;          /* 故障被进入 */
    if (ignored_in_fault < 1) ok = 0;    /* 锁存：FAULT 期间的 ARM 被忽略 */
    if (s != RUN) ok = 0;                /* 复位并重新 ARM 后回到 RUN */
    if (step(IDLE, EV_SENSOR_INVALID) != IDLE) ok = 0;  /* IDLE 下该事件无效 */
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
