/* host_toolchain.c —— 交叉工具链与 sysroot 一致性检查（主机可运行）。
 *
 * 用户态应用须匹配目标 ABI/libc；内核及模块使用匹配的内核构建树与配置。
 * 本程序仅按路径名字提示架构，不验证 ELF、浮点 ABI、libc 或加载器兼容性。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_toolchain.c -o host_toolchain && ./host_toolchain
 */
#include <stdio.h>
#include <string.h>

static int family_ok(const char *triple, const char *sysroot) {
    if (strncmp(triple, "arm", 3) == 0) return strstr(sysroot, "arm") || strstr(sysroot, "cortex") ? 1 : 0;
    if (strncmp(triple, "aarch64", 7) == 0) return strstr(sysroot, "aarch64") ? 1 : 0;
    return 0;
}

typedef struct { const char *who; const char *triple; const char *sysroot; } tc_t;

int main(void) {
    tc_t T[] = {
        {"STM32MP1", "arm-ostl-linux-gnueabi", "/opt/st/sysroots/cortexa7t2hf-neon-vfpv4"},
        {"i.MX6ULL", "arm-poky-linux-gnueabi", "/opt/yocto/sysroots/armv7ahf-neon"},
        {"V3s",      "arm-linux-gnueabihf",    "/opt/v3s-sdk/sysroot/arm-linux-gnueabihf"},
        {"错配示例", "aarch64-linux-gnu",      "/opt/v3s-sdk/sysroot/arm-linux-gnueabihf"},
    };
    int n = (int)(sizeof(T) / sizeof(T[0])), ok = 1;
    for (int i = 0; i < n; i++) {
        int good = family_ok(T[i].triple, T[i].sysroot);
        printf("%-10s triple=%-26s sysroot=%-42s 一致=%s\n",
               T[i].who, T[i].triple, T[i].sysroot, good ? "是" : "否");
        if (i < n - 1 && !good) ok = 0;      /* 前三个应一致 */
        if (i == n - 1 && good) ok = 0;      /* 最后一个应判为不一致 */
    }
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
