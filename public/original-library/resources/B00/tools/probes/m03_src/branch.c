#include <stdio.h>

int main(void)
{
    int score = 82;
    if (score >= 90)       printf("A\n");
    else if (score >= 80)  printf("B\n");
    else if (score >= 60)  printf("C\n");
    else                   printf("D\n");
    return 0;
}
