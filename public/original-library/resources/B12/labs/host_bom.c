/* host_bom.c —— 选型与成本：BOM 成本估算与批量缩放（主机可运行）。
 * BOM 成本 = Σ(单价 × 数量)；量产要按批量与良率估算实际成本。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_bom.c -o host_bom && ./host_bom
 */
#include <stdio.h>
typedef struct { const char *name; int unit_milli; int qty; } item_t;   /* unit_milli: 单价(‰元) */
int main(void) {
    int ok = 1;
    item_t bom[] = { {"MCU", 12000, 1}, {"Flash", 3000, 1}, {"Passives", 50, 60}, {"PCB", 5000, 1} };
    int n = (int)(sizeof(bom) / sizeof(bom[0]));
    long total_milli = 0;
    for (int i = 0; i < n; i++) total_milli += (long)bom[i].unit_milli * bom[i].qty;
    printf("单板 BOM = %.2f 元\n", total_milli / 1000.0);
    if (total_milli != 23000) ok = 0;             /* 12+3+3+5=23 元 = 23000‰ */
    long batch = total_milli * 10000;             /* 1 万台 */
    printf("1 万台物料成本 = %.0f 元（不含良率/工时）\n", batch / 1000.0);
    if (batch / 1000 != 230000) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
