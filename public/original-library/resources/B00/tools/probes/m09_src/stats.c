#include "stats.h"
Stats stats_of(const double *xs, int n) {
    Stats s = {0, 0, 0, n};
    if (n <= 0) return s;
    s.min = s.max = xs[0];
    double sum = 0;
    for (int i = 0; i < n; i++) {
        if (xs[i] < s.min) s.min = xs[i];
        if (xs[i] > s.max) s.max = xs[i];
        sum += xs[i];
    }
    s.mean = sum / n;
    return s;
}
