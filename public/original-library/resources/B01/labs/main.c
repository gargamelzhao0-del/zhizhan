// STM32F103C8, reset HSI=8MHz, PA0 ADC1, PA9 USART1 TX; no CMSIS or libc dependency.
// Full target image, NOT claimed to have run on hardware in this workspace.
#include <stdint.h>
#define REG(address) (*(volatile uint32_t *)(address))
#define RCC_CR REG(0x40021000u)
#define RCC_CFGR REG(0x40021004u)
#define RCC_APB2ENR REG(0x40021018u)
#define GPIOA_CRL REG(0x40010800u)
#define GPIOA_CRH REG(0x40010804u)
#define USART_SR REG(0x40013800u)
#define USART_DR REG(0x40013804u)
#define USART_BRR REG(0x40013808u)
#define USART_CR1 REG(0x4001380cu)
#define ADC_SR REG(0x40012400u)
#define ADC_CR2 REG(0x40012408u)
#define ADC_SMPR2 REG(0x40012410u)
#define ADC_SQR1 REG(0x4001242cu)
#define ADC_SQR3 REG(0x40012434u)
#define ADC_DR REG(0x4001244cu)
#define SYST_CSR REG(0xe000e010u)
#define SYST_RVR REG(0xe000e014u)
#define SYST_CVR REG(0xe000e018u)
static volatile uint32_t milliseconds;
static volatile uint32_t failures; // observable through the debugger
void SysTick_Handler(void){++milliseconds;}
static void delay(uint32_t ms){uint32_t start=milliseconds;while((uint32_t)(milliseconds-start)<ms){}}
static int wait_clear(volatile uint32_t *reg,uint32_t bit){uint32_t start=milliseconds;while(*reg&bit){if((uint32_t)(milliseconds-start)>=20)return 0;}return 1;}
static int adc_init(void){
    // HSI is on at reset; select it explicitly. The 8MHz value is nominal, measure actual timing on target.
    RCC_CR|=1u;while(!(RCC_CR&2u)){}
    RCC_CFGR=2u<<14; // SYSCLK HSI, AHB/APB divide 1, ADC clock APB2/6
    RCC_APB2ENR|=(1u<<2)|(1u<<9)|(1u<<14);
    GPIOA_CRL&=~15u; // PA0 analog
    GPIOA_CRH=(GPIOA_CRH&~(15u<<4))|(11u<<4); // PA9 AF push-pull
    USART_BRR=833u;USART_CR1=(1u<<13)|(1u<<3); // 8MHz/9600; 8 data bits, no parity
    SYST_RVR=7999u;SYST_CVR=0;SYST_CSR=7u;
    ADC_SMPR2=7u;ADC_SQR1=0;ADC_SQR3=0; // channel 0, longest sample time, one conversion
    ADC_CR2=1u;delay(2);
    ADC_CR2|=1u<<3;if(!wait_clear(&ADC_CR2,1u<<3))return 0;
    ADC_CR2|=1u<<2;if(!wait_clear(&ADC_CR2,1u<<2))return 0;
    ADC_CR2|=(7u<<17)|(1u<<20);return 1;
}
static int sample(uint16_t *raw){
    ADC_SR=0;ADC_CR2|=1u<<22;
    uint32_t start=milliseconds;
    while(!(ADC_SR&2u)){if((uint32_t)(milliseconds-start)>=20)return 0;}
    *raw=(uint16_t)ADC_DR;return *raw<=4095;
}
static int send(uint8_t value){uint32_t start=milliseconds;while(!(USART_SR&(1u<<7))){if((uint32_t)(milliseconds-start)>=20)return 0;}USART_DR=value;return 1;}
static uint16_t crc16(const uint8_t *p){uint16_t crc=0xffff;for(unsigned i=0;i<4;i++){crc^=(uint16_t)p[i]<<8;for(unsigned b=0;b<8;b++)crc=(uint16_t)((crc&0x8000)?(crc<<1)^0x1021:crc<<1);}return crc;}
int main(void){
    if(!adc_init())for(;;){__asm volatile("wfi");}
    uint16_t seq=0;
    for(;;){
        uint16_t raw;
        if(sample(&raw)){
            uint8_t frame[8]={0xa5,0x5a,(uint8_t)seq,(uint8_t)(seq>>8),(uint8_t)raw,(uint8_t)(raw>>8),0,0};
            uint16_t crc=crc16(frame+2);frame[6]=(uint8_t)crc;frame[7]=(uint8_t)(crc>>8);
            for(unsigned i=0;i<8;i++)if(!send(frame[i])){++failures;break;}
            ++seq;
        }else{++failures;++seq;} // sequence gap exposes lost samples; do not substitute zero
        delay(100); // pacing after work, NOT a precise 10Hz acquisition guarantee
    }
}
