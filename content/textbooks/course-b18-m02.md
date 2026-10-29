# 汇编与调用约定

```zhizhan-anchor
m02
```



C 函数最终要变成一组“参数放哪、返回值放哪、谁保存寄存器、栈怎么对齐”的约定。本章用  **arm-none-eabi-gcc 13.3.1 真实交叉编译** 出的汇编与反汇编，把 AAPCS 从“背诵条目”变回“看得见的 r0–r3、lr、bx lr 与 \[sp\]”。

 

> 前置：会写 C、了解寄存器与栈的基本概念。 · ◷ 约 46 分钟 · ◈ Cortex-M / Cortex-A / RISC-V 对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能按 AAPCS 判断参数/返回值/谁保存寄存器，能读懂中断入口与 prologue/epilogue，并写正确的内联汇编/FFI。

 

本章速览




- C 落汇编由 ISA 与调用约定决定。

- AAPCS：参数 r0-r3、返回 r0、被调者保存 r4-r11。

- 栈 8 字节对齐；内联汇编注意屏障。

 

```zhizhan-anchor
m02-why
```



```zhizhan-anchor
m02-why-t
```



## 2.1 为什么“会 C”还不够：约定是二进制接口



函数调用是 **跨模块、跨语言、跨编译器** 的二进制契约。C 代码要能调用汇编写的启动代码、要能被 FFI 调用、要在中断里正确返回，靠的就是 ABI（Application Binary Interface）。在 Arm 上这套约定叫  **AAPCS** 。



表 2.1 AAPCS 核心分工（考试式的表格，但下面都有真代码）



| 要素 | AAPCS (Arm, 32 位) | 说明 |
| --- | --- | --- |
| 整数参数 | r0、r1、r2、r3 | 第 5 个起走栈 |
| 返回值 | r0（64 位用 r0:r1） | 大结构体用隐藏指针 |
| 被调者保存 | r4–r8、r10、r11（\+SP） | 被调函数必须原样恢复 |
| 调用者保存 | r0–r3、r12(ip)、lr | 被调函数可随意改 |
| 栈指针 | SP，8 字节对齐 | 不对齐 → 浮点/异常出错 |
| 返回地址 | lr (r14) | 非叶函数需保存 lr |



```zhizhan-anchor
m02-real
```



```zhizhan-anchor
m02-real-t
```



## 2.2 真代码：三个函数编译出来长什么样



下面这段 C 用 ` arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -O2 -S ` 编译，得到的是  **真实的 AAPCS 汇编** （不是示意）：



abi\_probe.c 节选C

 

```text
int leaf(int a, int b){ return a + b*3; }
int five(int a,int b,int c,int d,int e){ return a+b+c+d+e; }
uint32_t sum_loop(const uint32_t *p, uint32_t n){ /* … */ }
```



abi\_arm.sASM

 

```text
	.cpu cortex-m3
	.arch armv7-m
	.fpu softvfp
	.eabi_attribute 20, 1
	.eabi_attribute 21, 1
	.eabi_attribute 23, 3
	.eabi_attribute 24, 1
	.eabi_attribute 25, 1
	.eabi_attribute 26, 1
	.eabi_attribute 30, 2
	.eabi_attribute 34, 1
	.eabi_attribute 18, 4
	.file	"_abi_probe.c"
	.text
	.align	1
	.p2align 2,,3
	.global	leaf
	.syntax unified
	.thumb
	.thumb_func
	.type	leaf, %function
leaf:
	@ args = 0, pretend = 0, frame = 0
	@ frame_needed = 0, uses_anonymous_args = 0
	@ link register save eliminated.
	add	r1, r1, r1, lsl #1
	add	r0, r0, r1
	bx	lr
	.size	leaf, .-leaf
	.align	1
	.p2align 2,,3
	.global	five
	.syntax unified
	.thumb
	.thumb_func
	.type	five, %function
five:
	@ args = 4, pretend = 0, frame = 0
	@ frame_needed = 0, uses_anonymous_args = 0
	@ link register save eliminated.
	add	r0, r0, r1
	add	r0, r0, r2
	add	r0, r0, r3
	ldr	r3, [sp]
	add	r0, r0, r3
	bx	lr
	.size	five, .-five
	.align	1
	.p2align 2,,3
	.global	sum_loop
	.syntax unified
	.thumb
	.thumb_func
	.type	sum_loop, %function
sum_loop:
	@ args = 0, pretend = 0, frame = 0
	@ frame_needed = 0, uses_anonymous_args = 0
	@ link register save eliminated.
	mov	r3, r0
	cbz	r1, .L7
	movs	r0, #0
	subs	r3, r3, #4
	add	r1, r3, r1, lsl #2
.L6:
	ldr	r2, [r3, #4]!
	cmp	r3, r1
	add	r0, r0, r2
	bne	.L6
	bx	lr
.L7:
	mov	r0, r1
	bx	lr
	.size	sum_loop, .-sum_loop
	.ident	"GCC: (Arm GNU Toolchain 13.3.Rel1 (Build arm-13.24)) 13.3.1 20240614"
```

arm-none-eabi-gcc 13.3.1 真实 -S 输出（部分）



从真代码里读出的三条事实




- ` leaf `：参数 a、b 就在  **r0、r1** ，结果 ` add r0,r0,r1; bx lr ` 放回  **r0** ，用  **lr**  返回—— **无需压栈** （叶子函数）。

- ` five `：注释 ` @ args = 4 ` 说明有 4 个字走栈；前 4 个在 r0–r3，第 5 个用 ` ldr r3,[sp] ` 从 **栈顶** 取——与表 2.1 完全对应。

- ` bx lr ` 是“按 lr 跳回”，不是普通跳转；这决定了中断/函数返回的正确性。



同一份目标文件用 ` arm-none-eabi-objdump -d ` 反汇编，能看到 **真实指令编码** ，这是排查“汇编与预期不符 / 链接后代码被改”的第一手材料：



abi\_arm.objdump.txtText

 

```text
_abi_probe.o:     file format elf32-littlearm


Disassembly of section .text:

00000000 <leaf>:
   0:	eb01 0141 	add.w	r1, r1, r1, lsl #1
   4:	4408      	add	r0, r1
   6:	4770      	bx	lr

00000008 <five>:
   8:	4408      	add	r0, r1
   a:	4410      	add	r0, r2
   c:	4418      	add	r0, r3
   e:	9b00      	ldr	r3, [sp, #0]
  10:	4418      	add	r0, r3
  12:	4770      	bx	lr

00000014 <sum_loop>:
  14:	4603      	mov	r3, r0
  16:	b149      	cbz	r1, 2c <sum_loop+0x18>
  18:	2000      	movs	r0, #0
  1a:	3b04      	subs	r3, #4
  1c:	eb03 0181 	add.w	r1, r3, r1, lsl #2
  20:	f853 2f04 	ldr.w	r2, [r3, #4]!
  24:	428b      	cmp	r3, r1
  26:	4410      	add	r0, r2
  28:	d1fa      	bne.n	20 <sum_loop+0xc>
  2a:	4770      	bx	lr
  2c:	4608      	mov	r0, r1
  2e:	4770      	bx	lr
```

objdump -d 真实反汇编（含指令编码）



```zhizhan-anchor
m02-trace
```



```zhizhan-anchor
m02-trace-t
```



## 2.3 一次调用的完整生命周期（含栈帧）



非叶函数会先把  **lr 与被调者保存寄存器** 压栈，函数体结束后恢复。这就是你反汇编里反复看到的 ` push {r4, lr} ` 与 ` pop {r4, pc} `（注意 pop 里是 pc，等价于“恢复 lr 并跳回”）。



```zhizhan-anchor
fig-图-2-1
```



**图 2.1**  一次带栈帧的函数调用时间线



```zhizhan-figure
<svg viewBox="0 0 800 154" width="100%" height="154" role="img" aria-label="一次带栈帧的函数调用时间线" preserveAspectRatio="xMidYMid meet"><path class="sv-dash" d="M150,26 V128"></path><text x="150" y="18" text-anchor="middle" class="sv-lbl-dim">0</text><path class="sv-dash" d="M305,26 V128"></path><text x="305" y="18" text-anchor="middle" class="sv-lbl-dim">16</text><path class="sv-dash" d="M460,26 V128"></path><text x="460" y="18" text-anchor="middle" class="sv-lbl-dim">32</text><path class="sv-dash" d="M615,26 V128"></path><text x="615" y="18" text-anchor="middle" class="sv-lbl-dim">48</text><path class="sv-dash" d="M770,26 V128"></path><text x="770" y="18" text-anchor="middle" class="sv-lbl-dim">64</text><text x="12" y="48" class="sv-lbl">caller</text><path class="sv-dash" d="M150,44 H770"></path><rect x="150" y="32" width="78" height="22" rx="4" class="sv-cyn-s"></rect><text x="188.8" y="47" text-anchor="middle" class="sv-lbl-hi">bl leaf</text><text x="12" y="82" class="sv-lbl">stack</text><path class="sv-dash" d="M150,78 H770"></path><rect x="228" y="66" width="58" height="22" rx="4" class="sv-amb-s"></rect><text x="256.6" y="81" text-anchor="middle" class="sv-lbl-hi">push {r4,lr}</text><rect x="654" y="66" width="58" height="22" rx="4" class="sv-amb-s"></rect><text x="682.8" y="81" text-anchor="middle" class="sv-lbl-hi">pop {r4,pc}</text><text x="12" y="116" class="sv-lbl">callee</text><path class="sv-dash" d="M150,112 H770"></path><rect x="286" y="100" width="368" height="22" rx="4" class="sv-grn-s"></rect><text x="469.7" y="115" text-anchor="middle" class="sv-lbl-hi">exec</text></svg>
```



调用者 p 把参数放 r0–r3（第 5 个入栈）→ bl 跳转并把返回地址写 lr → 被调者 push 保存现场 → 执行 → pop 恢复 → bx lr 返回。虚线是时间，纵轴是“谁在动”。



表 2.2 调用的五个阶段与常见错误



| 阶段 | 谁做 | 关键寄存器/内存 | 容易错的地方 |
| --- | --- | --- | --- |
| 传参 | 调用者 | r0–r3 \+ \[sp\] | 第 5 个参数忘入栈 / 类型扩展错 |
| 跳转 | bl | lr = 返回地址 | 叶子函数误以为 lr 安全 |
| 保存现场 | 被调者 | push {r4,lr} | 漏存被调者保存寄存器 |
| 返回 | bx lr | pop {...,pc} | 栈不对齐 / lr 被覆盖 |
| 栈对齐 | 约定 | SP 8 字节 | 奇数个字入栈导致 HardFault |



```zhizhan-anchor
m02-models
```



```zhizhan-anchor
m02-models-t
```



## 2.4 主机模型：把约定跑起来验证



约定是抽象的，但可以用主机模型“跑一遍”验证：下面的主机程序把“前 4 参数进 r0–r3、第 5 个走栈”显式实现并断言，便于在没有板子时理解与自测。



host\_abi.cC

 

```text
/* host_abi.c —— 调用约定模型：参数走寄存器、返回值、栈（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_abi.c -o host_abi && ./host_abi
 */
#include <stdio.h>
typedef struct { int r[4]; int sp; int stack[16]; } vm_t;
static int call(vm_t *v, int a0, int a1, int a2, int a3, int a4) {
    v->r[0]=a0; v->r[1]=a1; v->r[2]=a2; v->r[3]=a3;   /* 前 4 个参数进 r0–r3 */
    v->stack[v->sp++] = a4;                            /* 第 5 个参数走栈 */
    return v->r[0]+v->r[1]+v->r[2]+v->r[3]+a4;
}
int main(void) {
    int ok = 1; vm_t v = {{0,0,0,0}, 0, {0}};
    int r = call(&v, 1, 2, 3, 4, 5);
    printf("参数 r0=%d r1=%d r2=%d r3=%d 返回 r0=%d（期望 15）\n", v.r[0], v.r[1], v.r[2], v.r[3], r);
    if (r != 15) ok = 0;
    printf("第 5 个参数在栈顶=%d（第 5 个起走栈）\n", v.stack[v.sp-1]);
    if (v.stack[v.sp-1] != 5) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

调用约定模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_abi.c -o labs/host_abi && ./labs/host_abi
参数 r0=1 r1=2 r2=3 r3=4 返回 r0=15（期望 15）
第 5 个参数在栈顶=5（第 5 个起走栈）
RESULT: PASS
```



模型印证了表 2.1：前 4 参进 r0–r3、第 5 个入栈、返回值在 r0。



内联汇编的最小正确写法



需要碰特殊寄存器时用：  
` __asm volatile ("dsb" ::: "memory"); `。` volatile ` 防止被优化掉，` "memory" ` 告诉编译器“内存可能被改”，否则重排会咬你（见 [M07](doc:course-b18-m07#m07)）。



```zhizhan-anchor
m02-ffi
```



```zhizhan-anchor
m02-ffi-t
```



## 2.5 跨语言与中断：约定最容易翻车的地方



表 2.3 跨边界调用的约定风险点



| 场景 | 约定要点 | 典型故障 |
| --- | --- | --- |
| C ↔ 汇编 | 参数/返回/保存寄存器按 AAPCS | 汇编破坏 r4–r11 未恢复 |
| C ↔ Rust/C\+\+ (FFI) | extern "C" / #\[no\_mangle\] 固定 C ABI | 名字修饰 / 异常穿越边界 |
| 中断入口 | 硬件自动保存部分寄存器，返回用特殊指令 | lr 被改 / 未清中断标志 |
| 可变参数 | va\_list 依 ABI 布局 | 浮点/结构体传参错位 |
| 栈对齐 | 8 字节 | 库函数里 SIMD 访问崩溃 |



中断里改 lr 的代价



在 Cortex-M 中断服务程序里，普通函数返回用 ` bx lr ` 即可（硬件已把 lr 设为 EXC\_RETURN），但如果内联汇编/裸汇编错误地 ` mov pc, lr ` 或覆盖 lr，就会返回错误地址甚至锁死内核。中断返回的“特殊 lr 值”见 [M03](doc:course-b18-m03#m03)。



```zhizhan-anchor
m02-frame
```



```zhizhan-anchor
m02-frame-t
```



## 2.6 栈帧的真实验证：非叶函数为什么必须压栈



把“有循环、又调用别的函数”的函数（非叶函数）编译出来，就能看到栈帧的真身。下面这份反汇编里 ` push {r4, r5, r6, lr} ` 与 ` pop {r4, r5, r6, pc} ` 正是 AAPCS 的“被调者保存 \+ 返回地址”契约：



abi\_arm\_nonleaf.txtText

 

```text
_nl.o:     file format elf32-littlearm


Disassembly of section .text:

00000000 <framed>:
   0:	b570      	push	{r4, r5, r6, lr}
   2:	4606      	mov	r6, r0
   4:	b150      	cbz	r0, 1c <framed+0x1c>
   6:	2400      	movs	r4, #0
   8:	4625      	mov	r5, r4
   a:	4620      	mov	r0, r4
   c:	f7ff fffe 	bl	0 <helper>
  10:	3401      	adds	r4, #1
  12:	42a6      	cmp	r6, r4
  14:	4405      	add	r5, r0
  16:	d1f8      	bne.n	a <framed+0xa>
  18:	4628      	mov	r0, r5
  1a:	bd70      	pop	{r4, r5, r6, pc}
  1c:	4605      	mov	r5, r0
  1e:	4628      	mov	r0, r5
  20:	bd70      	pop	{r4, r5, r6, pc}
  22:	bf00      	nop
```

arm-none-eabi-objdump -d 真实输出（非叶函数 framed）



从这段真代码读出的三件事




- **为什么压 r4–r6** ：它们是被调者保存寄存器，跨 ` bl helper ` 还要用，所以必须先存后恢复。

- **为什么压 lr** ：` bl ` 会覆盖 lr（返回地址）。要能从 ` framed ` 正确返回，就得把 lr 也存起来。

- **为什么 pop 到 pc** ：` pop {r4,r5,r6,pc} ` 一步完成“恢复寄存器 \+ 返回”——等价于恢复 lr 再 ` bx lr `。



```zhizhan-anchor
fig-图-2-2
```



**图 2.2**  一次非叶调用的栈帧布局（地址从高到低）



```zhizhan-figure
<svg viewBox="0 0 800 210" width="100%" height="210" role="img" aria-label="一次非叶调用的栈帧布局（地址从高到低）" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="40" rx="6" class="sv-box"></rect><text x="75" y="54.0" class="sv-lbl-hi">调用者的栈帧（更高地址）</text><rect x="60" y="74" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="93.0" class="sv-lbl-hi">返回地址 lr（pop 到 pc）</text><rect x="60" y="108" width="680" height="40" rx="6" class="sv-cyn-s"></rect><text x="75" y="132.0" class="sv-lbl-hi">保存的 r4 / r5 / r6</text><rect x="60" y="152" width="680" height="40" rx="6" class="sv-grn-s"></rect><text x="75" y="176.0" class="sv-lbl-hi">本函数的局部变量 / 对齐填充</text><rect x="60" y="196" width="680" height="30" rx="6" class="sv-box"></rect><text x="75" y="215.0" class="sv-lbl-hi">更低的地址 ↓</text></svg>
```



压栈方向是从高地址向低地址。进入函数先保存 r4–r6 与返回地址(lr)，再给局部变量分配空间；退出时逆序恢复。SP 必须保持 8 字节对齐——这就是“奇数个字入栈会 HardFault”的根源。



表 2.4 栈帧的组成部分



| 栈帧内容 | 谁负责 | 不做的后果 |
| --- | --- | --- |
| 被调者保存寄存器 (r4–r11) | 被调函数 | 调用者的变量被悄悄改坏 |
| 返回地址 lr | 非叶函数 | 返回跳到错误地址 / 死循环 |
| 8 字节对齐 | 编译产出 | 浮点/库函数里 HardFault |
| 局部变量空间 | 编译器 | （由编译器管理，注意不要取悬垂指针） |



```zhizhan-anchor
m02-pitfalls
```



```zhizhan-anchor
m02-pitfalls-t
```



## 2.7 常见误区与排障



失败路径与排障




- **违反 ABI** ：内联汇编改了 r4–r11 却没恢复 → 调用者变量莫名变化。

- **栈未 8 字节对齐** ：奇数个字入栈，在浮点/库函数里 HardFault。

- **误判“被调者保存”** ：以为 r0–r3 会在调用后保留，实际被覆盖。

- **缺内存屏障** ：内联汇编访问外设/共享内存被重排。

- **叶子函数依赖 lr** ：一旦插入函数调用，lr 被覆盖而没保存。



◆ 自测 · Module 02（先答再看）




1. Arm AAPCS 里前 4 个整数参数放在哪？返回值放哪？第 5 个参数呢？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"前 4 个在  **r0–r3** ；返回值在  **r0** （64 位用 r0:r1）；第 5 个起走  **栈** 。本节 ` five ` 的真实汇编里 ` @ args = 4 ` 与 ` ldr r3,[sp] ` 就是证据。"}
   ```

2. 为什么很多函数开头是 \`push {r4, lr}\`、结尾是 \`pop {r4, pc}\`？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"非叶函数需要保存  **被调者保存寄存器 (r4)**  和  **返回地址 (lr)** ；结尾把 lr 直接弹回  **pc** ，一步完成“恢复并返回”。这是 AAPCS \\+ 硬件返回机制的体现。"}
   ```

3. 内联汇编里为什么常要写 \`::: "memory"\`？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"它告诉编译器“这段汇编可能读写内存”，禁止编译器把内存访问跨越它重排或缓存到寄存器——否则优化后可能读到旧值或漏掉外设写入（与 [M07](doc:course-b18-m07#m07) 的内存序同源）。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：拿你项目里一个含内联汇编或自定义启动代码的函数，用 ` arm-none-eabi-gcc -S ` 生成汇编，对照 AAPCS 检查参数、返回、保存寄存器与栈对齐。



核对与延伸：[ARM AAPCS (abi-aa)](https://github.com/ARM-software/abi-aa) · [ARM Cortex-M 文档](https://developer.arm.com/documentation/)

 

动手练习



运行 ` labs/host_abi.c ` 验证参数入寄存器/栈；再对照 ` labs/abi_arm.s ` 与 ` labs/abi_arm.objdump.txt ` 的真实 AAPCS 代码。



**检查结果：** 能指出 r0–r3 传前 4 参、第 5 个走 \[sp\]、返回在 r0；能读懂 ` push {r4,lr} `/` pop {r4,pc} `；栈 8 字节对齐。

 

迁移练习：把本章的“能按 AAPCS 判断参数/返回值/谁保存寄存器，能读懂中断入口与 prologue/epilogue，并写正确的内联汇编/FFI。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 02 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b18-m02","criterion":"能指出 r0–r3 传前 4 参、第 5 个走 [sp]、返回在 r0；能读懂 push {r4,lr}/pop {r4,pc}；栈 8 字节对齐。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b18-guide)
