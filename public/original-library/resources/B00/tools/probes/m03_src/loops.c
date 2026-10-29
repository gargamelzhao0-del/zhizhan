#include <stdio.h>

int main(void)
{
    int sum = 0;
    for (int i = 1; i <= 100; i++) sum += i;
    printf("1..100 的和 = %d\n", sum);

    int n = 27, steps = 0;
    while (n != 1) {
        n = (n % 2 == 0) ? n / 2 : 3 * n + 1;
        steps++;
    }
    printf("27 到 1 用了 %d 步\n", steps);
    return 0;
}
