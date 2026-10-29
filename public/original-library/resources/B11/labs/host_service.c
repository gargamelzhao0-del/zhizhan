/* host_service.c —— 服务化：崩溃重启与限速（systemd Restart 语义）模型（主机可运行）。
 * 服务反复失败时不能无限重启：StartLimit 在时间窗内限制重启次数，超过进入 failed。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_service.c -o host_service && ./host_service
 */
#include <stdio.h>
typedef enum { RUNNING, FAILED } st_t;
typedef struct { int burst; int limit; st_t st; } svc_t;
static void on_failure(svc_t *s) {
    if (++s->burst > s->limit) s->st = FAILED;          /* 超过限速进入 failed */
}
int main(void) {
    int ok = 1; svc_t s = {0, 5, RUNNING};
    for (int i = 0; i < 5; i++) on_failure(&s);
    printf("失败 5 次：burst=%d state=%s（仍 RUNNING）\n", s.burst, s.st == RUNNING ? "RUNNING" : "FAILED");
    if (!(s.burst == 5 && s.st == RUNNING)) ok = 0;
    on_failure(&s);
    printf("第 6 次：burst=%d state=%s（期望 FAILED，限速生效）\n", s.burst, s.st == RUNNING ? "RUNNING" : "FAILED");
    if (!(s.burst == 6 && s.st == FAILED)) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
