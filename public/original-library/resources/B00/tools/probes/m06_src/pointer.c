#include <stdio.h>

void swap(int *a, int *b) {                  /* 交换：通过指针改调用方的变量 */
    int t = *a; *a = *b; *b = t;
}

int main(void)
{
    int x = 3, y = 8;
    int *p = &x;                             /* p 保存 x 的地址 */
    printf("x=%d   *p=%d   (p 指向 x，所以 *p 就是 x)\n", x, *p);

    *p = 10;                                 /* 通过指针改 x */
    printf("after *p=10: x=%d\n", x);

    swap(&x, &y);
    printf("after swap:  x=%d  y=%d\n", x, y);

    int a[4] = {1, 2, 3, 4};
    int *q = a;                              /* 数组名就是首元素地址 */
    int s = 0;
    for (int i = 0; i < 4; i++) s += *(q + i);
    printf("array sum via pointer = %d\n", s);
    return 0;
}
