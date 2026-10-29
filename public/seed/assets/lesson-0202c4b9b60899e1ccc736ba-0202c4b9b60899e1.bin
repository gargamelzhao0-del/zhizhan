#include "sampler.h"
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
static int fail_next;
static void *resize(void *p, size_t n) { if(fail_next){fail_next=0;return NULL;} return realloc(p,n); }
static void add(int value, void *context) { *(long *)context += value; }
int main(void) {
    int value=99;
    assert(parse_int("-12", &value) && value==-12);
    assert(!parse_int("", &value) && value==-12);
    assert(!parse_int("12x", &value));
    assert(!parse_int("999999999999999999999999999999", &value));
    samples s; samples_init(&s,resize);
    fail_next=1; assert(!samples_push(&s,1) && !s.data && !s.size);
    for(int i=1;i<=4;i++) assert(samples_push(&s,i));
    int *old=s.data; fail_next=1;
    assert(!samples_push(&s,5) && s.data==old && s.size==4 && s.capacity==4);
    assert(samples_push(&s,5));
    long sum=0; samples_visit(&s,add,&sum); assert(sum==15);
    samples_destroy(&s); samples_destroy(&s); assert(!s.data && !s.size);
    puts("parse/overflow/allocation-failure/callback/cleanup: RESULT: PASS");
}
