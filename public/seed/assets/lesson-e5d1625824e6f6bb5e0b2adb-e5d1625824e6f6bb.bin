#include "sampler.h"
#include <stdio.h>
#include <stdlib.h>
static void add(int v, void *ctx) { *(long double *)ctx += v; }
int main(int argc, char **argv) {
    if(argc<2){fputs("usage: sampler_cli integer...\n",stderr);return 2;}
    samples s; samples_init(&s,realloc);
    for(int i=1;i<argc;i++) {
        int v;
        if(!parse_int(argv[i],&v) || !samples_push(&s,v)){
            fprintf(stderr,"invalid input or allocation failure: argument %d\n",i);
            samples_destroy(&s);return 2;
        }
    }
    long double sum=0; samples_visit(&s,add,&sum);
    printf("count=%zu mean=%.3Lf\n",s.size,sum/(long double)s.size);
    samples_destroy(&s);
}
