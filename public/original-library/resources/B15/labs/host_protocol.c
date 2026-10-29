/* host_protocol.c —— 物联网新协议：CoAP 式请求/确认与重传（主机可运行）。
 * 基于 UDP 的请求需自行确认与重传；指数退避直到超时。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_protocol.c -o host_protocol && ./host_protocol
 */
#include <stdio.h>
int main(void) {
    int ok = 1;
    int lost = 2;                 /* 前两次丢失 */
    int tries = 0, acked = 0, backoff = 100;
    while (tries < 5) {
        tries++;
        if (lost > 0) { lost--; printf("第 %d 次超时，退避 %dms\n", tries, backoff); backoff *= 2; continue; }
        acked = 1; printf("第 %d 次收到响应\n", tries); break;
    }
    printf("尝试=%d 确认=%d 最终退避=%dms\n", tries, acked, backoff);
    if (!(tries == 3 && acked == 1)) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
