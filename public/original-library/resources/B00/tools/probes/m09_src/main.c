#include <stdio.h>
#include "stats.h"
int main(void) {
    double xs[] = {3.2, 1.5, 9.8, 4.0, 2.6, 7.1};
    int n = (int)(sizeof(xs) / sizeof(xs[0]));
    Stats s = stats_of(xs, n);
    printf("samples=%d  min=%.1f  max=%.1f  mean=%.2f\n", s.n, s.min, s.max, s.mean);
    return 0;
}
