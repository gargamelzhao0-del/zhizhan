# MPU、MMU 与地址空间

```zhizhan-anchor
m05
```



地址不再只是“内存里的位置”，而是 **被硬件强制的、带权限的虚拟空间** 。本章讲清 MMU 的翻译与权限、TLB 的缓存、MPU 的区域保护，以及“越权访问为什么必须触发故障”——这是隔离与安全的地基。

 

> 前置：读过 [M01](doc:course-b18-m01#m01)（地址映射）与 [M03](doc:course-b18-m03#m03)（异常）。 · ◷ 约 44 分钟 · ◈ Cortex-M / Cortex-A / RISC-V 对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能配置页表/权限或 MPU 区域，验证越权与未映射访问被拒，并解释地址空间隔离如何实现。

 

本章速览




- MMU 做翻译\+权限；MPU 做区域保护。

- 权限位是安全基础，越权即故障。

- TLB 刷新与区域配置要正确。

 

```zhizhan-anchor
m05-why
```



```zhizhan-anchor
m05-why-t
```



## 5.1 为什么要有“翻译”和“保护”



如果所有代码直接访问物理地址：一个野指针能改内核、一个越界能毁外设、多个程序无法各自“以为”自己独占内存。MMU 用两层能力解决： **翻译** （虚拟地址 → 物理地址，让每个进程拥有独立地址空间）与  **权限** （只读/可写/可执行，越权即故障）。



```zhizhan-anchor
fig-图-5-1
```



**图 5.1**  虚拟地址如何映射到物理内存



```zhizhan-figure
<svg viewBox="0 0 800 180" width="100%" height="180" role="img" aria-label="虚拟地址如何映射到物理内存" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="32" rx="6" class="sv-cyn-s"></rect><text x="75" y="50.2" class="sv-lbl-hi">进程虚拟空间（连续）</text><rect x="60" y="66" width="680" height="65" rx="6" class="sv-amb-s"></rect><text x="75" y="103.0" class="sv-lbl-hi">页表：虚拟页 → 物理页 + 权限</text><rect x="60" y="136" width="680" height="32" rx="6" class="sv-box"></rect><text x="75" y="155.8" class="sv-lbl-hi">物理内存（可不连续）</text></svg>
```



进程看到的是连续的虚拟地址；MMU 通过页表把每个虚拟页映射到任意物理页（可不连续）。同一物理页也可映射到多个虚拟地址（共享），或干脆不映射（缺页/非法）。



翻译 \+ 权限 = 隔离



翻译让“地址空间”成为可编排的资源；权限让越界 **必然失败** 。没有权限的翻译只是“换个编号”，没有隔离意义。安全（B22）与虚拟化都建立在这两点上。



表 5.4 一个受保护地址空间的典型布局



| 地址段 | 内容 | 典型权限 | 越权的后果 |
| --- | --- | --- | --- |
| 代码段 | 可执行代码 | 读 \+ 执行，不可写 | 写 → 权限故障 |
| 数据段 / 堆 | 变量与动态内存 | 读 \+ 写，不可执行 | 执行 → 执行故障 (NX) |
| 栈 | 调用栈 | 读 \+ 写，向下生长 | 溢出 → 护栏故障 |
| 内核段 | 内核代码/数据 | 仅特权可访问 | 用户态访问 → 故障 |
| 外设/保留 | MMIO / 未映射 | device 属性 / 不可访问 | 误访问 → 总线故障 |



```zhizhan-anchor
m05-mmu
```



```zhizhan-anchor
m05-mmu-t
```



## 5.2 MMU：多级页表与 TLB



页表把虚拟页号映射到物理页号并附带权限位。多级页表省空间（按需展开），代价是未命中时多次访存；为此有  **TLB**  缓存最近的翻译。改页表后必须 **刷新 TLB** ，否则仍用旧翻译。



```zhizhan-anchor
fig-图-5-2
```



**图 5.2**  一次地址翻译的路径



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="一次地址翻译的路径" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="88.0" y="66" text-anchor="middle" class="sv-lbl-hi">虚拟地址</text><path d="M158,69 H174" class="sv-arrow"></path><rect x="176" y="44" width="136" height="50" rx="7" class="sv-cyn-s"></rect><text x="244.0" y="66" text-anchor="middle" class="sv-lbl-hi">TLB 查询</text><path d="M314,69 H330" class="sv-arrow"></path><rect x="332" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="400.0" y="66" text-anchor="middle" class="sv-lbl-hi">页表遍历</text><path d="M470,69 H486" class="sv-arrow"></path><rect x="488" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="556.0" y="66" text-anchor="middle" class="sv-lbl-hi">权限检查</text><path d="M626,69 H642" class="sv-arrow"></path><rect x="644" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="712.0" y="66" text-anchor="middle" class="sv-lbl-hi">物理地址</text></svg>
```



虚拟地址 → 拆成页号\+偏移 → 查 TLB：命中直接用；未命中则走页表（多级）得到物理页号，再拼偏移。任一级权限检查失败 → 缺页/权限故障异常。



表 5.1 MMU 的关键机制



| 机制 | 作用 | 易错点 |
| --- | --- | --- |
| 多级页表 | 按需映射、省空间 | 越界/未映射 → 故障 |
| TLB | 缓存翻译 | 改页表后未刷新 |
| 权限位 | 读/写/执行/用户 | 过松 → 越权；过严 → 误故障 |
| 页大小 | 映射粒度 | 大页省 TLB，但碎化 |
| 缺页 | 按需调页 | 缺页过频影响实时性 |



pte\_bits.txt 节选Text

 

```text
页表项（典型布局，位含义依架构）：
  [物理页号][保留][Dirty][Accessed][User][RW][Execute][Valid]
  Valid=0 → 访问即缺页；RW=0 → 写触发权限故障；
  Execute=0 → 取指触发执行故障（NX，防代码注入）。
改页表后：刷新该范围的 TLB（否则仍用旧翻译）。
```

权限位决定“读/写/执行”哪一步会失败



```zhizhan-anchor
m05-mpu
```



```zhizhan-anchor
m05-mpu-t
```



## 5.3 MPU（内存保护单元）：无 MMU 时的保护



Cortex-M 这类没有 MMU 的核，用  **MPU** （Memory Protection Unit）把地址空间分成若干 **区域** ，给每个区域设定权限与属性（可缓存、禁止执行等）。它不做翻译，只做 **区域检查** ——足以保护关键数据与栈，也常用于让 RTOS 任务互相隔离。



表 5.2 MMU 与 MPU 的分工



| 能力 | MMU | MPU（内存保护单元） |
| --- | --- | --- |
| 地址翻译 | 有（虚拟→物理） | 无（物理地址） |
| 隔离粒度 | 页（可很细） | 区域（数量有限） |
| 典型系统 | Cortex-A / RISC-V Linux | Cortex-M \+ RTOS |
| 主要用途 | 进程隔离/虚拟内存 | 任务/数据/栈保护 |
| 开销 | 页表访存、TLB | 低（区域寄存器） |



用 MPU 保护栈的“护栏”



把栈底下方设成一个 **不可访问区域** ，栈一旦溢出就立即触发故障，而不是悄悄改坏别的变量。这是把 M03 的“栈溢出难查”变成“一溢出就崩在明处”的低成本手段。



mpu\_region.c 节选C

 

```text
// 把栈底下方设成“不可访问”的护栏：溢出即故障
ARM_MPU_SetRegion(0, ARM_MPU_RBAR(STACK_GUARD_ADDR, ARM_MPU_SH_NON, 0, 0, 0),
                     ARM_MPU_RLAR(STACK_GUARD_ADDR + 31, 0));  // AP=NO_ACCESS
// 再把关键配置区设为只读、代码区设为“可执行不可写”
ARM_MPU_Enable(MPU_CTRL_PRIVDEFENA_Msk);
```

MPU 用少量区域换关键保护：栈护栏、配置只读、代码不可写



```zhizhan-anchor
m05-evidence
```



```zhizhan-anchor
m05-evidence-t
```



## 5.4 真实验证：翻译、权限故障、未映射



权限与缺页是“应该发生故障”的地方。下面这段主机程序用一个页表模型，把三条路径都跑出来：



host\_mmu.cC

 

```text
/* host_mmu.c —— MMU：虚拟到物理翻译与权限检查（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_mmu.c -o host_mmu && ./host_mmu
 */
#include <stdio.h>
typedef struct { unsigned va, pa, size; int r, w, x; } pte_t;
static pte_t T[] = { {0x0000,0x8000,0x1000,1,0,1}, {0x1000,0x9000,0x1000,1,1,0} };
static int translate(unsigned va, int want_write, unsigned *pa) {
    for (unsigned i = 0; i < sizeof(T)/sizeof(T[0]); i++)
        if (va >= T[i].va && va < T[i].va + T[i].size) {
            if (want_write && !T[i].w) return -1;      /* 权限错误 */
            *pa = T[i].pa + (va - T[i].va); return 0;
        }
    return -2;                                          /* 缺页/未映射 */
}
int main(void) {
    int ok = 1; unsigned pa;
    int r1 = translate(0x0004, 0, &pa); printf("读 0x0004 → pa=0x%X（r=%d）\n", pa, r1);
    if (!(r1 == 0 && pa == 0x8004)) ok = 0;
    int r2 = translate(0x0004, 1, &pa); printf("写只读页 → r=%d（期望 -1 权限故障）\n", r2);
    if (r2 != -1) ok = 0;
    int r3 = translate(0x5000, 0, &pa); printf("未映射 → r=%d（期望 -2）\n", r3);
    if (r3 != -2) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

页表翻译 \+ 权限/未映射故障（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_mmu.c -o labs/host_mmu && ./labs/host_mmu
读 0x0004 → pa=0x8004（r=0）
写只读页 → r=-1（期望 -1 权限故障）
未映射 → r=-2（期望 -2）
RESULT: PASS
```



读命中返回 0，写只读页返回 -1（权限故障），未映射返回 -2（缺页）——三种结果对应三种页表状态。



表 5.3 页表状态决定访问结果



| 访问 | 页表状态 | 硬件行为 | 软件应做什么 |
| --- | --- | --- | --- |
| 读合法页 | 有效 \+ 可读 | 翻译并返回数据 | 正常 |
| 写只读页 | 有效 \+ 只读 | 权限故障（-1） | 修正权限或改访问方式 |
| 访问未映射 | 无效 | 缺页/总线故障（-2） | 按需分配或报错 |
| 执行数据页 | 有效 \+ 不可执行 | 执行故障 | 开启 NX/W^X |



```zhizhan-anchor
m05-pitfalls
```



```zhizhan-anchor
m05-pitfalls-t
```



## 5.5 常见误区与排障



失败路径与排障




- **权限过松** ：关键区可被越权写，隔离失效。

- **改页表/重映射后未刷新 TLB** ：仍用旧翻译，现象诡异。

- **MPU 区域重叠或对不齐** ：保护失效或误触发故障。

- **以为“未映射 = 返回 0”** ：实际是故障；调试先查地址是否有效。

- **把可写可执行同时打开（W^X 缺失）** ：给漏洞利用可乘之机。



◆ 自测 · Module 05（先答再看）




1. “翻译”和“权限”各解决什么问题？缺一会怎样？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"翻译让每个进程拥有独立、可编排的地址空间；权限让越界访问 **必然失败** 。只有翻译没有权限：能改地址但无法阻止非法写入，隔离名存实亡。"}
   ```

2. Cortex-M 没有 MMU，怎么实现任务/栈保护？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"用  **MPU（内存保护单元）** 把地址空间划成区域并设权限；不做翻译，只做区域检查。典型用法：给栈底设不可访问“护栏”，给关键数据设只读。"}
   ```

3. 写一个“只读页”会返回什么？这说明什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"返回权限故障（示例中 ` r=-1 `）。说明 **权限由硬件强制** ，这正是隔离与安全的基础——越权不是“被忽略”，而是“被拒绝并触发故障”。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：在你的系统上找出 3 个应受保护的区域（内核代码、关键配置、任务栈），说明用什么机制（MPU 区域 / 页表权限 / 栈护栏）保护。



核对与延伸：[ARM Cortex-M 文档](https://developer.arm.com/documentation/) · [RISC-V 特权架构](https://github.com/riscv/riscv-isa-manual)

 

动手练习



运行 ` labs/host_mmu.c `：验证虚拟→物理翻译、写只读页权限故障、未映射故障。



**检查结果：** 读 0x0004→pa=0x8004；写只读页→-1（权限故障）；未映射→-2（缺页）。

 

迁移练习：把本章的“能配置页表/权限或 MPU 区域，验证越权与未映射访问被拒，并解释地址空间隔离如何实现。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 05 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b18-m05","criterion":"读 0x0004→pa=0x8004；写只读页→-1（权限故障）；未映射→-2（缺页）。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b18-guide)
