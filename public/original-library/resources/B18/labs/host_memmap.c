/* host_memmap.c —— 地址空间 / 内存映射译码模型（主机可运行）
 * 用一个简化但真实的 Cortex-M 地址映射，把任意地址译码成「区域 + 属性」。
 * 演示：外设/内存统一编址、越界访问为何是"总线故障"、位带别名区落在哪。 */
#include <stdio.h>
#include <stdint.h>
#include <string.h>

typedef struct { uint32_t base, end; const char *name; const char *attr; int is_io; } region_t;

/* Cortex-M 参考地址映射（节选，真实边界值） */
static const region_t MAP[] = {
  {0x00000000u, 0x1FFFFFFFu, "Code/Flash (alias)", "RX, cached",   0},
  {0x20000000u, 0x200FFFFFu, "SRAM",               "RW, cached",   0},
  {0x22000000u, 0x23FFFFFFu, "Bit-band alias (SRAM)","RW, alias",  0},
  {0x40000000u, 0x400FFFFFu, "Peripheral (APB/AHB)","RW, device",  1},
  {0x42000000u, 0x43FFFFFFu, "Bit-band alias (Peri)","RW, alias",  0},
  {0x60000000u, 0x9FFFFFFFu, "External RAM",        "RW, cacheable",0},
  {0xE0000000u, 0xE00FFFFFu, "PPB (NVIC/SysTick)",  "RW, strong",   1},
  {0xE0040000u, 0xE00FFFFFu, "Debug/ROM table",     "RO, device",   1},
};
static const int NMAP = (int)(sizeof(MAP)/sizeof(MAP[0]));

static const region_t *decode(uint32_t a) {
  for (int i = 0; i < NMAP; i++)
    if (a >= MAP[i].base && a <= MAP[i].end) return &MAP[i];
  return NULL;                       /* 未映射 → 总线故障 */
}

int main(void) {
  const uint32_t probes[] = {
    0x08000100u, 0x20000010u, 0x20000020u + 0x02000000u, /* 位带别名 */
    0x40021018u, 0xE000E010u, 0x50000000u /* 保留区，未映射 */
  };
  int ok = 1;
  printf("地址        区域                   属性             IO\n");
  for (size_t i = 0; i < sizeof(probes)/sizeof(probes[0]); i++) {
    const region_t *r = decode(probes[i]);
    if (r) printf("0x%08X  %-22s %-15s %s\n", probes[i], r->name, r->attr, r->is_io ? "yes" : "no");
    else   printf("0x%08X  %-22s %-15s %s\n", probes[i], "UNMAPPED (fault)", "-", "-");
  }
  /* 断言：位带别名 = base + 0x2000000 + (addr-0x20000000)*32 + bit*4 */
  uint32_t sram = 0x20000020u, alias_expect = 0x22000000u + ((sram - 0x20000000u) * 32u) + 0u;
  printf("位带别名公式: 0x%08X -> 0x%08X (%s)\n", sram, alias_expect,
         decode(alias_expect) && strstr(decode(alias_expect)->name, "Bit-band") ? "hit" : "miss");
  if (alias_expect != 0x22000400u) ok = 0;
  if (!decode(0x40021018u) || !decode(0x40021018u)->is_io) ok = 0;
  if (decode(0x50000000u) != NULL) ok = 0;           /* 必须判为未映射 */
  printf("SRAM/外设/未映射判定: %s\n", ok ? "OK" : "BAD");
  printf("RESULT: %s\n", ok ? "PASS" : "FAIL");
  return ok ? 0 : 1;
}
