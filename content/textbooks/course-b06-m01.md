# 为什么需要 RTOS

```zhizhan-anchor
m01
```



前后台轮询的定量缺陷；响应抖动来自哪里；RTOS 的成本（RAM/Flash/复杂度）；什么时候不该用。

 

> 前置：了解裸机前后台（super-loop）轮询结构，以及“周期/执行时间”的含义。 · ◷ 约 44 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能定量指出前后台轮询的响应抖动来源，用利用率筛查过载，再用含阻塞/抖动的响应时间分析判断截止期。

 

本章速览




- 前后台轮询的响应时间 = 所有任务执行时间之和，慢任务会直接拖慢快任务。

- RTOS 用“可抢占 \+ 优先级”把响应时间解耦；代价是每个任务一块栈与切换开销。

- 先问“抖动/截止期真的需要吗”：不需要就别上 RTOS，简单可靠优先。

 

```zhizhan-anchor
m01-frontback
```



```zhizhan-anchor
m01-frontback-t
```



## 1.1 前后台轮询的结构性缺陷



一句话：前后台（super-loop）里，快任务的响应时间等于循环里所有任务执行时间之和。只要有一个慢任务在忙，快任务就得等——这是“抖动”的结构性来源，与代码写得对不对无关。



```zhizhan-anchor
fig-图-1-1
```



**图 1.1**  同一循环里快任务被慢任务拖累



```zhizhan-figure
<svg viewBox="0 0 800 120" width="100%" height="120" role="img" aria-label="同一循环里快任务被慢任务拖累" preserveAspectRatio="xMidYMid meet"><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="var(--grn)"></path></marker><marker id="aha" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="var(--amb)"></path></marker></defs><path class="sv-dash" d="M150,26 V94"></path><text x="150" y="18" text-anchor="middle" class="sv-lbl-dim">0</text><path class="sv-dash" d="M299,26 V94"></path><text x="299" y="18" text-anchor="middle" class="sv-lbl-dim">12</text><path class="sv-dash" d="M460,26 V94"></path><text x="460" y="18" text-anchor="middle" class="sv-lbl-dim">25</text><path class="sv-dash" d="M621,26 V94"></path><text x="621" y="18" text-anchor="middle" class="sv-lbl-dim">38</text><path class="sv-dash" d="M770,26 V94"></path><text x="770" y="18" text-anchor="middle" class="sv-lbl-dim">50</text><text x="12" y="48" class="sv-lbl">循环</text><path class="sv-dash" d="M150,44 H770"></path><rect x="150" y="32" width="496" height="22" rx="4" class="sv-red-s"></rect><text x="398.0" y="47" text-anchor="middle" class="sv-lbl-hi">慢任务 5ms</text><rect x="646" y="32" width="124" height="22" rx="4" class="sv-grn-s"></rect><text x="708.0" y="47" text-anchor="middle" class="sv-lbl-hi">快任务 1ms</text><text x="12" y="82" class="sv-lbl">快任务响应</text><path class="sv-dash" d="M150,78 H770"></path><rect x="150" y="66" width="620" height="22" rx="4" class="sv-amb-s"></rect><text x="460.0" y="81" text-anchor="middle" class="sv-lbl-hi">被拖长</text></svg>
```



快任务每轮都要等慢任务跑完才能再次执行；慢任务越长，快任务响应越大、抖动越大。



表 1.1 前后台 vs RTOS



| 维度 | 前后台轮询 | RTOS |
| --- | --- | --- |
| 响应确定性 | 取决于循环总耗时 | 由优先级与截止期决定 |
| 代码结构 | 线性、易读 | 多任务\+同步，需设计 |
| 内存 | 一份栈 | 每任务栈 \+ TCB |
| 开销 | 几乎为零 | 切换、tick、同步原语 |
| 适用 | 任务少、无硬实时 | 并发活动且有响应期限 |



```zhizhan-anchor
m01-evidence
```



```zhizhan-anchor
m01-evidence-t
```



## 1.2 真实证据：抢占调度时间轴



下面这段主机程序模拟固定优先级抢占，打印时间轴、最大响应与抢占次数：



host\_sched.cC

 

```text
/* Single CPU tick model: D=T, fixed C, no ISR/blocking/switch cost.
 * Response includes waiting: completion - release. Lower prio wins.
 * At missed deadline explicitly DROP unfinished job and release the next.
 * This models a declared overload policy, not an RTOS implementation. */
#include <stdio.h>
#include <string.h>
typedef struct {
    int prio, period, cost;
    int release, remaining, released, finished, missed, ticks, max_response;
} Task;
static int simulate(Task *a, int n, int horizon, char *trace) {
    int rr=0, previous=-1, preemptions=0;
    for (int t=0; t<horizon; ++t) {
        for (int i=0; i<n; ++i) if (t % a[i].period == 0) {
            if (a[i].remaining) ++a[i].missed;
            a[i].release=t; a[i].remaining=a[i].cost; ++a[i].released;
        }
        int pick=-1;
        for (int k=0; k<n; ++k) {
            int i=(rr+k)%n;
            if (a[i].remaining && (pick<0 || a[i].prio<a[pick].prio)) pick=i;
        }
        if (pick<0) { if(trace) trace[t]='.'; previous=-1; continue; }
        if (previous>=0 && previous!=pick && a[previous].remaining &&
            a[pick].prio<a[previous].prio) ++preemptions;
        if(trace) trace[t]=(char)('a'+pick);
        --a[pick].remaining; ++a[pick].ticks;
        if (!a[pick].remaining) {
            int response=t+1-a[pick].release;
            if(response>a[pick].max_response) a[pick].max_response=response;
            ++a[pick].finished;
        }
        rr=(pick+1)%n; /* one tick slice, not run-to-completion */
        previous=a[pick].remaining ? pick : -1;
    }
    /* Fixtures end on a common deadline. */
    for(int i=0;i<n;++i) if(a[i].remaining) ++a[i].missed;
    if(trace) trace[horizon]='\0';
    return preemptions;
}
static int check(int condition,const char *name) {
    if(!condition) fprintf(stderr,"FAIL: %s\n",name);
    return condition;
}
int main(void) {
    Task normal[3]={{.prio=1,.period=10,.cost=3},
                    {.prio=2,.period=20,.cost=5},
                    {.prio=3,.period=40,.cost=8}};
    char trace[641]; int preemptions=simulate(normal,3,640,trace),ok=1;
    /* Independent RTA: R_i=C_i+sum ceil(R_i/T_j)*C_j.
     * A=3; B=5+3=8; C: 8 ->16 ->19 ->19. */
    const int response[]={3,8,19},jobs[]={64,32,16};
    for(int i=0;i<3;++i) {
        printf("%c response=%d completed=%d missed=%d\n",'A'+i,
               normal[i].max_response,normal[i].finished,normal[i].missed);
        ok &= check(normal[i].max_response==response[i],"independent RTA");
        ok &= check(normal[i].finished==jobs[i] && !normal[i].missed,"all jobs");
    }
    printf("trace[0:40]=%.40s\npreemptions=%d\n",trace,preemptions);
    ok &= check(preemptions==16,"preemption of unfinished job");
    ok &= check(normal[0].ticks+normal[1].ticks+normal[2].ticks==480,"CPU accounting");
    Task equal[2]={{.prio=1,.period=10,.cost=5},{.prio=1,.period=10,.cost=5}};
    char rr[11]; simulate(equal,2,10,rr);
    ok &= check(strcmp(rr,"ababababab")==0,"one-tick round robin");
    printf("round_robin=%s\n",rr);
    Task over[3]={{.prio=1,.period=10,.cost=9},{.prio=2,.period=20,.cost=5},
                  {.prio=3,.period=40,.cost=8}};
    simulate(over,3,40,NULL);
    ok &= check(over[0].finished==4 && over[1].missed==2 && over[2].missed==1,"overload");
    for(int i=0;i<3;++i)
        ok &= check(over[i].released==over[i].finished+over[i].missed,"no silent loss");
    printf("overload_misses=%d/%d/%d (drop at deadline)\n",over[0].missed,over[1].missed,over[2].missed);
    puts(ok ? "RESULT: PASS" : "RESULT: FAIL"); return !ok;
}
```

抢占调度模型（主机 gcc 真实编译运行）



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



A/B/C 最大响应 3/8/19 tick 均在各自周期内；利用率核账 480=480 无丢失。



表 1.2 三任务响应



| 任务 | 周期 | 执行 | 最大响应 |
| --- | --- | --- | --- |
| A（高） | 10 | 3 | 3 |
| B（中） | 20 | 5 | 8 |
| C（低） | 40 | 8 | 19 |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm01-plat\n```\n\n\n\n```zhizhan-anchor\nm01-plat-t\n```\n\n\n\n## 1.3 三平台对照：任务创建\n\n\n\n同一件事在三平台的写法不同，但“把活动拆成按截止期调度的任务”一致。三份代码均真实交叉编译。\n\n\n\nm01\\_frontback.cC\n\n \n\n```text\n/* m01_frontback.c —— 前后台轮询 vs RTOS：响应抖动的来源（Cortex-M3）。\n * 用 DWT 周期计数器当硬件秒表，量化“慢任务阻塞快任务”的代价。 */\n#include <stdint.h>\n#include \"rtos_cm.h\"\n#include \"rtos_api.h\"\n\n#define DEMCR      (*(volatile uint32_t *)0xE000EDFCu)   /* 调试异常控制：bit24 = CYCCNT 使能 */\n#define DWT_CYCCNT (*(volatile uint32_t *)0xE0001004u)   /* 周期计数器 */\n\nvoid m01_cycles_on(void) { DEMCR |= (1u << 24); DWT_CYCCNT = 0u; }\n\nvolatile uint32_t g_fast_period;   /* 快任务两次被服务之间的间隔（周期） */\n\n/* 前后台：快任务与慢任务挤在同一个循环里，慢任务直接把快任务的响应周期拉长 */\nvoid m01_superloop(void) {\n    for (;;) {\n        uint32_t t0 = DWT_CYCCNT;\n        g_fast_period = DWT_CYCCNT - t0;          /* 快任务：应立即处理 */\n        uint32_t t1 = DWT_CYCCNT;\n        while ((DWT_CYCCNT - t1) < 72000u) { }    /* 慢任务：约 1ms@72MHz 的阻塞 */\n    }\n}\n\n/* RTOS：快任务独立调度，响应周期不再被慢任务决定 */\nstatic void m01_fast_task(void *arg) {\n    (void)arg;\n    for (;;) { vTaskDelay(pdMS_TO_TICKS(1)); }\n}\nvoid m01_start(void) {\n    TaskHandle_t h = 0;\n    (void)xTaskCreate(m01_fast_task, \"fast\", 256u, 0, 2u, &h);\n}\n```\n\nSTM32F103 · 裸机→任务\n\n\n\nesp\\_m01\\_task\\_cost.cC\n\n \n\n```text\n/* esp_m01_task_cost.c —— 一个 RTOS 任务的 RAM 成本（ESP32 / XTensa）。\n * 每个任务有独立栈与 TCB；新建任务消耗的堆，就是“多任务”的价格。 */\n#include <stdint.h>\n#include \"esp_idf_api.h\"\n#include \"rtos_api.h\"\n\nstatic void idle_task(void *arg) {\n    (void)arg;\n    for (;;) { vTaskDelay(1); }\n}\n\n/* 返回新建一个 2048 字节栈任务所消耗的堆字节数（含 TCB 与本册内存分配开销） */\nuint32_t esp_m01_task_cost(void) {\n    uint32_t before = esp_get_free_heap_size();\n    TaskHandle_t h = 0;\n    (void)xTaskCreate(idle_task, \"cost\", 2048u, 0, 1u, &h);\n    return before - esp_get_free_heap_size();\n}\n```\n\nESP32 · 任务成本\n\n\n\nh7\\_m01\\_boot.cC\n\n \n\n```text\n/* h7_m01_boot.c —— 启动 RTOS 前必须完成的配置（STM32H7 / Cortex-M7）。\n * 顺序很重要：开 FPU → 装时基 → 设中断优先级阈值 → 再启动调度器。 */\n#include <stdint.h>\n#include \"rtos_cm.h\"\n\n#define CM_CPACR (*(volatile uint32_t *)0xE000ED88u)   /* 协处理器访问控制：CP10/CP11 开 FPU */\n\nvoid h7_rtos_clock_init(uint32_t core_hz) {\n    CM_CPACR |= (0xFu << 20);                 /* full access：允许 FPU 指令 */\n    cm_dsb();\n    cm_isb();\n\n    CM_SYST_RVR = (core_hz / 1000u) - 1u;      /* 1kHz 系统节拍 */\n    CM_SYST_CVR = 0u;\n    CM_SYST_CSR = 0x7u;                        /* ENABLE | TICKINT | CLKSOURCE */\n\n    cm_set_basepri(0x50u);                     /* configMAX_SYSCALL_INTERRUPT_PRIORITY */\n}\n```\n\nSTM32H7 · 启动/任务\n\n\n\n表 1.3 三平台任务创建\n\n\n\n| 维度 | STM32F103 | ESP32 | STM32H7 |\n| --- | --- | --- | --- |\n| 内核 | FreeRTOS | FreeRTOS(IDF) | FreeRTOS |\n| 优先级方向 | 越大越高 | 越大越高 | 越大越高 |\n| 创建 | xTaskCreate | xTaskCreate | xTaskCreate |\n| 栈 | 静态/动态 | 静态/动态 | 静态/动态 |"}
````



```zhizhan-anchor
m01-check
```



```zhizhan-anchor
m01-check-t
```



## 1.4 自检



RTOS 选型自检：有并发活动、有响应期限、成本可接受、否则不用。



```zhizhan-anchor
fig-图-1-2
```



**图 1.2**  三任务最大响应 vs 周期（真实值）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="三任务最大响应 vs 周期（真实值）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">A 响应</text><rect x="150" y="26" width="40" height="18" rx="4" class="sv-grn-s"></rect><text x="198" y="43" class="sv-lbl-hi">3tick</text><text x="12" y="67" class="sv-lbl">B 响应</text><rect x="150" y="50" width="107" height="18" rx="4" class="sv-grn-s"></rect><text x="265" y="67" class="sv-lbl-hi">8tick</text><text x="12" y="91" class="sv-lbl">C 响应</text><rect x="150" y="74" width="253" height="18" rx="4" class="sv-grn-s"></rect><text x="411" y="91" class="sv-lbl-hi">19tick</text></svg>
```



最大响应 3/8/19 均在周期 10/20/40 内；把 A.exec 调大即可能超期。



表 1.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 识别并发 | 多个活动 | 把顺序函数塞进任务 |
| 看期限 | 有无硬实时 | 无期限也用 RTOS |
| 算利用率 | U=ΣC/T | 只用感觉 |
| 评估成本 | RAM/切换 | 忽略栈开销 |



```zhizhan-anchor
m01-pitfalls
```



```zhizhan-anchor
m01-pitfalls-t
```



## 1.5 常见误区与排障



失败路径与排障




- **“有任务就是 RTOS”** ：把顺序函数塞进多个任务但不设优先级，只是把问题搬进并发。

- **忽略栈成本** ：每任务大栈让 RAM 见底，应按最坏调用链给并用高水位校正。

- **认为 RTOS 保证实时** ：实时性来自可调度性分析 \+ 优先级分配，不是内核本身。

- **没有期限也上 RTOS** ：白增 RAM/功耗/复杂度。



◆ 自测 · Module 01（先答再看）




1. 前后台里慢任务 5ms、快任务要 1ms 响应；“把慢任务优化到 4ms”为什么不解决快任务抖动？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"快任务响应仍等于循环总耗时，只要慢任务存在就要等它跑完。要解耦必须让快任务能被独立抢占（RTOS），或把慢任务切成可中断的小段。"}
   ```

2. “上了 RTOS 就实时”对吗？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"不对。实时性来自“可调度性分析 \\+ 优先级分配 \\+ WCET 预算”。内核只是保证可抢占，若任务集有期限冲突仍会超期。"}
   ```

3. 什么时候不该用 RTOS？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"没有“必须在固定期限内响应的并发活动”时。前后台 \\+ 状态机往往更省 RAM、更省电、更好验证。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：对一组周期性活动估算利用率与最坏响应，判断是否真的需要 RTOS。



核对与延伸：[FreeRTOS 官方文档 · Tasks / Scheduling / Synchronization](https://www.freertos.org/RTOS.html) · [ARM · Cortex-M3/M7 与 ARMv7-M 架构参考](https://developer.arm.com/documentation/dui0552/latest/)

 

动手练习



运行 ` labs/host_sched.c `：模拟三个周期任务（A:3/10、B:5/20、C:8/40）的固定优先级抢占调度。



**检查结果：** A/B/C 最大响应 3/8/19 均在周期内；把 A.exec 调到 9（U=1.35\>1）后出现未完成作业。

 

迁移练习：把本章的“能定量指出前后台轮询的响应抖动来源，用利用率筛查过载，再用含阻塞/抖动的响应时间分析判断截止期。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 01 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b06-m01","criterion":"A/B/C 最大响应 3/8/19 均在周期内；把 A.exec 调到 9（U=1.35>1）后出现未完成作业。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b06-guide)
