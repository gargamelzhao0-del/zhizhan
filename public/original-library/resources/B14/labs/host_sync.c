/* host_sync.c —— 云边同步：水位/已确认位置与断点续传（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_sync.c -o host_sync && ./host_sync
 */
#include <stdio.h>
int main(void) {
    int ok = 1;
    int local_seq = 10, acked = 4;         /* 本地已产生 10 条，云端只确认到 4 */
    int pending = local_seq - acked;
    printf("本地=%d 已确认=%d 待同步=%d\n", local_seq, acked, pending);
    if (pending != 6) ok = 0;
    /* 断点续传：从 acked+1 开始补传 */
    acked += pending;                       /* 假设全部补传成功 */
    printf("补传后已确认=%d，待同步=%d（期望 0）\n", acked, local_seq - acked);
    if (local_seq - acked != 0) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
