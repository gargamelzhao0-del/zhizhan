/* host_exc.c —— 中断优先级 / 抢占 / 嵌套深度 / 栈预算（主机可运行，确定性模型）。
 * 用一个离散事件调度器模拟 NVIC 式"可抢占优先级"：数值越小优先级越高。
 * 输出真实的抢占时间线、最大嵌套深度与按最坏深度预留的栈预算。 */
#include <stdio.h>
#include <string.h>
#include <stdint.h>

typedef struct { const char *name; int pri; int arr; int dur; } isr_t;

/* 一组到达/持续各异的 ISR（优先级数值越小越高） */
static isr_t ISR[] = {
  {"IRQ_A", 2,  0, 100},
  {"IRQ_B", 1, 20,  30},   /* 抢占 A */
  {"IRQ_C", 0, 40,  10},   /* 抢占 B → 嵌套 3 层 */
  {"IRQ_D", 3, 50,  40},   /* 低于 A/B/C，只能等待 */
};
static const int N = (int)(sizeof(ISR)/sizeof(ISR[0]));

int main(void) {
  int ok = 1;
  int remain[8]; int started[8]; memset(started, 0, sizeof(started));
  for (int i = 0; i < N; i++) remain[i] = ISR[i].dur;
  int active[8]; int nact = 0;          /* 已进入但未完成的（含被抢占的） */
  int max_depth = 0, t = 0, guard = 0;
  printf("时间线（数值越小优先级越高）:\n");
  while (1) {
    /* 到达事件：把 arr<=t 且未进入的加入 active */
    for (int i = 0; i < N; i++)
      if (ISR[i].arr <= t && remain[i] > 0 && !started[i]) { active[nact++] = i; started[i] = 1; }
    if (nact == 0) break;
    if (nact > max_depth) max_depth = nact;
    /* 选 active 中优先级最高的运行一个时间单位 */
    int cur = 0; for (int k = 1; k < nact; k++) if (ISR[active[k]].pri < ISR[active[cur]].pri) cur = k;
    int idx = active[cur];
    if (remain[idx] == ISR[idx].dur) printf("  t=%3d  %s 开始 (pri=%d)\n", t, ISR[idx].name, ISR[idx].pri);
    remain[idx]--; t++;
    if (remain[idx] == 0) { printf("  t=%3d  %s 完成\n", t, ISR[idx].name);
      active[cur] = active[--nact]; }
    if (++guard > 100000) { ok = 0; break; }
  }
  const int frame = 64, base = 256;                /* 每层中断栈帧 64B + 基础栈 256B */
  int budget = base + max_depth * frame;
  printf("最大嵌套深度 = %d  (抢占链 A<-B<-C)\n", max_depth);
  printf("最坏栈预算 = %d B (base %d + %d 层 x %d)\n", budget, base, max_depth, frame);
  if (max_depth != 3) ok = 0;
  if (budget != base + 3 * frame) ok = 0;
  printf("结论: 栈必须按最坏嵌套深度预留, 而非单个 ISR 用量\n");
  printf("RESULT: %s\n", ok ? "PASS" : "FAIL");
  return ok ? 0 : 1;
}
