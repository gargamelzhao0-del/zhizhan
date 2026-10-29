/* Real C11 release/acquire with POSIX threads (MinGW-w64 winpthreads also works).
 * The consumer may read data ONLY after acquire observes ready=1 published by
 * release. An acknowledgement prevents the next write racing with this read.
 * gcc -std=c11 -Wall -Wextra -Werror -O2 -pthread host_memorder.c -o host_memorder
 * A passing run illustrates the protocol; the C memory model is its guarantee.
 * Replacing these atomics by volatile or compiler-only barriers is incorrect.
 */
#include <stdatomic.h>
#include <pthread.h>
#include <stdio.h>
#define COUNT 20000
static atomic_int ready=0;
static int data=0,errors=0;
static void *producer(void *unused) {
    (void)unused;
    for(int i=1;i<=COUNT;++i) {
        while(atomic_load_explicit(&ready,memory_order_acquire)!=0) {}
        data=i;
        atomic_store_explicit(&ready,1,memory_order_release);
    }
    return NULL;
}
int main(void) {
    pthread_t thread;
    if(pthread_create(&thread,NULL,producer,NULL)!=0) return 2;
    for(int i=1;i<=COUNT;++i) {
        while(atomic_load_explicit(&ready,memory_order_acquire)!=1) {}
        if(data!=i) ++errors;
        atomic_store_explicit(&ready,0,memory_order_release);
    }
    if(pthread_join(thread,NULL)!=0) return 2;
    printf("release/acquire handshakes=%d errors=%d\n",COUNT,errors);
    puts(errors ? "RESULT: FAIL" : "RESULT: PASS");
    return errors!=0;
}
