/* esp_m15_arch.c — B05-M15 ISA/结构（ESP32 / Xtensa LX6）
 * Xtensa 无 Thumb：指令多为 16/24 位变长；代码可放 IRAM、数据放 DRAM。 */
#include <stdint.h>

#define IRAM_ATTR __attribute__((section(".iram1")))
#define DRAM_ATTR __attribute__((section(".dram1")))

/* 用于反汇编对照（xtensa-esp32-elf-objdump -d） */
int IRAM_ATTR esp_add_mul(int a, int b, int c) { return a + b * c; }

int DRAM_ATTR g_esp_data = 1;

/* Xtensa 的顺序屏障是 memw（对应 ARM 的 DMB/DSB 语境） */
void esp_arch_barrier(void) { __asm__ volatile ("memw" ::: "memory"); }

/* 结构上：Xtensa 有窗口化寄存器（call0/call4 约定），与 AAPCS 的 r0-r3 不同 */
int esp_arch_callconv(int a, int b) { return a - b; }
