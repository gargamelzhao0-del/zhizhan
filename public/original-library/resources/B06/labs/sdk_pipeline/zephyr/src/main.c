#include <zephyr/kernel.h>
#include <zephyr/sys/printk.h>
#include "sample.h"
K_MSGQ_DEFINE(samples,sizeof(Sample),4,4);
static void producer(void *a,void *b,void *c) {
    (void)a;(void)b;(void)c;
    uint32_t dropped=0;
    for(uint32_t seq=0;;++seq) {
        Sample s;
        /* Synthetic source, deliberately not an ADC measurement. */
        if(sample_make(&s,seq,k_uptime_get_32(),seq%4096U) &&
           k_msgq_put(&samples,&s,K_NO_WAIT)!=0)
            printk("DROP %u total=%u\n",(unsigned)seq,(unsigned)++dropped);
        k_msleep(50);
    }
}
K_THREAD_DEFINE(producer_id,2048,producer,NULL,NULL,NULL,5,0,0);
int main(void) {
    Sample s;
    while(1) {
        if(k_msgq_get(&samples,&s,K_FOREVER)==0)
            printk("SAMPLE %u,%u,%u,%u\n",(unsigned)s.seq,(unsigned)s.ms,
                   (unsigned)s.raw,(unsigned)s.mv);
        k_msleep(200); /* deliberately slow consumer exposes backpressure */
    }
    return 0;
}
