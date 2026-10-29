#include "sampler.h"
#include <errno.h>
#include <limits.h>
#include <stdint.h>
#include <stdlib.h>

int parse_int(const char *text, int *result) {
    if (!text || !result || !*text) return 0;
    char *end;
    errno = 0;
    long v = strtol(text, &end, 10);
    if (end == text || *end != '\0' || errno == ERANGE || v < INT_MIN || v > INT_MAX) return 0;
    *result = (int)v;
    return 1;
}
void samples_init(samples *s, resize_fn resize) { *s = (samples){NULL,0,0,resize}; }
int samples_push(samples *s, int value) {
    if (s->size == s->capacity) {
        size_t limit = SIZE_MAX / sizeof(*s->data);
        if (s->capacity > limit / 2) return 0;
        size_t next = s->capacity ? s->capacity * 2 : 4;
        if (next > limit) return 0;
        int *p = s->resize(s->data, next * sizeof(*p));
        if (!p) return 0; /* failure preserves old pointer, size and capacity */
        s->data = p; s->capacity = next;
    }
    s->data[s->size++] = value;
    return 1;
}
void samples_visit(const samples *s, sample_fn fn, void *context) {
    for (size_t i=0; i<s->size; ++i) fn(s->data[i], context);
}
void samples_destroy(samples *s) {
    free(s->data); /* resize implementations must be compatible with free */
    s->data=NULL; s->size=s->capacity=0;
}
