/* host_registry.c —— 设备注册与物模型（属性/遥测）模型（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_registry.c -o host_registry && ./host_registry
 */
#include <stdio.h>
#include <string.h>
typedef struct { const char *id; const char *type; int online; int cfg_ver; } dev_t;
int main(void) {
    int ok = 1;
    dev_t d[] = { {"dev-001","env",1,3}, {"dev-002","env",0,3}, {"dev-003","motor",1,2} };
    int n = (int)(sizeof(d)/sizeof(d[0])), online = 0;
    for (int i = 0; i < n; i++) if (d[i].online) online++;
    printf("设备数=%d 在线=%d\n", n, online);
    if (!(n == 3 && online == 2)) ok = 0;
    /* 配置版本不一致检测 */
    int mismatch = 0; for (int i = 0; i < n; i++) if (d[i].cfg_ver != 3) mismatch++;
    printf("配置版本≠3 的设备=%d（需下发）\n", mismatch);
    if (mismatch != 1) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
