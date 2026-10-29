/* host_pm.c —— 运行时电源管理（runtime PM）状态机模型（主机可运行）。
 * 引用计数>0 → active；=0 且超时 → suspended；resume 再计数。驱动在 suspend/resume 回调里保存/恢复。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_pm.c -o host_pm && ./host_pm
 */
#include <stdio.h>
typedef enum { SUSPENDED, ACTIVE } pm_state_t;
typedef struct { int usage; pm_state_t st; int suspends, resumes; } pm_t;
void pm_get(pm_t *p) { if (p->usage++ == 0) { p->st = ACTIVE; p->resumes++; } }
void pm_put(pm_t *p) { if (p->usage > 0) p->usage--; if (p->usage == 0) { p->st = SUSPENDED; p->suspends++; } }
int main(void) {
    int ok = 1; pm_t p = {0, SUSPENDED, 0, 0};
    pm_get(&p); pm_get(&p);
    printf("两次 get：usage=%d state=%s resumes=%d\n", p.usage, p.st == ACTIVE ? "ACTIVE" : "SUSPENDED", p.resumes);
    if (!(p.usage == 2 && p.st == ACTIVE && p.resumes == 1)) ok = 0;
    pm_put(&p);
    printf("一次 put：usage=%d state=%s（仍 ACTIVE）\n", p.usage, p.st == ACTIVE ? "ACTIVE" : "SUSPENDED");
    if (!(p.usage == 1 && p.st == ACTIVE)) ok = 0;
    pm_put(&p);
    printf("usage 归零：state=%s suspends=%d（期望 SUSPENDED，1）\n", p.st == ACTIVE ? "ACTIVE" : "SUSPENDED", p.suspends);
    if (!(p.usage == 0 && p.st == SUSPENDED && p.suspends == 1)) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
