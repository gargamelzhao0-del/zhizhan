#include <stdio.h>

int add(int a, int b) { return a + b; }
int max3(int a, int b, int c) {
    int m = a;
    if (b > m) m = b;
    if (c > m) m = c;
    return m;
}
int factorial(int n) {                 /* 递归：n! = n * (n-1)! */
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}

int main(void)
{
    printf("add(3,4)      = %d\n", add(3, 4));
    printf("max3(3,9,5)   = %d\n", max3(3, 9, 5));
    printf("factorial(5)  = %d\n", factorial(5));
    return 0;
}
