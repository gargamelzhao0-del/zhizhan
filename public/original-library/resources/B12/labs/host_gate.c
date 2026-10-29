/* host_gate.c —— 自动化门禁：静态检查 + 测试结果的合并判定（主机可运行）。
 * CI 门禁把多项检查聚合：任一硬性检查失败则整体失败；警告不阻塞但计数。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_gate.c -o host_gate && ./host_gate
 */
#include <stdio.h>
#include <string.h>
typedef struct { const char *name; int hard; int ok; } check_t;
int main(void) {
    int ok = 1;
    check_t checks[] = {
        {"编译通过", 1, 1}, {"单元测试", 1, 1}, {"行宽<=100", 0, 0},
        {"无 TODO", 1, 1}, {"覆盖率>=80", 0, 1},
    };
    int n = (int)(sizeof(checks) / sizeof(checks[0])), hard_fail = 0, warn = 0;
    for (int i = 0; i < n; i++) {
        printf("  %-12s hard=%d ok=%d\n", checks[i].name, checks[i].hard, checks[i].ok);
        if (!checks[i].ok) { if (checks[i].hard) hard_fail++; else warn++; }
    }
    printf("硬性失败=%d 警告=%d → 门禁 %s\n", hard_fail, warn, hard_fail ? "FAIL" : "PASS");
    if (!(hard_fail == 0 && warn == 1)) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
