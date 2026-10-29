/* host_shellparse.c —— 命令行分词（Shell 语义模型，主机可运行）。
 *
 * Shell 分词的规则并不简单：引号内空格不分割、反斜杠转义、管道是独立 token。
 * 本程序实现一个最小分词器，验证引号/转义/管道的处理。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_shellparse.c -o host_shellparse && ./host_shellparse
 */
#include <stdio.h>
#include <string.h>

#define MAXTOK 16

/* 返回 token 数；token 指向内部静态缓冲 */
static int tokenize(const char *s, char tok[][64]) {
    int n = 0, i = 0, ti = 0, in_s = 0, in_d = 0, esc = 0;
    for (; s[i]; i++) {
        char c = s[i];
        if (esc) { tok[n][ti++] = c; esc = 0; continue; }
        if (c == '\\' && !in_s) { esc = 1; continue; }        /* 反斜杠转义（单引号内不转义） */
        if (c == '\'' && !in_d) { in_s = !in_s; continue; }
        if (c == '"' && !in_s) { in_d = !in_d; continue; }
        if (!in_s && !in_d && (c == ' ' || c == '\t')) {
            if (ti) { tok[n][ti] = 0; n++; ti = 0; }
            continue;
        }
        if (!in_s && !in_d && c == '|') {                     /* 管道是独立 token */
            if (ti) { tok[n][ti] = 0; n++; ti = 0; }
            tok[n][0] = '|'; tok[n][1] = 0; n++;
            continue;
        }
        tok[n][ti++] = c;
    }
    if (ti) { tok[n][ti] = 0; n++; }
    return n;
}

int main(void) {
    char tok[MAXTOK][64];
    const char *cmd = "echo \"a b\" c\\ d | grep x";
    int n = tokenize(cmd, tok), ok = 1;
    printf("命令: %s\n分词(%d):", cmd, n);
    for (int i = 0; i < n; i++) printf(" [%s]", tok[i]);
    printf("\n");
    if (n != 6) ok = 0;
    const char *want[6] = {"echo", "a b", "c d", "|", "grep", "x"};
    for (int i = 0; i < 6 && i < n; i++) if (strcmp(tok[i], want[i]) != 0) ok = 0;

    char tok2[MAXTOK][64];
    int n2 = tokenize("cat '/etc/passwd'", tok2);
    printf("分词2(%d): [%s] [%s]（单引号内不转义）\n", n2, tok2[0], n2 > 1 ? tok2[1] : "");
    if (!(n2 == 2 && strcmp(tok2[1], "/etc/passwd") == 0)) ok = 0;

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
