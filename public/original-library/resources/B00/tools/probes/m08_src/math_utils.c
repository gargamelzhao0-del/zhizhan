#include "math_utils.h"
int add(int a, int b) { return a + b; }
int max3(int a, int b, int c) {
    int m = a;
    if (b > m) m = b;
    if (c > m) m = c;
    return m;
}
