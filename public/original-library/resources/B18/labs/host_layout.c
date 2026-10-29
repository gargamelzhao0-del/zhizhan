/* host_layout.c —— 对齐 / 填充 / 寄存器块布局（主机可运行）
 * 用 offsetof 打印真实字段偏移，说明"结构体映射寄存器"时的填充陷阱与 cache line 对齐。 */
#include <stdio.h>
#include <stddef.h>
#include <stdint.h>

typedef struct { volatile uint32_t CR; volatile uint32_t SR; volatile uint16_t ID; } regs_c;       /* 自然对齐 */
typedef struct __attribute__((packed)) { volatile uint32_t CR; volatile uint32_t SR; volatile uint16_t ID; } regs_p;

typedef struct { uint8_t tag; uint32_t val; uint8_t flag; } s_nat;
typedef struct __attribute__((packed)) { uint8_t tag; uint32_t val; uint8_t flag; } s_pk;

typedef struct __attribute__((aligned(64))) { uint32_t head; uint32_t data[8]; } aligned64;

int main(void) {
  int ok = 1;
  printf("regs_c   : sizeof=%zu  自然对齐（ID 后填充 2 字节）\n", sizeof(regs_c));
  printf("  offsetof CR=%zu SR=%zu ID=%zu\n", offsetof(regs_c, CR), offsetof(regs_c, SR), offsetof(regs_c, ID));
  printf("regs_p   : sizeof=%zu  packed（无填充；非对齐访问可能触发陷阱）\n", sizeof(regs_p));
  printf("s_nat    : sizeof=%zu  tag@0 val@4 flag@8 -> 填充到 12\n", sizeof(s_nat));
  printf("  offsetof tag=%zu val=%zu flag=%zu\n", offsetof(s_nat, tag), offsetof(s_nat, val), offsetof(s_nat, flag));
  printf("s_pk     : sizeof=%zu  packed 紧凑但 val 非对齐\n", sizeof(s_pk));
  printf("aligned64: sizeof=%zu  alignof=%zu  (cache line 对齐)\n",
         sizeof(aligned64), (size_t)_Alignof(aligned64));

  if (sizeof(regs_c) != 12) ok = 0;
  if (sizeof(regs_p) != 10) ok = 0;
  if (offsetof(regs_c, ID) != 8) ok = 0;
  if (offsetof(s_nat, val) != 4) ok = 0;
  if (sizeof(s_pk) != 6) ok = 0;
  if (_Alignof(aligned64) != 64) ok = 0;
  printf("对齐/填充断言: %s\n", ok ? "OK" : "BAD");
  printf("RESULT: %s\n", ok ? "PASS" : "FAIL");
  return ok ? 0 : 1;
}
