# DMA 与 Cache 一致性

```zhizhan-anchor
m06
```



[DMA](term:dma) 的卖点是“不占 CPU 搬数据”，代价是它 **不经过 CPU 的 cache** 。于是同一块内存出现两个副本（cache 与主存），谁先谁后没对齐，就会“偶发读到旧数据”。本章给出可执行的规则：按传输方向 clean / invalidate \+ 按 cache line 对齐 \+ 屏障。

 

> 前置：读过 [M04](doc:course-b18-m04#m04)（cache 与写策略）。 · ◷ 约 42 分钟 · ◈ Cortex-M / Cortex-A / RISC-V 对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能按 DMA 传输方向正确维护 cache（clean/invalidate），对齐缓冲并加屏障，杜绝“旧数据”偶发。



```zhizhan-anchor
m06-knowledge-boundary
```



### 先确定共享存储的所有者



CPU、DMA 和其他核心可能通过不同缓存路径看到数据。每块缓冲在何时由谁读写、如何发布、何时可复用，要写成协议。按平台文档选择一致性区域、屏障、Cache clean/invalidate 与对齐；volatile 只约束特定编译器访问语义，不能提供整套协议。

 

本章速览




- DMA 与 cache：按方向 clean/invalidate。

- 缓冲按 cache line 对齐。

- 描述符写后加屏障。

 

```zhizhan-anchor
m06-why
```



```zhizhan-anchor
m06-why-t
```



## 6.1 为什么会出现“偶发读旧数据”



CPU 通过 cache 读写内存，DMA 引擎则直接访问内存。两者看到的是 **两份副本** ：CPU 改了 cache 但还没写回内存，DMA 读到的就是旧值；DMA 更新了内存但 CPU 还读 cache，CPU 读到的也是旧值。“偶发”是因为它依赖时序，往往只在压测或特定数据量下出现。



```zhizhan-anchor
fig-图-6-1
```



**图 6.1**  CPU-cache-内存-DMA 的四角关系



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="CPU-cache-内存-DMA 的四角关系" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">CPU</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">cache（会变旧）</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">主存</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">DMA 引擎</text></svg>
```



CPU 走 cache，DMA 绕过 cache 直连内存。箭头标注了两次“失配”：CPU 写后未 clean、设备写后未 invalidate。



表 6.1 一致性失配的四种形态



| 失配方向 | 谁改的 | 谁读的 | 后果 |
| --- | --- | --- | --- |
| CPU→设备 | CPU 改 cache | DMA 读内存 | 读到旧值 |
| 设备→CPU | DMA 改内存 | CPU 读 cache | 读到旧 cache |
| 多核共享 | 核 A 改 cache | 核 B 读 cache | 看不到（M07） |
| 未对齐 | 维护整行 | 相邻数据被误伤 | 偶发损坏 |



```zhizhan-anchor
m06-dir
```



```zhizhan-anchor
m06-dir-t
```



## 6.2 核心规则：按传输方向维护 cache



解决方法是“把该看到的最新副本推给对方”：CPU 要写出去 →  **clean** （cache 写回内存）；设备要写进来 →  **invalidate** （让 CPU 丢弃旧 cache）。下面这段程序把漏做与做对的差别跑出来：



host\_dma.cC

 

```text
/* host_dma.c —— DMA 与 cache 一致性方向模型（主机可运行）。
 * 模型：CPU 有 cache（会变旧），DMA 直接读写“内存”。演示按方向遗漏 clean/invalidate 的后果。 */
#include <stdio.h>
#include <string.h>

#define N 4
static int mem[N];                       /* 设备/DMA 看到的内存 */
static int cache[N]; static int valid = 0;   /* CPU cache（整块作一行便于演示） */

static void cpu_write(int i, int v) { cache[i] = v; valid = 1; }       /* 只改 cache（dirty） */
static int  cpu_read(int i) { return valid ? cache[i] : mem[i]; }      /* 命中读 cache */
static void clean(void) { if (valid) for (int i = 0; i < N; i++) mem[i] = cache[i]; }  /* 写回内存 */
static void invalidate(void) { valid = 0; }                            /* 丢弃 cache */
static int  dma_read(int i) { return mem[i]; }                          /* 设备只读内存 */
static void dma_write(int i, int v) { mem[i] = v; }                     /* 设备只写内存 */

int main(void) {
  int ok = 1;
  /* A. CPU→设备：写缓冲后没 clean，DMA 读到旧值（bug） */
  memset(mem, 0, sizeof(mem)); memset(cache, 0, sizeof(cache)); valid = 0;
  cpu_write(0, 0xAA); if (dma_read(0) == 0xAA) ok = 0;
  printf("A 忘 clean : CPU写0xAA, DMA读=0x%02X (旧值→bug)\n", dma_read(0));
  clean();
  printf("A 已 clean : DMA读=0x%02X (最新)\n", dma_read(0));
  if (dma_read(0) != 0xAA) ok = 0;

  /* B. 设备→CPU：DMA 写后没 invalidate，CPU 读到旧 cache（bug） */
  cpu_read(1);                          /* 先把旧值装进 cache */
  dma_write(1, 0x55);                   /* 设备更新内存 */
  printf("B 忘 invalidate: CPU读=0x%02X (旧cache→bug)\n", cpu_read(1));
  if (cpu_read(1) == 0x55) ok = 0;
  invalidate();
  printf("B 已 invalidate: CPU读=0x%02X (最新)\n", cpu_read(1));
  if (cpu_read(1) != 0x55) ok = 0;

  printf("规则: CPU→设备 clean; 设备→CPU invalidate; 缓冲按 cache line 对齐\n");
  printf("RESULT: %s\n", ok ? "PASS" : "FAIL");
  return ok ? 0 : 1;
}
```

DMA 与 cache 一致性方向模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_dma.c -o labs/host_dma && ./labs/host_dma
A 忘 clean : CPU写0xAA, DMA读=0x00 (旧值→bug)
A 已 clean : DMA读=0xAA (最新)
B 忘 invalidate: CPU读=0x00 (旧cache→bug)
B 已 invalidate: CPU读=0x55 (最新)
规则: CPU→设备 clean; 设备→CPU invalidate; 缓冲按 cache line 对齐
RESULT: PASS
```



A 组演示“写出去要 clean”，B 组演示“读进来要 invalidate”——方向反了都是白做。



表 6.2 按方向维护（背下来不够，要能说出为什么）



| 传输方向 | 正确动作 | 为什么 | 常见错误 |
| --- | --- | --- | --- |
| CPU → 设备 | clean | 让设备读到 CPU 的新值 | 忘记 clean |
| 设备 → CPU | invalidate | 让 CPU 读主存最新值 | 忘记 invalidate |
| 双向 | clean 后再 invalidate | 清方向 \+ 丢旧 cache | 顺序颠倒 |
| 长期共享 | 用一致内存（non-cacheable） | 免维护 | 误以为是自动的 |



记法：以“对方在哪”为准



对方要 **读内存** （DMA 读）→ 你先  **clean** ；对方要 **写内存** （DMA 写）→ 你先  **invalidate** 。换句话说： **写出去 clean，读进来 invalidate** 。



```zhizhan-anchor
m06-align
```



```zhizhan-anchor
m06-align-t
```



## 6.3 对齐与边界：别误伤邻居



cache 维护以 **行** 为单位。如果缓冲没有按 cache line 对齐，invalidate 会把行内 **其他变量** 也丢掉（若它们正好被 CPU 改过又没写回，就丢了）。所以 DMA 缓冲应 **按 cache line 对齐并补齐到行整数倍** 。



```zhizhan-anchor
fig-图-6-2
```



**图 6.2**  未对齐缓冲为何会“误伤邻居”



```zhizhan-figure
<svg viewBox="0 0 800 170" width="100%" height="170" role="img" aria-label="未对齐缓冲为何会“误伤邻居”" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-box"></rect><text x="75" y="49.0" class="sv-lbl-hi">cache 行（64B）</text><rect x="60" y="64" width="680" height="30" rx="6" class="sv-red-s"></rect><text x="75" y="83.0" class="sv-lbl-hi">← 相邻变量（被误伤）</text><rect x="60" y="98" width="680" height="48" rx="6" class="sv-grn-s"></rect><text x="75" y="126.0" class="sv-lbl-hi">对齐的 DMA 缓冲（整数行）</text><rect x="60" y="150" width="680" height="30" rx="6" class="sv-box"></rect><text x="75" y="169.0" class="sv-lbl-hi">← 相邻变量（安全）</text></svg>
```



一次 invalidate 以整行为单位。缓冲未对齐时，行内混入了相邻变量；invalidate 把它们一起丢弃，若它们被 CPU 改过又未写回，数据就丢了。对齐 \+ 补齐到整数行可避免。



dma\_buf.c 节选C

 

```text
// 按 cache line（示例 64B）对齐，并补齐到整数行
__attribute__((aligned(64))) uint8_t dma_tx[512];   // 大小是 64 的整数倍
// 传输前：
dcache_clean_range(dma_tx, sizeof dma_tx);           // CPU→设备
// 传输后（设备→CPU）：
dcache_invalidate_range(dma_tx, sizeof dma_tx);
// 注意：范围要落在完整行上，避免刷新/丢弃“邻居”
```

对齐 \+ 整数行，是“维护不误伤”的前提



表 6.3 对齐与维护的取舍



| 做法 | 好处 | 代价 |
| --- | --- | --- |
| 缓冲按行对齐 | 维护不误伤邻居 | 略有内存浪费 |
| 大小补齐到行整数倍 | 范围覆盖完整行 | 同上 |
| 用一致内存 (non-cacheable) | 免 clean/invalidate | 访问变慢 |
| 用“维护窗口”批量操作 | 减少调用次数 | 需仔细圈定范围 |



表 6.4 不同架构的 cache 维护手段



| 架构 | 维护指令 | 典型系统调用 |
| --- | --- | --- |
| Armv7/A | DC CVAC / DC IVAC | dma\_sync\_single\_for\_\* |
| Armv7-M | SCB\_CleanDCache / InvalidateDCache | HAL 内联 |
| RISC-V | fence \+ CMO 扩展 | riscv\_dma\_\*（依实现） |
| 平台无关写法 | 用 OS/HAL 的 DMA API | 最省心，避免手写指令 |



```zhizhan-anchor
m06-barrier
```



```zhizhan-anchor
m06-barrier-t
```



## 6.4 屏障与描述符：让顺序“被看见”



就算维护对了，编译器或 CPU 仍可能把“写描述符”与“使能 DMA” **重排** ，导致 DMA 先看到使能、后看到描述符内容。要用 **内存屏障** 固定顺序（与 M07 同源）。



dma\_desc.c 节选C

 

```text
desc->buf  = (uint32_t)dma_tx;
desc->len  = sizeof dma_tx;
__DMB();                     // 保证描述符对 DMA 可见后再启动
DMA->CR |= DMA_EN;           // 使能（此前必须能看到完整描述符）
// 传输完成中断里：先读状态确认，再处理数据
```

写描述符 → \_\_DMB() → 使能：顺序不能被优化打乱



什么时候用“一致内存”最省心



面向“小数据、偶发”的 DMA（如单次命令），直接把缓冲开成 non-cacheable 最省事；面向“大数据、高频”的 DMA，才对增量维护（clean/invalidate）敏感，需要认真对齐与批量。



```zhizhan-anchor
m06-pitfalls
```



```zhizhan-anchor
m06-pitfalls-t
```



## 6.5 常见误区与排障



失败路径与排障




- **忘 invalidate** ：设备写内存后 CPU 读旧 cache（偶发）。

- **忘 clean** ：设备读到 CPU 还没写回的值。

- **缓冲未按行对齐** ：维护误伤相邻变量。

- **方向弄反** ：clean 与 invalidate 用错，等于没做。

- **描述符未加屏障** ：DMA 取到半成品描述符。



◆ 自测 · Module 06（先答再看）




1. 设备要写内存给 CPU 读，CPU 该做什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"在做读之前  **invalidate**  对应 cache 行，丢弃旧 cache，使 CPU 下次读从内存取最新值。记法：对方写内存 → 你 invalidate。"}
   ```

2. CPU 要写数据给 DMA 发送，发送前要做什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"**clean**  对应 cache 行，把 CPU 的新值写回内存，否则 DMA 读到旧值。记法：对方读内存 → 你 clean。"}
   ```

3. 为什么 DMA 缓冲要按 cache line 对齐？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"维护以 **行** 为单位。不对齐时，invalidate/clean 一整行会波及行内相邻变量，可能丢数据或引入不一致。对齐并补齐到整数行可避免误伤。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：检查你项目里所有 DMA 缓冲：方向、对齐、clean/invalidate 顺序、描述符屏障，逐条对照 6.2/6.3/6.4 修正。



核对与延伸：[Linux DMA-API 指南](https://docs.kernel.org/core-api/dma-api-howto.html) · [Arm 内存序与屏障](https://developer.arm.com/documentation/100941/latest/)

 

动手练习



运行 ` labs/host_dma.c `：看遗漏 clean / invalidate 分别造成哪种“旧数据”。



**检查结果：** CPU→设备漏 clean → DMA 读到旧值；设备→CPU 漏 invalidate → CPU 读到旧 cache；补上后读到最新。

 

迁移练习：把本章的“能按 DMA 传输方向正确维护 cache（clean/invalidate），对齐缓冲并加屏障，杜绝“旧数据”偶发。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 06 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b18-m06","criterion":"CPU→设备漏 clean → DMA 读到旧值；设备→CPU 漏 invalidate → CPU 读到旧 cache；补上后读到最新。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b18-guide)
