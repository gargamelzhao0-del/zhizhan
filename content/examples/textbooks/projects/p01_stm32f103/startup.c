#include <stdint.h>
extern uint32_t _estack,_sidata,_sdata,_edata,_sbss,_ebss;
int main(void);
void Reset_Handler(void);
void SysTick_Handler(void);
static void Default_Handler(void){for(;;){__asm volatile("wfi");}}
typedef void (*handler)(void);
__attribute__((section(".isr_vector"),used))
handler const vectors[16]={
    (handler)&_estack,Reset_Handler,Default_Handler,Default_Handler,
    Default_Handler,Default_Handler,Default_Handler,0,0,0,0,
    Default_Handler,Default_Handler,0,Default_Handler,SysTick_Handler
};
void Reset_Handler(void){
    uint32_t *src=&_sidata;
    for(uint32_t *dst=&_sdata;dst<&_edata;) *dst++=*src++;
    for(uint32_t *dst=&_sbss;dst<&_ebss;) *dst++=0;
    (void)main();for(;;){}
}
