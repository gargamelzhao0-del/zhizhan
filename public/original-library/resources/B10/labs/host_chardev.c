/* host_chardev.c —— 字符设备 file_operations 分派模型（主机可运行）。
 *
 * 用户态 open/read/write/ioctl 会分派到驱动的 fops；minor 决定具体设备实例。
 * 本程序用一张设备表验证：按 minor 找到设备、分派到 fops、非法 minor 被拒绝。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_chardev.c -o host_chardev && ./host_chardev
 */
#include <stdio.h>
#include <string.h>

typedef struct {
    int (*open)(int minor);
    int (*read)(char *buf, int n);
    int (*write)(const char *buf, int n);
    int (*ioctl)(unsigned cmd, void *arg);
} fops_t;

typedef struct { const char *name; int minor; const fops_t *fops; int opened; char data[16]; } cdev_t;

static int dev0_open(int m) { (void)m; return 0; }
static int dev0_read(char *b, int n) { memcpy(b, "hello", n < 5 ? n : 5); return 5; }
static int dev0_write(const char *b, int n) { (void)b; return n; }
static int dev0_ioctl(unsigned cmd, void *arg) { *(int *)arg = (cmd == 0x10) ? 1 : 0; return 0; }

static const fops_t DEV0 = { dev0_open, dev0_read, dev0_write, dev0_ioctl };
static cdev_t g_devs[] = { { "mydev0", 0, &DEV0, 0, {0} } };
#define ND (int)(sizeof(g_devs) / sizeof(g_devs[0]))

static cdev_t *find_minor(int m) { for (int i = 0; i < ND; i++) if (g_devs[i].minor == m) return &g_devs[i]; return 0; }

int main(void) {
    int ok = 1;
    cdev_t *d = find_minor(0);
    printf("按 minor=0 找到设备: %s\n", d ? d->name : "(无)");
    if (!d) ok = 0;
    if (d->fops->open(d->minor) != 0) ok = 0;

    char buf[16] = {0};
    int n = d->fops->read(buf, 5);
    printf("read 返回 %d，内容=\"%s\"\n", n, buf);
    if (!(n == 5 && strcmp(buf, "hello") == 0)) ok = 0;

    int wn = d->fops->write("abc", 3);
    printf("write 返回 %d\n", wn);
    if (wn != 3) ok = 0;

    int v = 0;
    d->fops->ioctl(0x10, &v);
    printf("ioctl(0x10) → %d（期望 1）\n", v);
    if (v != 1) ok = 0;

    cdev_t *bad = find_minor(9);
    printf("minor=9 → %s（期望“不存在”）\n", bad ? "存在" : "不存在");
    if (bad) ok = 0;

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
