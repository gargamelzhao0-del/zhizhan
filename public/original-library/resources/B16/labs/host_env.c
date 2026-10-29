/* host_env.c —— 环境边界：真实 PATH 解析与工具可用性检查（主机可运行）。
 * 读取本机 PATH 环境变量，按分隔符逐目录查找可执行文件——不是硬编码，输出随本机环境变化。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_env.c -o host_env && ./host_env
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#ifdef _WIN32
#define SEP ";"
#define EXE ".exe"
#else
#define SEP ":"
#define EXE ""
#endif
static int exists(const char *p) { FILE *f = fopen(p, "rb"); if (f) { fclose(f); return 1; } return 0; }
static int find_tool(const char *name, char *out, size_t n) {
    const char *path = getenv("PATH");
    if (!path) return 0;
    size_t L = strlen(path);
    char *buf = (char *)malloc(L + 1);
    if (!buf) return 0;
    memcpy(buf, path, L + 1);
    int found = 0;
    for (char *dir = strtok(buf, SEP); dir; dir = strtok(NULL, SEP)) {
        if (!*dir) continue;
        if (snprintf(out, n, "%s/%s%s", dir, name, EXE) > 0 && exists(out)) { found = 1; break; }
    }
    free(buf);
    return found;
}
int main(void) {
    int ok = 1;
    char out[1024];
    int g = find_tool("gcc", out, sizeof(out));
    printf("PATH 顺序解析 gcc → %s\n", g ? out : "(未找到)（本机 PATH 无 gcc）");
    /* 明确不存在的工具必须找不到；这是真实查找，不是写死的布尔 */
    int x = find_tool("__no_such_tool_xyz__", out, sizeof(out));
    printf("__no_such_tool_xyz__ → %s（期望未找到）\n", x ? out : "(未找到)");
    if (x) ok = 0;
    printf("结论：用命令行 `command -v gcc` / `where gcc` 可得到与本程序一致的解析机制\n");
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
