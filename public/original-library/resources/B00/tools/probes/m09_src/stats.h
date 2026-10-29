#ifndef STATS_H
#define STATS_H
typedef struct { double min, max, mean; int n; } Stats;
Stats stats_of(const double *xs, int n);
#endif
