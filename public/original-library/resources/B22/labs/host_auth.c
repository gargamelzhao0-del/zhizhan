/* host_auth.c —— 证书/身份验证与最小权限（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_auth.c -o host_auth && ./host_auth
 */
#include <stdio.h>
#include <string.h>
typedef struct { const char *dev; const char *role; unsigned caps; } id_t;
#define CAP_READ 1u
#define CAP_WRITE 2u
#define CAP_OTA 4u
static int allowed(const id_t *d, unsigned need) { return (d->caps & need) == need; }
int main(void) {
    int ok = 1;
    id_t sensor = {"dev-01","sensor", CAP_READ};
    id_t admin = {"dev-99","admin", CAP_READ|CAP_WRITE|CAP_OTA};
    printf("sensor 写=%d（期望 0）\n", allowed(&sensor, CAP_WRITE)); if(allowed(&sensor,CAP_WRITE)) ok=0;
    printf("sensor 读=%d（期望 1）\n", allowed(&sensor, CAP_READ)); if(!allowed(&sensor,CAP_READ)) ok=0;
    printf("admin OTA=%d（期望 1）\n", allowed(&admin, CAP_OTA)); if(!allowed(&admin,CAP_OTA)) ok=0;
    printf("结论：最小权限——不同角色不同能力\n");
    printf("\n%s\n", ok?"RESULT: PASS":"RESULT: FAIL");
    return ok?0:1;
}
