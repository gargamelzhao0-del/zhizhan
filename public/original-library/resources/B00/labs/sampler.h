#ifndef COURSE_SAMPLER_H
#define COURSE_SAMPLER_H
#include <stddef.h>
typedef void *(*resize_fn)(void *, size_t);
typedef void (*sample_fn)(int value, void *context);
typedef struct { int *data; size_t size, capacity; resize_fn resize; } samples;
int parse_int(const char *text, int *result);
void samples_init(samples *s, resize_fn resize);
int samples_push(samples *s, int value);
void samples_visit(const samples *s, sample_fn fn, void *context);
void samples_destroy(samples *s);
#endif
