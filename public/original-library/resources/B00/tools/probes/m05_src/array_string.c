#include <stdio.h>
#include <string.h>

int main(void)
{
    int a[5] = {10, 20, 30, 40, 50};
    int sum = 0;
    for (int i = 0; i < 5; i++) sum += a[i];
    printf("sum = %d, average = %.1f\n", sum, sum / 5.0);

    char name[16] = "embedded";
    printf("strlen = %zu, name = %s\n", strlen(name), name);

    char other[16];
    strcpy(other, name);                     /* 复制（注意目标够大） */
    printf("compare = %d\n", strcmp(name, other));   /* 相等返回 0 */
    return 0;
}
