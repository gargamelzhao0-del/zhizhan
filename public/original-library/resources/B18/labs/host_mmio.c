/* host_mmio.c —— 外设寄存器访问模式：读改写(RMW)竞态 vs 位带原子位操作（主机可运行）。
 * 模型：一个"控制寄存器"被两个"中断源"并发修改；RMW 会丢失更新，原子位操作不会。 */
#include <stdio.h>
#include <stdint.h>

#define EN_BIT 0u
#define MODE_SHIFT 4u
#define MODE_MASK  (0x3u << MODE_SHIFT)

static uint32_t ctrl_reg;                 /* 模拟外设控制寄存器 */
static void atomic_set_bit(uint32_t bit) { ctrl_reg |=  (1u << bit); }   /* 位带式置位 */
static void atomic_clr_bit(uint32_t bit) { ctrl_reg &= ~(1u << bit); }   /* 位带式清位 */

int main(void) {
  int ok = 1;
  /* 场景 A：写者1 用 RMW，写者2 在中间置 EN —— 更新丢失 */
  ctrl_reg = 0;
  uint32_t t1 = ctrl_reg;                               /* 写者1 读 */
  atomic_set_bit(EN_BIT);                               /* 写者2 置 EN（并发发生） */
  t1 = (t1 & ~MODE_MASK) | (1u << MODE_SHIFT);          /* 写者1 改（基于旧值） */
  ctrl_reg = t1;                                        /* 写者1 写回 → 覆盖掉 EN */
  printf("A: MODE=%u EN=%u  (RMW 把 EN 覆盖为 0)\n",
         (ctrl_reg & MODE_MASK) >> MODE_SHIFT, ctrl_reg & 1u);
  if ((ctrl_reg & 1u) != 0) ok = 0;                     /* 期望：EN 丢失 */

  /* 场景 B：两个写者都用原子位操作，各碰各的位，互不覆盖 */
  ctrl_reg = 0;
  atomic_set_bit(EN_BIT);                               /* 写者1 置 EN */
  atomic_clr_bit(EN_BIT); atomic_set_bit(EN_BIT);       /* 写者2 反复碰同一位也不影响 MODE */
  ctrl_reg = (ctrl_reg & ~MODE_MASK) | (2u << MODE_SHIFT);
  printf("B: MODE=%u EN=%u  (原子位操作不丢更新)\n",
         (ctrl_reg & MODE_MASK) >> MODE_SHIFT, ctrl_reg & 1u);
  if ((ctrl_reg & 1u) != 1 || ((ctrl_reg & MODE_MASK) >> MODE_SHIFT) != 2u) ok = 0;

  printf("结论: 共享寄存器用 RMW 会被并发覆盖; 应改用位带/BSRR 原子位操作或临界区\n");
  printf("RESULT: %s\n", ok ? "PASS" : "FAIL");
  return ok ? 0 : 1;
}
