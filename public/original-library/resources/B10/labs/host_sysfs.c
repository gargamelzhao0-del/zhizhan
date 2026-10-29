/* host_sysfs.c —— sysfs 属性的 show/store 模型（主机可运行）。
 *
 * 驱动常通过 sysfs 暴露参数：store 要严格解析与限幅，非法输入返回 -EINVAL；
 * show 要把内部状态格式化给用户。本程序验证往返与边界校验。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_sysfs.c -o host_sysfs && ./host_sysfs
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define EINVAL 22
static int g_threshold = 50;        /* 默认值 */

/* store：解析整数并限幅，越界/非法返回 -EINVAL */
static int attr_store(const char *s) {
    char *end = 0;
    long v = strtol(s, &end, 10);
    if (end == s || *end != '\0') return -EINVAL;      /* 非数字 */
    if (v < 0 || v > 100) return -EINVAL;              /* 越界 */
    g_threshold = (int)v;
    return 0;
}
/* show：把内部状态格式化 */
static int attr_show(char *buf, int n) { return snprintf(buf, n, "%d\n", g_threshold); }

int main(void) {
    int ok = 1;
    char buf[32];

    int r = attr_store("75");
    int len = attr_show(buf, sizeof(buf));
    printf("store(\"75\")=%d  show=\"%s\"（期望 0 与 75）\n", r, buf);
    if (!(r == 0 && g_threshold == 75 && strcmp(buf, "75\n") == 0 && len == 3)) ok = 0;

    printf("store(\"200\")=%d（期望 -%d，越界被拒）\n", attr_store("200"), EINVAL);
    if (attr_store("200") != -EINVAL) ok = 0;
    printf("store(\"abc\")=%d（期望 -%d，非数字被拒）\n", attr_store("abc"), EINVAL);
    if (attr_store("abc") != -EINVAL) ok = 0;

    if (g_threshold != 75) ok = 0;                     /* 非法输入不得改变状态 */

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
