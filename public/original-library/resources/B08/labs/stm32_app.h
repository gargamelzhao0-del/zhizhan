/* stm32_app.h —— STM32（M3/M7）应用相关寄存器与位定义子集。
 * 覆盖 Flash 编程、RTC/备份域、IWDG/WWDG、PWR、ADC、定时器 PWM。 */
#ifndef STM32_APP_H
#define STM32_APP_H

#include <stdint.h>

/* ---- Flash 编程接口（STM32F1，基址 0x40022000） ---- */
#define FLASH_ACR (*(volatile uint32_t *)0x40022000u)
#define FLASH_KEYR (*(volatile uint32_t *)0x40022004u)
#define FLASH_SR  (*(volatile uint32_t *)0x4002200Cu)
#define FLASH_CR  (*(volatile uint32_t *)0x40022010u)
#define FLASH_AR  (*(volatile uint32_t *)0x40022014u)

/* ---- 复位/备份域/低功耗（STM32F1） ---- */
#define RCC_BDCR  (*(volatile uint32_t *)0x40021020u)
#define RCC_CSR   (*(volatile uint32_t *)0x40021024u)
#define PWR_CR    (*(volatile uint32_t *)0x40007000u)
#define PWR_CR_LPDS  (1u << 0)
#define PWR_CR_PDDS  (1u << 1)
#define PWR_CR_CWUF  (1u << 2)

/* ---- 看门狗 ---- */
#define IWDG_KR   (*(volatile uint32_t *)0x40003000u)
#define IWDG_PR   (*(volatile uint32_t *)0x40003004u)
#define IWDG_RLR  (*(volatile uint32_t *)0x40003008u)
#define IWDG_KEY_RELOAD 0xAAAAu
#define IWDG_KEY_ENABLE 0xCCCCu

/* ---- ADC / 定时器 PWM (STM32F1) ---- */
#define ADC1_DR    (*(volatile uint32_t *)0x4001244Cu)
#define TIM2_CCR1  (*(volatile uint32_t *)0x40000034u)
#define TIM2_ARR   (*(volatile uint32_t *)0x4000002Cu)
#define TIM2_CR1   (*(volatile uint32_t *)0x40000000u)

/* ---- H7 低功耗域（示意） ---- */
#define H7_PWR_CR1 (*(volatile uint32_t *)0x58024800u)

static inline void iwdg_kick(void) { IWDG_KR = IWDG_KEY_RELOAD; }

#endif /* STM32_APP_H */
