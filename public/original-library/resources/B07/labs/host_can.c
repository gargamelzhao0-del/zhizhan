/* host_can.c —— CAN 位定时、仲裁与总线负载的小模型（主机可运行）。
 *
 *   ① 位定时：位时间 = 1(同步段) + BS1 + BS2 个时间份额(tq)，tq = 1/时钟；
 *      预分频 = 外设时钟 / (波特率 × 总 tq 数)，必须为整数。采样点 = (1+BS1)/总 tq。
 *   ② 仲裁：多个节点同时发送时，标识符数值越小优先级越高，逐位仲裁，输者自动重发。
 *   ③ 总线负载：负载‰ = 每秒帧数 × 每帧位数 / 波特率 × 1000。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_can.c -o host_can && ./host_can
 */
#include <stdio.h>
#include <stdint.h>

static int prescaler_for(uint32_t clock, uint32_t bitrate, int tq_total, int *out_presc, int *out_sp_permille, int bs1) {
    uint32_t denom = bitrate * (uint32_t)tq_total;
    if (denom == 0 || clock % denom != 0) return 0;
    *out_presc = (int)(clock / denom);
    *out_sp_permille = (1 + bs1) * 1000 / tq_total;
    return 1;
}
static int bus_load_permille(uint32_t fps, int bits_per_frame, uint32_t bitrate) {
    return (int)(((uint64_t)fps * (uint64_t)bits_per_frame * 1000u) / bitrate);
}

int main(void) {
    int ok = 1, presc = 0, sp = 0;

    /* ① 36MHz 外设时钟、500kbps、18 tq（BS1=15, BS2=2） */
    int found = prescaler_for(36000000u, 500000u, 18, &presc, &sp, 15);
    printf("位定时：36MHz / 500kbps / 18tq → 预分频=%d（期望 4），采样点=%d‰（期望 ~889‰）\n", presc, sp);
    if (!(found && presc == 4 && sp == 888)) ok = 0;

    /* 非整数预分频必须被拒绝：72MHz / 500kbps / 18tq = 8（整数）；改成 17tq 则不是整数 */
    if (prescaler_for(72000000u, 500000u, 17, &presc, &sp, 15)) { printf("本应拒绝非整数预分频\n"); ok = 0; }

    /* ② 仲裁：ID 越小越优先 */
    uint32_t ids[3] = {0x200u, 0x100u, 0x180u};
    uint32_t winner = ids[0];
    for (int i = 1; i < 3; i++) if (ids[i] < winner) winner = ids[i];
    printf("仲裁：{0x200,0x100,0x180} 的胜者=0x%03X（期望 0x100）\n", winner);
    if (winner != 0x100u) ok = 0;

    /* ③ 总线负载：1000 帧/s × 111 位 / 500kbps */
    int load = bus_load_permille(1000u, 111, 500000u);
    printf("总线负载：1000fps × 111bit / 500kbps = %d‰（期望 222‰）\n", load);
    if (load != 222) ok = 0;

    if (bus_load_permille(3000u, 130, 500000u) < 500) { printf("高负载估算偏低\n"); ok = 0; }

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
