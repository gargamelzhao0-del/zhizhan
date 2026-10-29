#include <stdio.h>

int g = 100;                        /* 全局：整个文件可见 */

void f(void) {
    int g = 5;                      /* 局部：只在 f 里有效，遮蔽同名的全局 */
    printf("f 里的 g = %d\n", g);
}

int main(void)
{
    printf("main 里的 g = %d\n", g);
    f();
    printf("调用后 g 仍 = %d\n", g);
    return 0;
}
