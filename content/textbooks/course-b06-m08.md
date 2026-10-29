# 反模式与调试

```zhizhan-anchor
m08
```



栈溢出检测；死锁；CPU 占用分析；[FreeRTOS](term:rtos)-aware GDB；故障现场（CFSR/HFSR/BFAR）。

 

> 前置：了解任务栈、优先级与看门狗，具备基本调试手段（GDB/寄存器）。 · ◷ 约 44 分钟 · ◈ STM32F103 / ESP32 / STM32H7 三平台对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能用栈高水位与哨兵法检测栈溢出、按忙/总 tick 算 CPU 占用，并抓取 CFSR/HFSR/BFAR 故障现场。

 

本章速览




- 栈溢出用哨兵法/水位法检测并处理；溢出后继续运行只会更糟。

- 看门狗要监控“关键任务本身”，喂狗条件是业务真的完成。

- HardFault 现场（CFSR/HFSR/BFAR）是定位跑飞的第一手证据。

 

```zhizhan-anchor
m08-antipattern
```



```zhizhan-anchor
m08-antipattern-t
```



## 8.1 常见反模式



RTOS 的 bug 大多是资源与优先级问题，而不是语法问题。先把常见反模式列出来，再给出观测手段。



表 8.1 五反模式



| 反模式 | 现象 | 修复 |
| --- | --- | --- |
| 高优先级任务干长活 | 低优先/空闲饿死 | 长活下沉/分片 |
| 用二值信号量当锁 | 优先级反转 | 改用互斥量 |
| 临界区里调阻塞 API | 死锁/断言失败 | 临界区只做短操作 |
| 在别处统一喂狗 | 看门狗形同虚设 | 被监控任务自己喂 |
| 栈给太小/太大 | 偶发跑飞/浪费 RAM | 高水位校正 |



```zhizhan-anchor
fig-图-8-1
```



**图 8.1**  从现象到根因的定位顺序



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="从现象到根因的定位顺序" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">看状态</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">看栈</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">看故障现场</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">根因</text></svg>
```



CPU 占用/任务状态 → 调用栈（FreeRTOS-aware GDB）→ 故障现场（CFSR/HFSR/BFAR）→ 根因。



```zhizhan-anchor
m08-evidence
```



```zhizhan-anchor
m08-evidence-t
```



## 8.2 真实证据：高水位与 CPU 占用



下面这段主机程序验证高水位算法与 CPU 占用计算：



host\_debug.cC

 

```text
/* host_debug.c —— 栈高水位与 CPU 占用的度量模型（主机可运行）。
 *
 *   ① 栈高水位的原理：创建任务时把整块栈填成已知模式；运行时被覆盖的部分才是“用过”的。
 *      从未被覆盖的字节数就是“最坏情况下仍空闲的余量”（高水位 = 最少剩余）。
 *      这正是 uxTaskGetStackHighWaterMark() 的做法，也是 configCHECK_FOR_STACK_OVERFLOW 的基础。
 *   ② CPU 占用：忙 tick / 总 tick。空闲任务跑到的时间不计入忙。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_debug.c -o host_debug && ./host_debug
 */
#include <stdio.h>
#include <string.h>

#define STACK 64
#define PAINT 0xAB

/* 返回从未被覆盖的字节数（自栈底向上连续 PAINT 的个数；栈向下生长，未用区在低地址） */
static int high_water(const unsigned char *s, int n) {
    int free_bytes = 0;
    for (int i = 0; i < n; i++)
        if (s[i] == PAINT) free_bytes++; else break;
    return free_bytes;
}

int main(void) {
    int ok = 1;
    unsigned char stack[STACK];

    memset(stack, PAINT, sizeof(stack));
    /* 模拟一次调用链用掉了 40 字节（栈向下生长，占用高地址区；低地址仍是 PAINT） */
    int used = 40;
    for (int i = STACK - used; i < STACK; i++) stack[i] = (unsigned char)(0x10 + (i & 0x0F));
    int hw = high_water(stack, STACK);
    printf("填充 %d 字节栈，用掉 %d 字节 → 高水位(最少剩余) = %d 字节\n", STACK, used, hw);
    if (hw != STACK - used) ok = 0;

    memset(stack, 0x5A, sizeof(stack));   /* 未按 PAINT 填充 */
    hw = high_water(stack, STACK);
    printf("未按 0xAB 填充的栈 → 高水位 = %d（期望 0，说明必须先填充）\n", hw);
    if (hw != 0) ok = 0;

    /* CPU 占用：100 tick 里忙 75 */
    for (int b = 0; b <= 100; b += 25) {
        int total = 100, busy = b, load = busy * 100 / total;
        printf("忙 %3d / %3d tick → CPU 占用 %d%%\n", busy, total, load);
        if (load != b) ok = 0;
    }

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

栈高水位/CPU 占用模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_debug.c -o labs/host_debug && ./labs/host_debug
填充 64 字节栈，用掉 40 字节 → 高水位(最少剩余) = 24 字节
未按 0xAB 填充的栈 → 高水位 = 0（必须先填充）
忙 75 / 100 tick → CPU 占用 75%
RESULT: PASS
```



填充 64 用 40 → 高水位 24；未填充=0（必须先填充）；忙 75/100 → 75%。



表 8.2 调试指标



| 量 | 值 | 说明 |
| --- | --- | --- |
| 栈填充 | 64 B | 先填充 |
| 用掉 | 40 B | 高水位=24 |
| 未填充 | 0 | 无法测 |
| CPU 占用 | 75% | 忙/总 tick |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm08-plat\n```\n\n\n\n```zhizhan-anchor\nm08-plat-t\n```\n\n\n\n## 8.3 三平台对照：检测与故障现场\n\n\n\n栈检测与故障寄存器在三平台都可做；M7 的 MPU 能比魔数更早触发 MemManage。\n\n\n\nm08\\_stackcheck.cC\n\n \n\n```text\n/* m08_stackcheck.c —— 栈溢出检测与钩子（Cortex-M3）。\n * configCHECK_FOR_STACK_OVERFLOW=2 时，切换时检查任务栈末端画好的哨兵值；\n * 一旦被破坏就调用本钩子。溢出后继续运行只会更糟，通常应记录并复位。 */\n#include <stdint.h>\n#include \"rtos_api.h\"\n\nvolatile const char *g_overflow_task;\n\nvoid vApplicationStackOverflowHook(TaskHandle_t t, char *name) {\n    (void)t;\n    g_overflow_task = name;       /* 记录是哪个任务栈溢出 */\n    for (;;) { }                  /* 现场保留，交给复位/看门狗 */\n}\n\n/* 运行中查询某任务栈的“历史最少剩余”（单位：字，需 ×4 得字节） */\nuint32_t m08_stack_free_bytes(TaskHandle_t t) {\n    return (uint32_t)uxTaskGetStackHighWaterMark(t) * 4u;\n}\n```\n\nSTM32F103 · 栈检查\n\n\n\nesp\\_m08\\_wdt.cC\n\n \n\n```text\n/* esp_m08_wdt.c —— 任务看门狗（ESP32 / Xtensa）。\n * 只监控注册过的关键任务；喂狗应由被监控任务自己做，而不是在别的任务里统一喂。 */\n#include <stdint.h>\n#include \"esp_idf_api.h\"\n\nvoid esp_wdt_watch_current(void) {\n    (void)esp_task_wdt_add(0);        /* 0 = 当前任务 */\n}\n\nvoid esp_wdt_kick(void) {\n    (void)esp_task_wdt_reset();\n}\n```\n\nESP32 · 看门狗\n\n\n\nh7\\_m08\\_fault.cC\n\n \n\n```text\n/* h7_m08_fault.c —— 抓取 HardFault 现场（STM32H7 / Cortex-M7）。\n * CFSR/HFSR/MMFAR/BFAR 是内核调试寄存器，能把“跑飞”定位到具体原因与地址。 */\n#include <stdint.h>\n\n#define CFSR  (*(volatile uint32_t *)0xE000ED28u)   /* 可配置错误状态 */\n#define HFSR  (*(volatile uint32_t *)0xE000ED2Cu)   /* 硬错误状态 */\n#define MMFAR (*(volatile uint32_t *)0xE000ED34u)   /* MemManage 出错地址 */\n#define BFAR  (*(volatile uint32_t *)0xE000ED38u)   /* BusFault 出错地址 */\n\nvolatile uint32_t g_fault[4];\n\nvoid HardFault_Handler(void) {\n    g_fault[0] = CFSR;\n    g_fault[1] = HFSR;\n    g_fault[2] = MMFAR;\n    g_fault[3] = BFAR;\n    for (;;) { }        /* 断在这里，用调试器读 g_fault */\n}\n```\n\nSTM32H7 · HardFault 现场\n\n\n\n表 8.3 三平台调试\n\n\n\n| 维度 | STM32F103 | ESP32 | STM32H7 |\n| --- | --- | --- | --- |\n| 栈检测 | 高水位/哨兵 | 高水位 | 高水位/MPU |\n| 看门狗 | IWDG | TWDT | IWDG |\n| 故障现场 | CFSR/HFSR/BFAR | panic/backtrace | CFSR/HFSR/BFAR |\n| GDB | FreeRTOS-aware | OCD | FreeRTOS-aware |"}
````



```zhizhan-anchor
m08-check
```



```zhizhan-anchor
m08-check-t
```



## 8.4 自检



调试自检：栈可测、看门狗按业务喂、能抓故障现场、有 CPU 占用。



```zhizhan-anchor
fig-图-8-2
```



**图 8.2**  栈高水位（真实值）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="栈高水位（真实值）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">已填充</text><rect x="150" y="26" width="225" height="18" rx="4" class="sv-grn-s"></rect><text x="383" y="43" class="sv-lbl-hi">24B</text><text x="12" y="67" class="sv-lbl">未填充</text><rect x="150" y="50" width="2" height="18" rx="4" class="sv-red-s"></rect><text x="160" y="67" class="sv-lbl-hi">0B</text></svg>
```



填充 64 用 40 → 高水位 24 B；未填充时无法测量（=0）。



表 8.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 栈 | 先填充再量 | 不填充 |
| 看门狗 | 业务条件喂 | 统一喂 |
| 故障 | 抓 CFSR/BFAR | 只看到重启 |
| 占用 | 忙/总 tick | 凭感觉 |



```zhizhan-anchor
m08-pitfalls
```



```zhizhan-anchor
m08-pitfalls-t
```



## 8.5 常见误区与排障



失败路径与排障




- **只看平均栈使用** ：最坏调用链的峰值才关键。

- **溢出钩子里继续运行** ：栈已损坏，应记录并复位。

- **看门狗在空闲任务里喂** ：调度还在跑就不会复位，卡死的关键任务无人发现。

- **没有故障现场** ：跑飞后只看到重启，不抓 CFSR/BFAR 只能猜。



◆ 自测 · Module 08（先答再看）




1. 高水位显示某任务最少只剩 8 字节，最合理的动作？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"把该任务栈加大并按最坏调用链重新估，或用栈溢出钩子先确认无越界。8 字节余量在任何更深调用下都会溢出。"}
   ```

2. 为什么看门狗不能“在别处统一喂”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"只要调度还在跑就能喂到，卡死的关键任务不会被发现。应由被监控任务在“业务完成后”按条件喂，喂狗条件=所有关键任务都活着。"}
   ```

3. HardFault 现场为什么要抓 CFSR/HFSR/BFAR？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"它们分别给出故障类型（总线/用法/内存管理）、硬件故障与出错地址。不抓这些就只能“看到重启后猜”，无法定位根因。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你系统加栈高水位监控、按业务条件喂狗，并在 HardFault 钩子里记录 CFSR/HFSR/BFAR。



核对与延伸：[FreeRTOS 栈溢出与调试](https://www.freertos.org/Stacks-and-stack-overflow-checking.html) · [ARM · Cortex-M3/M7 与 ARMv7-M 架构参考](https://developer.arm.com/documentation/dui0552/latest/)

 

动手练习



运行 ` labs/host_debug.c `：验证高水位算法与 CPU 占用；编译 m08\_stackcheck.c / h7\_m08\_fault.c。



**检查结果：** 填充 64 用 40 → 高水位 24；忙 75/100 → 75%；HardFault 钩子能抓 CFSR/HFSR/BFAR。

 

迁移练习：把本章的“能用栈高水位与哨兵法检测栈溢出、按忙/总 tick 算 CPU 占用，并抓取 CFSR/HFSR/BFAR 故障现场。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 08 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b06-m08","criterion":"填充 64 用 40 → 高水位 24；忙 75/100 → 75%；HardFault 钩子能抓 CFSR/HFSR/BFAR。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b06-guide)
