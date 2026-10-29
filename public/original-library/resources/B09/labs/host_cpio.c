/* host_cpio.c —— cpio newc 归档打包/解包（initramfs 模型，主机可运行）。
 *
 * initramfs 就是一个 cpio(newc) 归档：内核把它解到内存里当根。本程序打包两个文件，
 * 再按 newc 格式解析回来，验证魔数、文件名与内容。
 *
 * newc 头：magic(6) + 13×8 位十六进制字段(104) + name(namesize，按 4 对齐) + data(按 4 对齐)。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_cpio.c -o host_cpio && ./host_cpio
 */
#include <stdio.h>
#include <stdint.h>
#include <string.h>

static int put_header(char *out, const char *name, unsigned mode, unsigned size, unsigned ino) {
    unsigned namesize = (unsigned)strlen(name) + 1;
    sprintf(out, "070701%08x%08x%08x%08x%08x%08x%08x%08x%08x%08x%08x%08x%08x",
            ino, mode, 0u, 0u, 1u, 0u, size, 0u, 0u, 0u, 0u, namesize, 0u);
    memcpy(out + 110, name, namesize);
    int total = 110 + (int)namesize;
    while (total % 4) out[total++] = 0;
    return total;
}
static unsigned get_hex(const char *p) {
    char hx[9]; memcpy(hx, p, 8); hx[8] = 0;
    unsigned v = 0; sscanf(hx, "%x", &v); return v;
}

int main(void) {
    int ok = 1;
    char arc[512]; int an = 0;
    const char *nm1 = "init", *nm2 = "etc/fstab";
    const char *d1 = "#!/bin/sh\n", *d2 = "/dev/root / ext4 ro 0 1\n";
    unsigned s1 = (unsigned)strlen(d1), s2 = (unsigned)strlen(d2);

    an += put_header(arc + an, nm1, 0100755u, s1, 1u);
    memcpy(arc + an, d1, s1); an += (int)s1; while (an % 4) arc[an++] = 0;
    an += put_header(arc + an, nm2, 0100644u, s2, 2u);
    memcpy(arc + an, d2, s2); an += (int)s2; while (an % 4) arc[an++] = 0;
    an += put_header(arc + an, "TRAILER!!!", 0u, 0u, 0u);
    printf("打包：%d 字节，含 %s(%u) 与 %s(%u)\n", an, nm1, s1, nm2, s2);
    if (an <= 0 || memcmp(arc, "070701", 6) != 0) ok = 0;

    int off = 0, count = 0;
    while (off + 110 <= an) {
        if (memcmp(arc + off, "070701", 6) != 0) { ok = 0; break; }
        unsigned size = get_hex(arc + off + 54);       /* 第 7 个字段：filesize */
        unsigned nsize = get_hex(arc + off + 94);      /* 第 12 个字段：namesize */
        const char *name = arc + off + 110;
        if (strcmp(name, "TRAILER!!!") == 0) break;
        int name_total = 110 + (int)nsize;              /* 头 110 + 名字，再按 4 对齐 */
        while (name_total % 4) name_total++;
        int data_off = off + name_total;
        printf("  解出: %s size=%u data=\"%.*s\"\n", name, size, (int)size, arc + data_off);
        if (strcmp(name, nm1) == 0 && (size != s1 || memcmp(arc + data_off, d1, s1) != 0)) ok = 0;
        if (strcmp(name, nm2) == 0 && (size != s2 || memcmp(arc + data_off, d2, s2) != 0)) ok = 0;
        count++;
        off = data_off + (int)((size + 3u) & ~3u);
    }
    printf("解出文件数=%d（期望 2）\n", count);
    if (count != 2) ok = 0;

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
