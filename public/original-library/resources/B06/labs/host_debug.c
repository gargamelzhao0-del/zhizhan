/* host_debug.c —— 栈高水位与 CPU 占用的度量模型（主机可运行）。
 *
 *   ① 栈高水位的原理：创建任务时把整块栈填成已知模式；运行时被覆盖的部分才是“用过”的。
 *      从未被覆盖的字节数就是“最坏情况下仍空闲的余量”（高水位 = 最少剩余）。
 *      这正是 uxTaskGetStackHighWaterMark() 的做法，也是 configCHECK_FOR_STACK_OVERFLOW 的基础。
 *   ② CPU 占用：忙 tick / 总 tick。空闲任务跑到的时间不计入忙。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_debug.c -o host_debug && ./host_debug
 */
#include <stdio.h>
#include <string.h>

#define STACK 64
#define PAINT 0xAB

/* 返回从未被覆盖的字节数（自栈底向上连续 PAINT 的个数；栈向下生长，未用区在低地址） */
static int high_water(const unsigned char *s, int n) {
    int free_bytes = 0;
    for (int i = 0; i < n; i++)
        if (s[i] == PAINT) free_bytes++; else break;
    return free_bytes;
}

int main(void) {
    int ok = 1;
    unsigned char stack[STACK];

    memset(stack, PAINT, sizeof(stack));
    /* 模拟一次调用链用掉了 40 字节（栈向下生长，占用高地址区；低地址仍是 PAINT） */
    int used = 40;
    for (int i = STACK - used; i < STACK; i++) stack[i] = (unsigned char)(0x10 + (i & 0x0F));
    int hw = high_water(stack, STACK);
    printf("填充 %d 字节栈，用掉 %d 字节 → 高水位(最少剩余) = %d 字节\n", STACK, used, hw);
    if (hw != STACK - used) ok = 0;

    memset(stack, 0x5A, sizeof(stack));   /* 未按 PAINT 填充 */
    hw = high_water(stack, STACK);
    printf("未按 0xAB 填充的栈 → 高水位 = %d（期望 0，说明必须先填充）\n", hw);
    if (hw != 0) ok = 0;

    /* CPU 占用：100 tick 里忙 75 */
    for (int b = 0; b <= 100; b += 25) {
        int total = 100, busy = b, load = busy * 100 / total;
        printf("忙 %3d / %3d tick → CPU 占用 %d%%\n", busy, total, load);
        if (load != b) ok = 0;
    }

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
