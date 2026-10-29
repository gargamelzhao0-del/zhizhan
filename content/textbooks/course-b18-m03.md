# 异常、中断与特权级

```zhizhan-anchor
m03
```



中断不是“跳到一个函数”那么简单：它是硬件发起的、带优先级、可嵌套、会保存现场的异步调用。本章把“谁先响应、能嵌几层、栈要留多少、谁能做什么”讲清楚——这四问直接决定系统是否实时、是否稳定、是否隔离。

 

> 前置：会写 C、了解向量表与栈；读过 [M02](doc:course-b18-m02#m02) 的调用约定更好。 · ◷ 约 44 分钟 · ◈ Cortex-M / Cortex-A / RISC-V 对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能配置中断优先级与嵌套，按最坏嵌套深度预留栈，并说清特权级/双栈如何实现隔离。

 

本章速览




- 异常/中断是异步调用：保存现场、跳向量、返回。

- 优先级与嵌套决定响应；栈要留最坏深度。

- 特权级用于隔离，越权触发异常。

 

```zhizhan-anchor
m03-model
```



```zhizhan-anchor
m03-model-t
```



## 3.1 异常模型：硬件发起的“异步调用”



异常/中断是 CPU 在 **当前指令之间** 插入的一段处理：硬件自动 **保存现场** 、从 **向量表** 取入口地址、跳到处理程序，处理完再 **恢复现场** 返回。与普通函数调用（M02）最大的不同是： **发起者是硬件、发生在任意时刻、优先级由硬件裁决** 。



```zhizhan-anchor
fig-图-3-1
```



**图 3.1**  一次中断响应的五个阶段



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="一次中断响应的五个阶段" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="88.0" y="66" text-anchor="middle" class="sv-lbl-hi">① 触发/到达</text><path d="M158,69 H174" class="sv-arrow"></path><rect x="176" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="244.0" y="66" text-anchor="middle" class="sv-lbl-hi">② 硬件保存现场</text><path d="M314,69 H330" class="sv-arrow"></path><rect x="332" y="44" width="136" height="50" rx="7" class="sv-cyn-s"></rect><text x="400.0" y="66" text-anchor="middle" class="sv-lbl-hi">③ 取向量表</text><path d="M470,69 H486" class="sv-arrow"></path><rect x="488" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="556.0" y="66" text-anchor="middle" class="sv-lbl-hi">④ 执行 ISR</text><path d="M626,69 H642" class="sv-arrow"></path><rect x="644" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="712.0" y="66" text-anchor="middle" class="sv-lbl-hi">⑤ 恢复并返回</text></svg>
```



触发 → 硬件压栈(保存现场) → 取向量 → 执行 ISR → 恢复现场返回。中间任何一步的配置错误都会表现为“中断丢失 / 栈溢出 / 返回跑飞”。



表 3.1 异常模型的关键概念



| 概念 | 作用 | 关键点 |
| --- | --- | --- |
| 向量表 | 存放各异常的入口地址 | 可重定位 (VTOR)，见 M01 |
| 异常号/优先级 | 决定谁先被响应 | 数值语义依平台（见 3.2） |
| 现场保存 | 保住被打断的执行环境 | 压多少寄存器由架构定义 |
| 异常返回 | 回到被打断处 | 用特殊返回（EXC\_RETURN） |
| 使能/挂起 | 控制异常是否响应 | 漏清除挂起 → 反复进入 |



```zhizhan-anchor
m03-prio
```



```zhizhan-anchor
m03-prio-t
```



## 3.2 优先级与抢占：谁先响应



中断常同时到达，靠 **优先级** 裁决。Cortex-M 的 NVIC 采用 **可抢占优先级** ： **数值越小优先级越高** ，高抢占优先级可以打断正在执行的低优先级 ISR（嵌套）。下面这段主机程序用一个离散事件模型，把抢占时间线真实地跑出来：



host\_exc.cC

 

```text
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
```

可抢占优先级 \+ 嵌套 \+ 栈预算（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_exc.c -o labs/host_exc && ./labs/host_exc
时间线（数值越小优先级越高）:
  t=  0  IRQ_A 开始 (pri=2)
  t= 20  IRQ_B 开始 (pri=1)
  t= 40  IRQ_C 开始 (pri=0)
  t= 50  IRQ_C 完成
  t= 60  IRQ_B 完成
  t=140  IRQ_A 完成
  t=140  IRQ_D 开始 (pri=3)
  t=180  IRQ_D 完成
最大嵌套深度 = 3  (抢占链 A<-B<-C)
最坏栈预算 = 448 B (base 256 + 3 层 x 64)
结论: 栈必须按最坏嵌套深度预留, 而非单个 ISR 用量
RESULT: PASS
```



B 在 t=20 抢占 A，C 在 t=40 抢占 B（此时 A、B、C 三层并存）；A 直到 140 才跑完——这就是“高优先级打断低优先级”的真实顺序。



nvic\_priority.c 节选C

 

```text
// Cortex-M：设抢占优先级 1（数值越小越高），并使能
NVIC_SetPriority(IRQ_B, 1);
NVIC_SetPriority(IRQ_C, 0);   // 最高 → 可抢占 B
NVIC_EnableIRQ(IRQ_B);
NVIC_EnableIRQ(IRQ_C);
// 注意：同抢占优先级不能互相嵌套（见“两级优先级”提示框）
```

优先级配置：数值越小越先响应；抢占优先级相同则不嵌套



```zhizhan-anchor
fig-图-3-2
```



**图 3.2**  抢占时间线：A 被 B、C 连续打断



```zhizhan-figure
<svg viewBox="0 0 800 188" width="100%" height="188" role="img" aria-label="抢占时间线：A 被 B、C 连续打断" preserveAspectRatio="xMidYMid meet"><path class="sv-dash" d="M150,26 V162"></path><text x="150" y="18" text-anchor="middle" class="sv-lbl-dim">0</text><path class="sv-dash" d="M305,26 V162"></path><text x="305" y="18" text-anchor="middle" class="sv-lbl-dim">45</text><path class="sv-dash" d="M460,26 V162"></path><text x="460" y="18" text-anchor="middle" class="sv-lbl-dim">90</text><path class="sv-dash" d="M615,26 V162"></path><text x="615" y="18" text-anchor="middle" class="sv-lbl-dim">135</text><path class="sv-dash" d="M770,26 V162"></path><text x="770" y="18" text-anchor="middle" class="sv-lbl-dim">180</text><text x="12" y="48" class="sv-lbl">IRQ_A(pri2)</text><path class="sv-dash" d="M150,44 H770"></path><rect x="150" y="32" width="69" height="22" rx="4" class="sv-cyn-s"></rect><text x="184.4" y="47" text-anchor="middle" class="sv-lbl-hi">A</text><rect x="357" y="32" width="276" height="22" rx="4" class="sv-cyn-s"></rect><text x="494.4" y="47" text-anchor="middle" class="sv-lbl-hi">A 续</text><text x="12" y="82" class="sv-lbl">IRQ_B(pri1)</text><path class="sv-dash" d="M150,78 H770"></path><rect x="219" y="66" width="69" height="22" rx="4" class="sv-amb-s"></rect><text x="253.3" y="81" text-anchor="middle" class="sv-lbl-hi">B</text><rect x="322" y="66" width="34" height="22" rx="4" class="sv-amb-s"></rect><text x="339.4" y="81" text-anchor="middle" class="sv-lbl-hi">B 续</text><text x="12" y="116" class="sv-lbl">IRQ_C(pri0)</text><path class="sv-dash" d="M150,112 H770"></path><rect x="288" y="100" width="34" height="22" rx="4" class="sv-red-s"></rect><text x="305.0" y="115" text-anchor="middle" class="sv-lbl-hi">C</text><text x="12" y="150" class="sv-lbl">IRQ_D(pri3)</text><path class="sv-dash" d="M150,146 H770"></path><rect x="632" y="134" width="138" height="22" rx="4" class="sv-box"></rect><text x="701.1" y="149" text-anchor="middle" class="sv-lbl-hi">D</text></svg>
```



横轴为时间。IRQ\_D（pri=3）最低，只能等 A 完成后才运行；IRQ\_A 被 B、C 各抢占一次，因此拖到 t=140 才结束。这解释“为什么加了高优先级中断后，低优先级中断的响应抖动变大”。



Cortex-M 的两级优先级



NVIC 优先级分  **抢占优先级** （决定能否打断）与  **子优先级** （决定同时挂起时谁先跑，但不嵌套）。分组（PRIGROUP）决定两者各占多少位。 **抢占优先级相同则不能互相打断** ——这是“两级中断为什么没嵌套”的常见原因。



```zhizhan-anchor
m03-stack
```



```zhizhan-anchor
m03-stack-t
```



## 3.3 嵌套与栈预算：最坏深度决定栈



每次进入 ISR 都会压入现场（可能还有嵌套），所以栈要按 **最坏嵌套深度** 预留，而不是按“单个 ISR 的用量”。上例中抢占链 A←B←C 使深度达到 3，栈预算 = 基础栈 \+ 3×每层帧。



表 3.2 栈预算的算法



| 量 | 含义 | 怎么定 |
| --- | --- | --- |
| 单层帧大小 | 压栈寄存器 \+ 局部变量 | 看编译器生成的 prologue |
| 最大嵌套深度 | 同时“在途”的 ISR 层数 | 按优先级链最坏情况推 |
| 基础栈 | main/普通调用所需 | 由最坏调用链估计 |
| 总预算 | 基础 \+ 深度×帧 | 留 20–30% 余量，加哨兵检测 |
| 检测 | 栈哨兵 / MPU 保护区 | 越界即触发故障（见 M05） |



栈溢出的两种典型表现



①  **悄悄改坏别的变量** （溢出到 .data/.bss）；②  **触发 HardFault** （碰到 MPU/权限边界）。前者更难查。实践：给栈区填“魔数”并在空闲时扫描，或让 MPU 把栈底设为不可访问。这与 B01 M04 的栈哨兵同源。



```zhizhan-anchor
m03-priv
```



```zhizhan-anchor
m03-priv-t
```



## 3.4 特权级与双栈：隔离从哪来



“谁能做什么”由 **特权级** 决定。Cortex-M 有 Thread/Handler 两种模式与特权/非特权两种级别；Cortex-A 有 EL0–EL3 异常级；RISC-V 有 M/S/U 三级。特权级是操作系统隔离与安全的基础。



表 3.3 特权级与栈分离



| 平台 | 级别/模式 | 谁在跑 | 隔离手段 |
| --- | --- | --- | --- |
| Cortex-M | Thread / Handler × 特权/非特权 | 任务 / ISR | MPU（见 M05） |
| Cortex-A | EL0–EL3 | 用户 / 内核 / 虚拟化 | MMU 页表权限 |
| RISC-V | U / S / M | 用户 / 内核 / 机器 | PMP \+ 页表 |
| 双栈 | MSP（内核）/ PSP（任务） | 内核 / 任务 | 栈分离，互不污染 |



为什么 RTOS 用双栈 (MSP/PSP)



内核（含所有 ISR）用  **MSP** ，任务用  **PSP** 。这样中断永远有一个“干净的栈”，不会因为某个任务栈溢出而拖垮整个内核；任务切换时只需换 PSP。这是“任务栈 \+ 独立中断栈”的实现基础。



critical\_section.c 节选C

 

```text
// 访问“多字段共享”的寄存器时，必须整段原子（见 M01 的 RMW 陷阱）
uint32_t primask = __get_PRIMASK();
__disable_irq();                 // 关中断，进入临界区
REG = (REG & ~M_MODE) | (mode << S_MODE);
__set_PRIMASK(primask);          // 恢复之前的中断状态（不要无条件开中断）
```

临界区：关中断 → 原子改 → 恢复原状态；恢复而非无条件开中断是关键



```zhizhan-anchor
m03-ctx
```



```zhizhan-anchor
m03-ctx-t
```



## 3.5 上下文：到底保存了什么



“保存现场”不是抽象词。Cortex-M 在进入异常时由 **硬件自动** 压入 8 个字（所谓的异常栈帧），其余寄存器由软件（编译器生成或 RTOS）按需保存。理解这份栈帧，才能读懂 RTOS 的任务切换与 HardFault 现场。



```zhizhan-anchor
fig-图-3-3
```



**图 3.3**  Cortex-M 进入异常时的自动压栈（地址从高到低）



```zhizhan-figure
<svg viewBox="0 0 800 200" width="100%" height="200" role="img" aria-label="Cortex-M 进入异常时的自动压栈（地址从高到低）" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-box"></rect><text x="75" y="49.0" class="sv-lbl-hi">← 异常发生前的 SP</text><rect x="60" y="64" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="83.0" class="sv-lbl-hi">xPSR</text><rect x="60" y="98" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="117.0" class="sv-lbl-hi">PC（返回地址）</text><rect x="60" y="132" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="151.0" class="sv-lbl-hi">LR</text><rect x="60" y="166" width="680" height="30" rx="6" class="sv-box"></rect><text x="75" y="185.0" class="sv-lbl-hi">R12</text><rect x="60" y="200" width="680" height="38" rx="6" class="sv-grn-s"></rect><text x="75" y="222.8" class="sv-lbl-hi">R3 / R2 / R1 / R0</text><rect x="60" y="242" width="680" height="30" rx="6" class="sv-box"></rect><text x="75" y="260.5" class="sv-lbl-hi">← 异常中的 SP（MSP）</text></svg>
```



硬件自动压入 xPSR、PC、LR、R12、R3–R0 共 8 个字（从高地址向低地址）。返回时按同样的顺序弹回。RTOS 切换任务时保存/恢复的正是这份“上下文”。



表 3.4 上下文组成与保存者



| 寄存器 | 谁保存 | 用途 |
| --- | --- | --- |
| R0–R3, R12, LR, PC, xPSR | 硬件自动 | 基本执行环境 |
| R4–R11 | 软件（被调者） | 跨 ISR 使用的变量 |
| 浮点寄存器 (S0–S31) | 按需（惰性压栈） | 有 FPU 时 |
| PSP/MSP | 硬件切换 | 栈指针分离 |



```zhizhan-anchor
m03-pitfalls
```



```zhizhan-anchor
m03-pitfalls-t
```



## 3.6 常见误区与排障



失败路径与排障




- **优先级配错** ：抢占优先级相同 → 高优先级不嵌套，实时性不达预期。

- **栈按单 ISR 用量留** ：忽略嵌套 → 溢出改坏数据。

- **ISR 里做耗时/阻塞操作** ：拉长其他中断响应，抖动变大。

- **漏清中断/挂起标志** ：退出后立刻重入，表现为“卡死在中断里”。

- **无特权隔离** ：一个任务出错拖垮全系统（应配 MPU/MMU）。



◆ 自测 · Module 03（先答再看）




1. 两个中断的“抢占优先级”相同时，会发生嵌套吗？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"不会。抢占优先级相同则 **不能互相打断** ，只能等先来的跑完；此时由子优先级决定同时挂起时的先后。这是“为什么配了高优先级却没嵌套”的首因。"}
   ```

2. 为什么中断栈要按“最坏嵌套深度”而不是单个 ISR 用量预留？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"每次进入 ISR 都会压入现场；高优先级打断低优先级会 **叠加栈帧** 。示例中 A←B←C 三层并存，栈 = 基础 \\+ 3×每层帧（见 ` host_exc.c ` 输出 448B）。"}
   ```

3. Cortex-M 进入异常时，硬件自动压栈了哪些寄存器？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"压入  **xPSR、PC、LR、R12、R3–R0**  共 8 个字（地址由高到低）。R4–R11 由软件（编译器/RTOS）保存。RTOS 任务切换保存/恢复的就是这份上下文。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：用你的芯片手册列出所有会用到中断的优先级数值，画出最坏抢占链，据此核算中断栈预算并加 20% 余量。



核对与延伸：[ARM Cortex-M 文档](https://developer.arm.com/documentation/) · [Arm 内存序与屏障](https://developer.arm.com/documentation/100941/latest/)

 

动手练习



运行 ` labs/host_exc.c `：看可抢占优先级如何决定响应顺序、最大嵌套深度如何决定栈预算。



**检查结果：** 优先级数值越小越先响应；抢占链 A←B←C 的最大嵌套深度=3，栈预算=256\+3×64=448B。

 

迁移练习：把本章的“能配置中断优先级与嵌套，按最坏嵌套深度预留栈，并说清特权级/双栈如何实现隔离。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 03 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b18-m03","criterion":"优先级数值越小越先响应；抢占链 A←B←C 的最大嵌套深度=3，栈预算=256+3×64=448B。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b18-guide)
