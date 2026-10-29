# RISC-V 与 Arm 对照

```zhizhan-anchor
m08
```



同一段 C，在 Arm 与 RISC-V 上的机器码与约定不同。本章不堆规格，而是给出 **迁移决策真正需要的差异** ：调用约定、特权与中断、内存模型，以及“哪些代码必须重写、哪些几乎不动”。

 

> 前置：读过 [M02](doc:course-b18-m02#m02)（调用约定）与 [M07](doc:course-b18-m07#m07)（内存序）。 · ◷ 约 40 分钟 · ◈ Cortex-M / Cortex-A / RISC-V 对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能指出 Arm 与 RISC-V 在 ABI/特权/中断/内存模型上的差异，并给出务实的移植清单。

 

本章速览




- Arm 与 RISC-V 差异在 ISA/ABI/特权/中断。

- 迁移重点：汇编、中断、内存模型。

- 纯 C 业务通常改动小。

 

```zhizhan-anchor
m08-design
```



```zhizhan-anchor
m08-design-t
```



## 8.1 两份“性格”不同的 ISA



Arm 是规整、生态成熟、商业授权的指令集；RISC-V 是开放、可扩展、由基础 \+ 扩展拼出的指令集。对写 C 的人，差异主要落在 **调用约定、特权/中断模型、内存模型与工具链生态** 上。



```zhizhan-anchor
fig-图-8-1
```



**图 8.1**  Arm vs RISC-V：四个关键维度



```zhizhan-figure
<svg viewBox="0 0 800 170" width="100%" height="170" role="img" aria-label="Arm vs RISC-V：四个关键维度" preserveAspectRatio="xMidYMid meet"><text x="185" y="24" text-anchor="middle" class="sv-lbl-dim">Arm (AArch32/M)</text><text x="295" y="24" text-anchor="middle" class="sv-lbl-dim">RISC-V</text><text x="12" y="50" class="sv-lbl">整数参数</text><rect x="158" y="38" width="94" height="22" rx="4" class="sv-cyn-s"></rect><text x="205" y="53" text-anchor="middle" class="sv-lbl-hi">r0–r3 (AAPCS)</text><rect x="268" y="38" width="94" height="22" rx="4" class="sv-grn-s"></rect><text x="315" y="53" text-anchor="middle" class="sv-lbl-hi">a0–a7 (psABI)</text><text x="12" y="78" class="sv-lbl">返回值</text><rect x="158" y="66" width="94" height="22" rx="4" class="sv-cyn-s"></rect><text x="205" y="81" text-anchor="middle" class="sv-lbl-hi">r0</text><rect x="268" y="66" width="94" height="22" rx="4" class="sv-grn-s"></rect><text x="315" y="81" text-anchor="middle" class="sv-lbl-hi">a0</text><text x="12" y="106" class="sv-lbl">特权级</text><rect x="158" y="94" width="94" height="22" rx="4" class="sv-amb-s"></rect><text x="205" y="109" text-anchor="middle" class="sv-lbl-hi">多级 + TrustZone</text><rect x="268" y="94" width="94" height="22" rx="4" class="sv-amb-s"></rect><text x="315" y="109" text-anchor="middle" class="sv-lbl-hi">M / S / U</text><text x="12" y="134" class="sv-lbl">中断控制器</text><rect x="158" y="122" width="94" height="22" rx="4" class="sv-red-s"></rect><text x="205" y="137" text-anchor="middle" class="sv-lbl-hi">NVIC / GIC</text><rect x="268" y="122" width="94" height="22" rx="4" class="sv-red-s"></rect><text x="315" y="137" text-anchor="middle" class="sv-lbl-hi">PLIC / CLIC</text><text x="12" y="162" class="sv-lbl">内存模型</text><rect x="158" y="150" width="94" height="22" rx="4" class="sv-box"></rect><text x="205" y="165" text-anchor="middle" class="sv-lbl-hi">弱序 (ARMv7/8)</text><rect x="268" y="150" width="94" height="22" rx="4" class="sv-box"></rect><text x="315" y="165" text-anchor="middle" class="sv-lbl-hi">弱序 RVWMO</text></svg>
```



不需要背规格表，记住这四行即可支撑迁移决策：寄存器命名与调用约定、特权级、中断控制器、内存模型。



表 8.1 Arm 与 RISC-V 的迁移相关差异



| 维度 | Arm | RISC-V | 对迁移的影响 |
| --- | --- | --- | --- |
| 指令集风格 | 规整、生态大 | 开放、可扩展 | 工具链/库生态不同 |
| 参数寄存器 | r0–r3 | a0–a7 | 汇编/FFI 要改 |
| 返回/保存 | r0 / r4–r11 被调者保存 | a0 / s0–s11 | 内联汇编要核对 |
| 特权级 | 多级 \+ TrustZone | M/S/U | 启动/隔离代码要改 |
| 中断 | NVIC / GIC | PLIC / CLIC | 中断配置要重写 |



```zhizhan-anchor
m08-abi
```



```zhizhan-anchor
m08-abi-t
```



## 8.2 调用约定：用真代码对照



回忆 M02 里真实的 Arm 汇编：参数走 r0–r3、第 5 个入栈、返回 r0、` bx lr `。RISC-V 的 psABI 规则形式相同（前 8 个整数参数走 a0–a7、返回 a0），寄存器名字与返回指令不同。



````zhizhan-details
{"title":"共用程序 · 按需展开完整代码","body":"abi\\_arm.sASM\n\n \n\n```text\n\t.cpu cortex-m3\n\t.arch armv7-m\n\t.fpu softvfp\n\t.eabi_attribute 20, 1\n\t.eabi_attribute 21, 1\n\t.eabi_attribute 23, 3\n\t.eabi_attribute 24, 1\n\t.eabi_attribute 25, 1\n\t.eabi_attribute 26, 1\n\t.eabi_attribute 30, 2\n\t.eabi_attribute 34, 1\n\t.eabi_attribute 18, 4\n\t.file\t\"_abi_probe.c\"\n\t.text\n\t.align\t1\n\t.p2align 2,,3\n\t.global\tleaf\n\t.syntax unified\n\t.thumb\n\t.thumb_func\n\t.type\tleaf, %function\nleaf:\n\t@ args = 0, pretend = 0, frame = 0\n\t@ frame_needed = 0, uses_anonymous_args = 0\n\t@ link register save eliminated.\n\tadd\tr1, r1, r1, lsl #1\n\tadd\tr0, r0, r1\n\tbx\tlr\n\t.size\tleaf, .-leaf\n\t.align\t1\n\t.p2align 2,,3\n\t.global\tfive\n\t.syntax unified\n\t.thumb\n\t.thumb_func\n\t.type\tfive, %function\nfive:\n\t@ args = 4, pretend = 0, frame = 0\n\t@ frame_needed = 0, uses_anonymous_args = 0\n\t@ link register save eliminated.\n\tadd\tr0, r0, r1\n\tadd\tr0, r0, r2\n\tadd\tr0, r0, r3\n\tldr\tr3, [sp]\n\tadd\tr0, r0, r3\n\tbx\tlr\n\t.size\tfive, .-five\n\t.align\t1\n\t.p2align 2,,3\n\t.global\tsum_loop\n\t.syntax unified\n\t.thumb\n\t.thumb_func\n\t.type\tsum_loop, %function\nsum_loop:\n\t@ args = 0, pretend = 0, frame = 0\n\t@ frame_needed = 0, uses_anonymous_args = 0\n\t@ link register save eliminated.\n\tmov\tr3, r0\n\tcbz\tr1, .L7\n\tmovs\tr0, #0\n\tsubs\tr3, r3, #4\n\tadd\tr1, r3, r1, lsl #2\n.L6:\n\tldr\tr2, [r3, #4]!\n\tcmp\tr3, r1\n\tadd\tr0, r0, r2\n\tbne\t.L6\n\tbx\tlr\n.L7:\n\tmov\tr0, r1\n\tbx\tlr\n\t.size\tsum_loop, .-sum_loop\n\t.ident\t\"GCC: (Arm GNU Toolchain 13.3.Rel1 (Build arm-13.24)) 13.3.1 20240614\"\n```\n\nArm 真实汇编（arm-none-eabi-gcc 13.3.1 -S）"}
````



riscv\_calling.txt 节选Text

 

```text
RISC-V psABI（约定，未在本机编译；用于与上方 Arm 真代码对照）:
  参数: a0–a7（前 8 个），更多走栈
  返回: a0（64 位 a0:a1）
  被调者保存: s0–s11, ra, sp
  返回: jalr x0, 0(ra)   # 等价于 Arm 的 bx lr
  注意: 同样要求栈 16 字节对齐（RISC-V）
```

形式相同、名字不同：迁移时逐条核对寄存器与返回指令



读真代码的方法论



不要背“RISC-V 用 a0”。用 ` -S ` 生成两个平台的汇编，逐行对照参数、返回、保存寄存器、返回指令——用工具确认，比记忆可靠。这也是 M02 的办法。



````zhizhan-details
{"title":"共用程序 · 按需展开完整代码","body":"host\\_abi.cC\n\n \n\n```text\n/* host_abi.c —— 调用约定模型：参数走寄存器、返回值、栈（主机可运行）。\n * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_abi.c -o host_abi && ./host_abi\n */\n#include <stdio.h>\ntypedef struct { int r[4]; int sp; int stack[16]; } vm_t;\nstatic int call(vm_t *v, int a0, int a1, int a2, int a3, int a4) {\n    v->r[0]=a0; v->r[1]=a1; v->r[2]=a2; v->r[3]=a3;   /* 前 4 个参数进 r0–r3 */\n    v->stack[v->sp++] = a4;                            /* 第 5 个参数走栈 */\n    return v->r[0]+v->r[1]+v->r[2]+v->r[3]+a4;\n}\nint main(void) {\n    int ok = 1; vm_t v = {{0,0,0,0}, 0, {0}};\n    int r = call(&v, 1, 2, 3, 4, 5);\n    printf(\"参数 r0=%d r1=%d r2=%d r3=%d 返回 r0=%d（期望 15）\\n\", v.r[0], v.r[1], v.r[2], v.r[3], r);\n    if (r != 15) ok = 0;\n    printf(\"第 5 个参数在栈顶=%d（第 5 个起走栈）\\n\", v.stack[v.sp-1]);\n    if (v.stack[v.sp-1] != 5) ok = 0;\n    printf(\"\\n%s\\n\", ok ? \"RESULT: PASS\" : \"RESULT: FAIL\");\n    return ok ? 0 : 1;\n}\n```\n\n调用约定模型（主机 gcc 真实编译运行，可对照 Arm/RISC-V 形式）"}
````



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_abi.c -o labs/host_abi && ./labs/host_abi
参数 r0=1 r1=2 r2=3 r3=4 返回 r0=15（期望 15）
第 5 个参数在栈顶=5（第 5 个起走栈）
RESULT: PASS
```



“前几个走寄存器、超出走栈、返回在首寄存器”是 Arm 与 RISC-V 共有的形式；差异在寄存器命名与返回指令。



```zhizhan-anchor
m08-priv
```



```zhizhan-anchor
m08-priv-t
```



## 8.3 特权、中断与内存模型



底层代码（启动、中断、屏障）与 ISA 强相关，是迁移的主战场；纯 C 业务逻辑通常几乎不动。



```zhizhan-anchor
fig-图-8-2
```



**图 8.2**  中断与特权：迁移时最容易翻车的两处



```zhizhan-figure
<svg viewBox="0 0 800 160" width="100%" height="160" role="img" aria-label="中断与特权：迁移时最容易翻车的两处" preserveAspectRatio="xMidYMid meet"><text x="185" y="24" text-anchor="middle" class="sv-lbl-dim">迁移点</text><text x="295" y="24" text-anchor="middle" class="sv-lbl-dim">Arm (Cortex-M)</text><text x="405" y="24" text-anchor="middle" class="sv-lbl-dim">RISC-V</text><text x="12" y="50" class="sv-lbl">中断入口</text><rect x="158" y="38" width="94" height="22" rx="4" class="sv-cyn-s"></rect><text x="205" y="53" text-anchor="middle" class="sv-lbl-hi">向量表 + NVIC</text><rect x="268" y="38" width="94" height="22" rx="4" class="sv-grn-s"></rect><text x="315" y="53" text-anchor="middle" class="sv-lbl-hi">CLINT/PLIC + 陷阱向量</text><text x="12" y="78" class="sv-lbl">优先级</text><rect x="158" y="66" width="94" height="22" rx="4" class="sv-amb-s"></rect><text x="205" y="81" text-anchor="middle" class="sv-lbl-hi">NVIC 可抢占优先级</text><rect x="268" y="66" width="94" height="22" rx="4" class="sv-amb-s"></rect><text x="315" y="81" text-anchor="middle" class="sv-lbl-hi">PLIC 优先级（依实现）</text><text x="12" y="106" class="sv-lbl">特权/模式</text><rect x="158" y="94" width="94" height="22" rx="4" class="sv-box"></rect><text x="205" y="109" text-anchor="middle" class="sv-lbl-hi">Thread/Handler</text><rect x="268" y="94" width="94" height="22" rx="4" class="sv-box"></rect><text x="315" y="109" text-anchor="middle" class="sv-lbl-hi">M/S/U</text><text x="12" y="134" class="sv-lbl">屏障指令</text><rect x="158" y="122" width="94" height="22" rx="4" class="sv-red-s"></rect><text x="205" y="137" text-anchor="middle" class="sv-lbl-hi">DMB/DSB/ISB</text><rect x="268" y="122" width="94" height="22" rx="4" class="sv-red-s"></rect><text x="315" y="137" text-anchor="middle" class="sv-lbl-hi">fence</text></svg>
```



中断控制器不同 → 中断配置代码必须重写；特权级模型不同 → 启动与隔离代码必须重写。



表 8.2 移植清单：按“必须改”排序



| 迁移点 | 是否必须改 | 原因 |
| --- | --- | --- |
| 内联汇编 / 启动代码 | 必须 | 指令集与寄存器不同 |
| 中断控制器配置 | 必须 | NVIC/GIC vs PLIC/CLIC |
| 内存屏障 / 原子实现 | 必须或改用标准原子 | 屏障指令不同 |
| 编译器内建 (builtin) | 多为标准 | 用 \_\_atomic\_\* 可移植 |
| 纯 C 业务逻辑 | 通常不用 | 与 ISA 无关 |



```zhizhan-anchor
m08-migrate
```



```zhizhan-anchor
m08-migrate-t
```



## 8.4 迁移怎么做才稳



迁移不是“逐行翻译汇编”，而是 **把与 ISA 耦合的部分隔离出来** ，其余保持标准 C。推荐顺序：先跑通标准 C 逻辑 → 再补启动/中断 → 最后核对并发与屏障。



表 8.3 分阶段迁移与验收



| 阶段 | 目标 | 验证 |
| --- | --- | --- |
| ① 标准 C 逻辑 | 业务代码在新工具链编过 | 主机单测 \+ 交叉编译 |
| ② 启动/向量表 | 能复位到 main | 点灯 / 串口打印 |
| ③ 中断 | 中断能进能出 | 触发计数 \+ 时间戳 |
| ④ 并发/屏障 | 弱序下无竞争 | 压力测试 \+ TSAN/板测 |



表 8.4 工具链与库的迁移对照



| 工具链环节 | Arm | RISC-V | 迁移动作 |
| --- | --- | --- | --- |
| 编译器 | arm-none-eabi-gcc / clang | riscv-none-elf-gcc / clang | 改 target |
| 浮点 ABI | hard/soft float | 按扩展（F/D） | 核对 ABI 与链接 |
| 调试 | OpenOCD \+ GDB | OpenOCD \+ GDB | 改 target cfg |
| C 标准库 | newlib / picolibc | newlib / picolibc | 多为标准，少量平台相关 |
| 可移植原语 | \_\_atomic\_\* / stdatomic | 同左 | 优先用标准，少写裸汇编 |



把 ISA 相关代码关进“小屋”



把启动、中断、屏障、寄存器访问都收进一个 ` hal/port_*.c `，上层只调接口。迁移时改的只是这个小屋，业务代码零改动——这也是 B05 三平台对照的组织方式。



```zhizhan-anchor
m08-pitfalls
```



```zhizhan-anchor
m08-pitfalls-t
```



## 8.5 常见误区与排障



失败路径与排障




- **照抄汇编** ：ISA 不兼容，直接编不过或跑飞。

- **忽略中断控制器差异** ：中断不工作或优先级失效。

- **忽略内存模型差异** ：并发出错。

- **低估工具链/生态差异** ：优化、调试、库都不同。

- **把 ISA 相关代码散落各处** ：迁移成本成倍。



◆ 自测 · Module 08（先答再看）




1. 从 Arm 迁移到 RISC-V，哪些代码必须重写？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"内联汇编、启动/向量表、中断控制器配置、屏障/原子实现（或用标准 ` __atomic_* ` 改写）。纯 C 业务逻辑通常只做少量调整。"}
   ```

2. 为什么建议把 ISA 相关代码集中到一个 hal/port 层？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"这样迁移只改这一层，业务代码零改动；同时便于三平台对照与测试（如 B05 的组织方式）。"}
   ```

3. Arm 与 RISC-V 参数寄存器分别叫什么？形式一样吗？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"Arm：r0–r3（AAPCS）；RISC-V：a0–a7（psABI）。 **规则形式相同** （寄存器传参、超出走栈、返回在首寄存器），但名字与返回指令不同（bx lr vs jalr）。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：列出你代码库里所有“与 ISA 强相关”的文件，评估哪些能收进 hal/port 层，给出迁移顺序。



核对与延伸：[RISC-V 规范](https://riscv.org/technical/specifications/) · [RISC-V 特权架构](https://github.com/riscv/riscv-isa-manual)

 

动手练习



对照 ` labs/abi_arm.s `（真实 Arm 汇编）与 RISC-V 的 psABI 约定，判断参数/返回值/保存寄存器差异。



**检查结果：** 能指出 Arm 用 r0–r3/a0–a7（RISC-V）、返回 r0/a0、特权多级\+TrustZone vs M/S/U、中断 NVIC/GIC vs PLIC/CLIC；迁移清单覆盖汇编/中断/内存模型。

 

迁移练习：把本章的“能指出 Arm 与 RISC-V 在 ABI/特权/中断/内存模型上的差异，并给出务实的移植清单。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 08 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b18-m08","criterion":"能指出 Arm 用 r0–r3/a0–a7（RISC-V）、返回 r0/a0、特权多级+TrustZone vs M/S/U、中断 NVIC/GIC vs PLIC/CLIC；迁移清单覆盖汇编/中断/内存模型。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b18-guide)
