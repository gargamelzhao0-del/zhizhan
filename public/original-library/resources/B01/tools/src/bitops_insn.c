/* bitops_insn.c — 位操作指令层：哪一条是单条指令，哪一条会变成函数调用
 *
 * 这一节只问一个问题：写下一行位运算，编译器到底发什么。
 * 六个函数，每个都只有一行，摆在一起看两款核的差别。
 *
 * 实测环境：GCC 13.3.1、-O2、cortex-m3 与 cortex-m0。
 * 每个函数上面注释里的条数是 objdump 数出来的，门禁会照着反汇编再数一遍。
 */
#include <stdint.h>

/* ① 前导零：CLZ 是 ARMv7-M 的指令。ARMv6-M 没有这条，退化成 libgcc 调用。 */
uint32_t clz_builtin(uint32_t x) { return (uint32_t)__builtin_clz(x); }

/* ② 尾随零：连 M3 上都不是单条。CLZ 只数高位，得先 RBIT 把位序倒过来。 */
uint32_t ctz_builtin(uint32_t x) { return (uint32_t)__builtin_ctz(x); }

/* ③ 数 1 的个数：两款核都没有这条指令，统一调 libgcc 的 __popcountsi2。
 *    也就是说 popcount 在 Cortex-M 上【从来没有】划算过。 */
uint32_t popcount_builtin(uint32_t x) { return (uint32_t)__builtin_popcount(x); }

/* ④ 字节序反转：REV 属于 ARMv6-M 的基础指令集 ——
 *    这一条在 M0 上反而只剩它自己能自足。 */
uint32_t bswap_builtin(uint32_t x) { return __builtin_bswap32(x); }

/* ⑤ 位序反转：RBIT 是 ARMv7-M 的。M0 上写 "rbit" 汇编器直接报错
 *    （不是"慢"，是"不认"），所以这里必须按 __ARM_ARCH 分流。 */
#if defined(__ARM_ARCH) && (__ARM_ARCH >= 7)
uint32_t rbit_cmsis(uint32_t x)
{
  uint32_t r;
  __asm__ volatile ("rbit %0, %1" : "=r" (r) : "r" (x));
  return r;
}
#else
uint32_t rbit_cmsis(uint32_t x)
{
  uint32_t r = 0u;
  for (uint32_t i = 0u; i < 32u; i++) { r = (r << 1) | (x & 1u); x >>= 1; }
  return r;
}
#endif

/* ⑥ 同一个循环，手写的、没做任何分流。
 *    在 M3 上它【不会】被认成 RBIT —— 编译器不替你做这个优化。 */
uint32_t rbit_loop(uint32_t x)
{
  uint32_t r = 0u;
  for (uint32_t i = 0u; i < 32u; i++) { r = (r << 1) | (x & 1u); x >>= 1; }
  return r;
}
