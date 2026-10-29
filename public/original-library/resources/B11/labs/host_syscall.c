/* Bounded I/O control-flow model, not an OS poll/epoll implementation.
 * Distinguishes partial progress, would-block, interrupted call and EOF.
 * The outer event-loop wait below is counted, not implemented as busy polling. */
#include <stdio.h>
#include <string.h>
#include <errno.h>
typedef struct {const char *data;int size,offset,calls;} ModelFd;
static int model_read(ModelFd *f,char *out,int capacity) {
    ++f->calls;
    if(f->calls==1){errno=EAGAIN;return -1;}
    if(f->calls==2){errno=EINTR;return -1;}
    int n=f->size-f->offset;
    if(n>capacity)n=capacity;
    if(n>2)n=2;
    memcpy(out,f->data+f->offset,(size_t)n);f->offset+=n;return n;
}
static int receive(ModelFd *f,char *out,int wanted,int *waits) {
    int total=0;
    for(int attempts=0;attempts<20 && total<wanted;++attempts) {
        int n=model_read(f,out+total,wanted-total);
        if(n<0) {
            if(errno==EINTR)continue;
            if(errno==EAGAIN){++*waits;continue;} /* model: yield and wait for readiness */
            return -1;
        }
        if(n==0)break; /* EOF must not spin */
        total+=n;
    }
    return total;
}
int main(void) {
    ModelFd f={"abcdef",6,0,0};char out[8]={0};int waits=0;
    int n=receive(&f,out,6,&waits);
    int ok=n==6 && !memcmp(out,"abcdef",6) && waits==1;
    ModelFd short_file={"abc",3,0,0};waits=0;
    ok &= receive(&short_file,out,6,&waits)==3;
    printf("short reads / EINTR / EAGAIN wait / early EOF: %s\n",ok?"PASS":"FAIL");
    return !ok;
}
