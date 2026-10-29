# 任务与调度

```zhizhan-anchor
m02
```



任务状态与 TCB；优先级抢占；时间片轮转；就绪链表；上下文切换；PendSV 为什么设为最低优先级。

 

> 前置：了解 Cortex-M 异常模型（MSP/PSP、异常优先级）与任务/TCB 的基本概念。 · ◷ 约 44 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能说明任务状态与优先级抢占/时间片轮转规则，并解释上下文切换为何放在最低优先级的 PendSV。

 

本章速览




- 任务 = 独立栈 \+ TCB \+ 优先级；上下文切换在 PendSV（最低优先级异常）里完成。

- 固定优先级可抢占：高优先级就绪立刻抢占；同优先级可按时间片轮转。

- ESP32 双核可用亲和把任务钉到某个核；Cortex-M 单核靠优先级与中断。

 

```zhizhan-anchor
m02-task
```



```zhizhan-anchor
m02-task-t
```



## 2.1 任务状态与调度规则



任务 = 独立栈 \+ TCB \+ 优先级 \+ 状态（运行/就绪/阻塞/挂起）。调度器在 tick 与阻塞/唤醒后，从就绪链表选优先级最高的任务；同优先级按时间片轮转。



```zhizhan-anchor
fig-图-2-1
```



**图 2.1**  调度器选下一个任务



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="调度器选下一个任务" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">就绪链表</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">选最高优先级</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">轮转</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">切换</text></svg>
```



就绪链表 → 选最高优先级 → 同优先级轮转 → 上下文切换（PendSV）→ 运行。



表 2.1 调度机制



| 机制 | 规则 | 后果 |
| --- | --- | --- |
| 固定优先级抢占 | 高优先级就绪即抢占 | 响应时间可预测 |
| 时间片轮转 | 同优先级轮流一个 tick | 同优先级不被饿死 |
| 阻塞 | 等待事件/延时让出 CPU | CPU 不空转 |
| PendSV 切换 | 最低优先级异常里切换 | 中断先处理完再切换 |



```zhizhan-anchor
m02-evidence
```



```zhizhan-anchor
m02-evidence-t
```



## 2.2 真实证据：抢占与核账



抢占调度的真实时间轴与利用率核账：



````zhizhan-details
{"title":"共用程序 · 按需展开完整代码","body":"host\\_sched.cC\n\n \n\n```text\n/* Single CPU tick model: D=T, fixed C, no ISR/blocking/switch cost.\n * Response includes waiting: completion - release. Lower prio wins.\n * At missed deadline explicitly DROP unfinished job and release the next.\n * This models a declared overload policy, not an RTOS implementation. */\n#include <stdio.h>\n#include <string.h>\ntypedef struct {\n    int prio, period, cost;\n    int release, remaining, released, finished, missed, ticks, max_response;\n} Task;\nstatic int simulate(Task *a, int n, int horizon, char *trace) {\n    int rr=0, previous=-1, preemptions=0;\n    for (int t=0; t<horizon; ++t) {\n        for (int i=0; i<n; ++i) if (t % a[i].period == 0) {\n            if (a[i].remaining) ++a[i].missed;\n            a[i].release=t; a[i].remaining=a[i].cost; ++a[i].released;\n        }\n        int pick=-1;\n        for (int k=0; k<n; ++k) {\n            int i=(rr+k)%n;\n            if (a[i].remaining && (pick<0 || a[i].prio<a[pick].prio)) pick=i;\n        }\n        if (pick<0) { if(trace) trace[t]='.'; previous=-1; continue; }\n        if (previous>=0 && previous!=pick && a[previous].remaining &&\n            a[pick].prio<a[previous].prio) ++preemptions;\n        if(trace) trace[t]=(char)('a'+pick);\n        --a[pick].remaining; ++a[pick].ticks;\n        if (!a[pick].remaining) {\n            int response=t+1-a[pick].release;\n            if(response>a[pick].max_response) a[pick].max_response=response;\n            ++a[pick].finished;\n        }\n        rr=(pick+1)%n; /* one tick slice, not run-to-completion */\n        previous=a[pick].remaining ? pick : -1;\n    }\n    /* Fixtures end on a common deadline. */\n    for(int i=0;i<n;++i) if(a[i].remaining) ++a[i].missed;\n    if(trace) trace[horizon]='\\0';\n    return preemptions;\n}\nstatic int check(int condition,const char *name) {\n    if(!condition) fprintf(stderr,\"FAIL: %s\\n\",name);\n    return condition;\n}\nint main(void) {\n    Task normal[3]={{.prio=1,.period=10,.cost=3},\n                    {.prio=2,.period=20,.cost=5},\n                    {.prio=3,.period=40,.cost=8}};\n    char trace[641]; int preemptions=simulate(normal,3,640,trace),ok=1;\n    /* Independent RTA: R_i=C_i+sum ceil(R_i/T_j)*C_j.\n     * A=3; B=5+3=8; C: 8 ->16 ->19 ->19. */\n    const int response[]={3,8,19},jobs[]={64,32,16};\n    for(int i=0;i<3;++i) {\n        printf(\"%c response=%d completed=%d missed=%d\\n\",'A'+i,\n               normal[i].max_response,normal[i].finished,normal[i].missed);\n        ok &= check(normal[i].max_response==response[i],\"independent RTA\");\n        ok &= check(normal[i].finished==jobs[i] && !normal[i].missed,\"all jobs\");\n    }\n    printf(\"trace[0:40]=%.40s\\npreemptions=%d\\n\",trace,preemptions);\n    ok &= check(preemptions==16,\"preemption of unfinished job\");\n    ok &= check(normal[0].ticks+normal[1].ticks+normal[2].ticks==480,\"CPU accounting\");\n    Task equal[2]={{.prio=1,.period=10,.cost=5},{.prio=1,.period=10,.cost=5}};\n    char rr[11]; simulate(equal,2,10,rr);\n    ok &= check(strcmp(rr,\"ababababab\")==0,\"one-tick round robin\");\n    printf(\"round_robin=%s\\n\",rr);\n    Task over[3]={{.prio=1,.period=10,.cost=9},{.prio=2,.period=20,.cost=5},\n                  {.prio=3,.period=40,.cost=8}};\n    simulate(over,3,40,NULL);\n    ok &= check(over[0].finished==4 && over[1].missed==2 && over[2].missed==1,\"overload\");\n    for(int i=0;i<3;++i)\n        ok &= check(over[i].released==over[i].finished+over[i].missed,\"no silent loss\");\n    printf(\"overload_misses=%d/%d/%d (drop at deadline)\\n\",over[0].missed,over[1].missed,over[2].missed);\n    puts(ok ? \"RESULT: PASS\" : \"RESULT: FAIL\"); return !ok;\n}\n```\n\n抢占调度模型（主机 gcc 真实编译运行）"}
````



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_sched.c -o labs/host_sched && ./labs/host_sched
A response=3 completed=64 missed=0
B response=8 completed=32 missed=0
C response=19 completed=16 missed=0
trace[0:40]=aaabbbbbccaaacccccc.aaabbbbb..aaa.......
preemptions=16
round_robin=ababababab
overload_misses=0/2/1 (drop at deadline)
RESULT: PASS
```



抢占 16 次；核账 480=480，说明调度器没有“丢时间”也无重复。



表 2.2 调度指标



| 量 | 值 | 说明 |
| --- | --- | --- |
| 抢占次数 | 16 | 高打断低 |
| 期望运行 | 480 | Σexec×完成 |
| 实际运行 | 480 | 核账一致 |
| PendSV | 最低优先级 | 中断优先 |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm02-plat\n```\n\n\n\n```zhizhan-anchor\nm02-plat-t\n```\n\n\n\n## 2.3 三平台对照：切换与双核\n\n\n\n上下文切换由各架构端口完成；r4-r11/PSP 属 Cortex-M 描述，不适用于本册 Xtensa ESP32。三份代码均真实交叉编译。\n\n\n\nm02\\_pendsv.cC\n\n \n\n```text\n/* m02_pendsv.c —— 上下文切换发生在 PendSV（Cortex-M3）。\n * 关键点：PendSV 设为最低优先级，保证所有中断处理完后才切换；\n * 硬件已自动压栈 r0-r3/r12/lr/pc/xPSR，端口层只需保存 r4-r11 并切换 PSP。 */\n#include <stdint.h>\n#include \"rtos_cm.h\"\n\ntypedef struct { uint32_t *sp; } tcb_t;    /* 这里只留栈指针，够讲清切换 */\ntcb_t * volatile pxCurrent = 0;            /* 当前任务 */\ntcb_t * volatile pxNext    = 0;            /* 下一个任务 */\n\n__attribute__((naked)) void PendSV_Handler(void) {\n    __asm volatile(\n        \".syntax unified\\n\"\n        \"mrs   r0, psp\\n\"\n        \"isb\\n\"\n        \"stmdb r0!, {r4-r11}\\n\"        /* 保存被调者保存寄存器 */\n        \"ldr   r1, =pxCurrent\\n\"\n        \"ldr   r2, [r1]\\n\"\n        \"str   r0, [r2]\\n\"             /* pxCurrent->sp = r0 */\n        \"ldr   r3, =pxNext\\n\"\n        \"ldr   r2, [r3]\\n\"\n        \"str   r2, [r1]\\n\"             /* pxCurrent = pxNext */\n        \"ldr   r0, [r2]\\n\"             /* r0 = pxNext->sp */\n        \"ldmia r0!, {r4-r11}\\n\"\n        \"msr   psp, r0\\n\"\n        \"isb\\n\"\n        \"bx    lr\\n\");\n}\n\n/* SysTick 每 tick 选出下一个任务，然后挂起 PendSV 让切换在最低优先级发生 */\nvoid SysTick_Handler(void) {\n    pxNext = pxCurrent;\n    cm_pend_pendsv();\n}\n```\n\nSTM32F103 · PendSV\n\n\n\nesp\\_m02\\_dualcore.cC\n\n \n\n```text\n/* esp_m02_dualcore.c —— 双核：把任务固定到指定核（ESP32 / Xtensa LX6）。\n * ESP32 有 2 个核，xTaskCreatePinnedToCore 的最后参数就是亲和核。 */\n#include \"esp_idf_api.h\"\n#include \"rtos_api.h\"\n\nstatic void worker(void *arg) {\n    (void)arg;\n    for (;;) { vTaskDelay(pdMS_TO_TICKS(10)); }\n}\n\nvoid esp_m02_pin_cores(void) {\n    TaskHandle_t a = 0, b = 0;\n    (void)xTaskCreatePinnedToCore(worker, \"acq\",  4096u, 0, 3u, &a, 0);  /* 核 0：采集 */\n    (void)xTaskCreatePinnedToCore(worker, \"link\", 4096u, 0, 3u, &b, 1);  /* 核 1：通信 */\n}\n\n/* 当前任务运行在哪个核（用于确认亲和是否生效） */\nBaseType_t esp_m02_where(void) { return xPortGetCoreID(); }\n```\n\nESP32 · 双核\n\n\n\nh7\\_m02\\_fpu.cC\n\n \n\n```text\n/* h7_m02_fpu.c —— Cortex-M7 的 FPU 上下文（lazy stacking）。\n * 只有真正用过 FPU 的任务才需要保存 S0-S15；端口层按需 vpush/vpop，\n * 不用浮点的任务不为 FPU 付切换成本。 */\n#include <stdint.h>\n#include \"rtos_cm.h\"\n\nvolatile uint32_t h7_fpu_ready = 0u;\n\nvoid h7_fpu_init(void) {\n    (*(volatile uint32_t *)0xE000ED88u) |= (0xFu << 20);   /* CPACR：使能 CP10/CP11 */\n    cm_dsb();\n    cm_isb();\n    h7_fpu_ready = 1u;\n}\n\nvoid h7_fpu_context_save(void)    { cm_fpu_save(); }\nvoid h7_fpu_context_restore(void) { cm_fpu_restore(); }\n```\n\nSTM32H7 · FPU 上下文\n\n\n\n表 2.3 三平台切换\n\n\n\n| 维度 | STM32F103 | ESP32 | STM32H7 |\n| --- | --- | --- | --- |\n| 切换异常 | PendSV(最低) | 跨核/软中断 | PendSV |\n| 保存 | r4-r11 | r4-r11\\+核 | r4-r11\\+FPU |\n| 任务栈 | PSP | PSP | PSP |\n| FPU | 无 | 无 | 惰性保存 S0-S31 |"}
````



```zhizhan-anchor
m02-check
```



```zhizhan-anchor
m02-check-t
```



## 2.4 自检



调度自检：优先级方向、轮转、PendSV 最低、栈对齐。



```zhizhan-anchor
fig-图-2-2
```



**图 2.2**  PendSV 在最低优先级完成切换



```zhizhan-figure
<svg viewBox="0 0 800 120" width="100%" height="120" role="img" aria-label="PendSV 在最低优先级完成切换" preserveAspectRatio="xMidYMid meet"><path class="sv-dash" d="M150,26 V94"></path><text x="150" y="18" text-anchor="middle" class="sv-lbl-dim">0</text><path class="sv-dash" d="M305,26 V94"></path><text x="305" y="18" text-anchor="middle" class="sv-lbl-dim">5</text><path class="sv-dash" d="M460,26 V94"></path><text x="460" y="18" text-anchor="middle" class="sv-lbl-dim">10</text><path class="sv-dash" d="M615,26 V94"></path><text x="615" y="18" text-anchor="middle" class="sv-lbl-dim">15</text><path class="sv-dash" d="M770,26 V94"></path><text x="770" y="18" text-anchor="middle" class="sv-lbl-dim">20</text><text x="12" y="48" class="sv-lbl">中断</text><path class="sv-dash" d="M150,44 H770"></path><rect x="150" y="32" width="310" height="22" rx="4" class="sv-red-s"></rect><text x="305.0" y="47" text-anchor="middle" class="sv-lbl-hi">IRQ</text><text x="12" y="82" class="sv-lbl">PendSV</text><path class="sv-dash" d="M150,78 H770"></path><rect x="460" y="66" width="310" height="22" rx="4" class="sv-grn-s"></rect><text x="615.0" y="81" text-anchor="middle" class="sv-lbl-hi">switch</text></svg>
```



中断先执行完，PendSV（最低）最后做上下文切换；中断响应不被“正在切换”挡住。



表 2.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 优先级 | 高即抢占 | 方向搞反 |
| 轮转 | 同优先级 | 饿死低优 |
| PendSV | 最低优先级 | 设成高优 |
| 栈 | 8 字节对齐 | 非对齐 |



```zhizhan-anchor
m02-pitfalls
```



```zhizhan-anchor
m02-pitfalls-t
```



## 2.5 常见误区与排障



失败路径与排障




- **PendSV 设成高优先级** ：切换会打断中断，中断延迟不可控。

- **任务栈不对齐** ：Cortex-M 异常入栈要求 8 字节对齐。

- **把大工作放进高优先级任务** ：低优先级（含空闲）饿死，看门狗超时。

- **用 delay 做周期** ：会漂移，应用 vTaskDelayUntil。



◆ 自测 · Module 02（先答再看）




1. 为什么上下文切换放在最低优先级的 PendSV？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"任何中断都能先执行完，切换只在所有中断处理完后发生；中断响应不会被“正在切换”挡住，也避免在中断里直接切栈的竞态。"}
   ```

2. 两个同优先级任务都不主动阻塞会怎样？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"时间片轮转让它们在彼此间交替，但更低优先级任务永远得不到运行（被饿死）。要给低优先级留出让点或提优先级。"}
   ```

3. 上下文切换的实质保存/恢复什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"硬件进场已压 r0-r3/r12/lr/pc/xPSR；端口层再保存 r4-r11，把 SP 存进 TCB，从下一个 TCB 恢复 SP 与 r4-r11，并切 PSP。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你系统确认任务优先级方向与 PendSV 优先级设置，并核对任务栈 8 字节对齐。



核对与延伸：[FreeRTOS 官方文档 · Tasks / Scheduling / Synchronization](https://www.freertos.org/RTOS.html) · [ARM · Cortex-M3/M7 与 ARMv7-M 架构参考](https://developer.arm.com/documentation/dui0552/latest/)

 

动手练习



编译 ` labs/m02_pendsv.c `（M3）看 PendSV\_Handler；运行 ` labs/host_sched.c ` 观察抢占与轮转。



**检查结果：** 说明示意 PendSV 的 r4-r11 软件保存与异常硬件压栈的区别；完整移植还须处理 EXC\_RETURN、栈对齐及适用的 FPU 上下文；同优先级任务份额相差不超过 1 tick。

 

迁移练习：把本章的“能说明任务状态与优先级抢占/时间片轮转规则，并解释上下文切换为何放在最低优先级的 PendSV。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 02 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b06-m02","criterion":"说明示意 PendSV 的 r4-r11 软件保存与异常硬件压栈的区别；完整移植还须处理 EXC_RETURN、栈对齐及适用的 FPU 上下文；同优先级任务份额相差不超过 1 tick。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b06-guide)
