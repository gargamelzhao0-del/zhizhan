/* host_trace.c —— 需求到测试的可追溯矩阵与覆盖率（主机可运行）。
 * 每条需求应有至少一个测试覆盖；列出未覆盖项，避免“测了很多但关键需求没测”。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_trace.c -o host_trace && ./host_trace
 */
#include <stdio.h>
#include <string.h>
typedef struct { const char *id; int covered; } req_t;
int main(void) {
    int ok = 1;
    req_t reqs[] = { {"REQ-01", 1}, {"REQ-02", 1}, {"REQ-03", 0}, {"REQ-04", 1}, {"REQ-05", 0} };
    int n = (int)(sizeof(reqs) / sizeof(reqs[0])), cov = 0;
    printf("未覆盖需求: ");
    for (int i = 0; i < n; i++) { if (reqs[i].covered) cov++; else printf("%s ", reqs[i].id); }
    printf("\n");
    int pct = cov * 100 / n;
    printf("覆盖 %d/%d = %d%%\n", cov, n, pct);
    if (!(cov == 3 && pct == 60)) ok = 0;
    if (pct < 100) printf("门禁：未达标（嵌入式关键需求建议 100%%）\n");
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
