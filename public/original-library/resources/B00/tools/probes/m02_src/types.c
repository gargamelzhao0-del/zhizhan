#include <stdio.h>

int main(void)
{
    int    n = 7;              /* 整数 */
    double x = 3.5;            /* 小数（双精度） */
    char   c = 'A';            /* 单个字符 */
    int    y = n / 2;          /* 整数相除：结果取整 */
    double z = n / 2.0;        /* 有一个是小数 → 结果是小数 */

    printf("int    = %d,  sizeof = %zu 字节\n", n, sizeof(int));
    printf("double = %.2f, sizeof = %zu 字节\n", x, sizeof(double));
    printf("char   = %c,  sizeof = %zu 字节\n", c, sizeof(char));
    printf("7/2 = %d,  7/2.0 = %.1f\n", y, z);
    return 0;
}
