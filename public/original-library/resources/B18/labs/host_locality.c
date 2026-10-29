/* host_locality.c —— 局部性 / cache line / 命中率（主机可运行，确定性 cache 模型）。
 * cache：16 行、每行 4 字（block=4，共 64 字容量）。命中即整块载入，故同块相邻字命中。
 * 对比"顺序 / 大步长 / 分块复用"三种访问模式的命中率，说明空间与时间局部性。 */
#include <stdio.h>
#include <stdint.h>

#define LINES 16
#define BLK   4                       /* 每行 4 个字：体现空间局部性 */
static int vtag[LINES], valid[LINES];
static long hits, misses;
static void touch(long addr) {
  long block = addr / BLK;            /* 地址所属块 */
  int line = (int)(block % LINES), tag = (int)(block / LINES);
  if (valid[line] && vtag[line] == tag) hits++;   /* 同块相邻字命中 */
  else { misses++; valid[line] = 1; vtag[line] = tag; }
}
static void reset(void) { hits = misses = 0; for (int i = 0; i < LINES; i++) { valid[i] = 0; vtag[i] = 0; } }
static double rate(void) { long t = hits + misses; return t ? 100.0 * hits / t : 0; }

int main(void) {
  int ok = 1;
  const int N = 256;
  reset(); for (int i = 0; i < N; i++) touch(i);              /* ① 顺序 */
  printf("① 顺序   N=%d  命中率=%.1f%%  (hits=%ld misses=%ld)\n", N, rate(), hits, misses);
  double seq = rate();

  reset(); for (int i = 0; i < N; i++) touch((long)i * 64);   /* ② 步长 64（>块，跨块跳跃） */
  printf("② 步长64 N=%d  命中率=%.1f%%  (hits=%ld misses=%ld)\n", N, rate(), hits, misses);
  double stride = rate();

  reset(); for (int p = 0; p < 2; p++) for (int i = 0; i < 64; i++) touch(i); /* ③ 分块复用 */
  printf("③ 分块2遍        命中率=%.1f%%  (hits=%ld misses=%ld)\n", rate(), hits, misses);
  double blocked = rate();

  if (!(seq > stride)) ok = 0;
  if (seq < 70.0 || seq > 80.0) ok = 0;      /* 空间局部性 → 理论 75% */
  if (stride > 1.0) ok = 0;                  /* 大步长、每块只用 1 字 → 0% */
  if (blocked < 85.0) ok = 0;                /* 时间局部性 → 复用率最高 */
  printf("结论: 空间局部性(顺序/整块)与时间局部性(复用)共同决定命中率; 大步长几乎全落空\n");
  printf("RESULT: %s\n", ok ? "PASS" : "FAIL");
  return ok ? 0 : 1;
}
