# 内存层次与性能

```zhizhan-anchor
m04
```



CPU 很快、内存较慢，于是有了“用局部性换速度”的层级：寄存器 → cache → 主存。本章不讲名词，而是回答工程上真正的问题： **为什么同样两段代码差几倍、怎么用访问模式把命中率提上去、内存墙在哪** 。

 

> 前置：知道寄存器/主存访问时间有差异；会看基本循环与数组访问。 · ◷ 约 42 分钟 · ◈ Cortex-M / Cortex-A / RISC-V 对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能用局部性原理提升命中率，按 cache line 组织数据，并评估“算力 vs 带宽”谁才是瓶颈。

 

本章速览




- 内存层次：寄存器\>cache\>主存；局部性决定成本。

- 按 cache line 访问、提升局部性。

- 内存墙：性能常受带宽限制。

 

```zhizhan-anchor
m04-hier
```



```zhizhan-anchor
m04-hier-t
```



## 4.1 为什么要分层：速度、容量、成本的三角



寄存器的速度接近 CPU，但数量极少；主存容量大但慢一两个数量级。 **cache**  夹在中间：用“最近用过的东西更可能再用”（局部性）的假设，把“慢而大”伪装成“快而够用”。这层假设成立与否，直接决定性能。



```zhizhan-anchor
fig-图-4-1
```



**图 4.1**  内存层次：越靠近 CPU 越快越小越贵



```zhizhan-figure
<svg viewBox="0 0 800 200" width="100%" height="200" role="img" aria-label="内存层次：越靠近 CPU 越快越小越贵" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-grn-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">寄存器（最快、极小）</text><rect x="60" y="64" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="83.0" class="sv-lbl-hi">L1 cache（快、KB）</text><rect x="60" y="98" width="680" height="30" rx="6" class="sv-box"></rect><text x="75" y="117.0" class="sv-lbl-hi">L2/L3（中、MB）</text><rect x="60" y="132" width="680" height="41" rx="6" class="sv-amb-s"></rect><text x="75" y="156.5" class="sv-lbl-hi">主存（慢、GB）</text><rect x="60" y="177" width="680" height="41" rx="6" class="sv-box"></rect><text x="75" y="201.4" class="sv-lbl-hi">Flash / 外存（最慢、最大）</text></svg>
```



寄存器 \< L1 \< L2 \< L3 \< 主存 \< Flash/外存：速度递减、容量递增、单位成本递减。优化的本质，是把热点数据往上层挪、把访问模式改成“让上层能命中”。



表 4.1 层次与工程含义



| 层次 | 典型延迟量级 | 谁管理 | 工程含义 |
| --- | --- | --- | --- |
| 寄存器 | 1 周期 | 编译器 | 保持热点在寄存器 |
| L1 | 几个周期 | 硬件 | 命中=快，未命中=罚 |
| 主存 | 几十到几百周期 | 硬件\+OS | 尽量别让热点落空 |
| Flash | 取决于取指/映射 | 架构 | 把 ISR/关键码放 TCM/SRAM |
| 外存 | 成千上万周期 | OS/驱动 | 预取、分页、[DMA](term:dma) |



```zhizhan-anchor
m04-locality
```



```zhizhan-anchor
m04-locality-t
```



## 4.2 局部性：cache 能生效的唯一理由



cache 之所以有用，靠两种局部性： **时间局部性** （刚用过的很可能再用）与 **空间局部性** （用了某地址，附近地址很可能马上用）。cache 以  **cache line（行）** 为单位载入——读一个字节往往连带载入一整行。



一句话抓住 cache 的本质



cache 命中的是“ **行** ”而不是“字节”。所以：顺序访问把整行都用上（空间局部性好）；跳着访问只用行里一个字，其余白载（浪费）；反复访问同一小块数据能命中（时间局部性好）。下一节的真实命中率就是这三种的量化对照。



aos\_soa.c 节选C

 

```text
// 反例：结构体数组(AoS)，遍历单字段时每个元素都跨行
typedef struct { float x, y, z; } pt_t;
pt_t pts[1024];
float sx = 0; for (int i = 0; i < 1024; i++) sx += pts[i].x;  // 步长 12B，命中差

// 正例：拆成独立数组(SoA)，遍历 x 就是连续内存
float px[1024], py[1024], pz[1024];
for (int i = 0; i < 1024; i++) sx += px[i];                   // 步长 4B，顺序命中
```

同样的遍历，仅改变内存布局即可提升空间局部性



```zhizhan-anchor
m04-evidence
```



```zhizhan-anchor
m04-evidence-t
```



## 4.3 真实命中率：顺序 / 大步长 / 分块复用



下面这段主机程序用确定性 cache 模型（16 行、每行 4 字）跑三种访问模式，输出真实命中率：



host\_locality.cC

 

```text
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
```

局部性与命中率（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_locality.c -o labs/host_locality && ./labs/host_locality
① 顺序   N=256  命中率=75.0%  (hits=192 misses=64)
② 步长64 N=256  命中率=0.0%  (hits=0 misses=256)
③ 分块2遍        命中率=87.5%  (hits=112 misses=16)
结论: 空间局部性(顺序/整块)与时间局部性(复用)共同决定命中率; 大步长几乎全落空
RESULT: PASS
```



顺序=75%（每行只用一次但用满 4 字）、大步长=0%（每行只用 1 字）、分块复用=87.5%（重复访问命中）。



```zhizhan-anchor
fig-图-4-2
```



**图 4.2**  三种访问模式的命中率（同一 cache，仅模式不同）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="三种访问模式的命中率（同一 cache，仅模式不同）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">顺序</text><rect x="150" y="26" width="450" height="18" rx="4" class="sv-cyn-s"></rect><text x="608" y="43" class="sv-lbl-hi">75%</text><text x="12" y="67" class="sv-lbl">分块复用</text><rect x="150" y="50" width="525" height="18" rx="4" class="sv-grn-s"></rect><text x="683" y="67" class="sv-lbl-hi">87.5%</text><text x="12" y="91" class="sv-lbl">大步长</text><rect x="150" y="74" width="2" height="18" rx="4" class="sv-red-s"></rect><text x="160" y="91" class="sv-lbl-hi">0%</text></svg>
```



数据来自 host\_locality.c 的真实输出。同样的数据量，仅访问模式不同，命中率从 0% 到 87.5%——这就是“改数据结构/访问顺序”能带来数量级差异的原因。



把这条用进工程：AoS → SoA



遍历“只用其中一个字段”的结构体数组（AoS）时，每个元素都跨行、命中差；改成“把字段拆成独立数组”（SoA）后，遍历某一字段就是 **连续内存** ，命中大幅提升。这是数值/信号处理里最常用的布局优化之一。



```zhizhan-anchor
m04-write
```



```zhizhan-anchor
m04-write-t
```



## 4.4 写策略与“一致性预告”



写比读复杂：命中时是“写透 (write-through)”还是“写回 (write-back)”？未命中时是“写分配”还是“不分配”？这些决定了 **内存与 cache 何时一致** ——而这正是 M06 DMA 与 M07 多核要处理的问题。



表 4.2 写策略（M06 一致性从这里展开）



| 策略 | 含义 | 代价/风险 |
| --- | --- | --- |
| 写透 write-through | 写 cache 同时写内存 | 带宽占用高，实现简单 |
| 写回 write-back | 先只改 cache，替换时再写回 | 内存可能“旧”，需 clean |
| 写分配 | 未命中先载入再写 | 利用空间局部性 |
| 不写分配 | 未命中直接写内存 | 适合流式写 |



“内存是旧的”不是 bug，是 cache 的正常状态



写回策略下，CPU 改了 cache 但主存还没更新。当  **DMA 或其他核** 去读主存时就会读到旧值——解决办法是  **clean** （把 cache 写回内存）。反过来，设备写了内存而 CPU 还读 cache，则需要  **invalidate** 。见 M06。



```zhizhan-anchor
m04-wall
```



```zhizhan-anchor
m04-wall-t
```



## 4.5 内存墙：什么时候瓶颈不是算力



算力按年快速增长，访存带宽却慢得多，于是很多程序“算得快、等数据慢”，这就是 **内存墙** 。判断方法看 **算术强度** （每读一字节做了多少运算）：强度低的程序受带宽限制，强度高的受算力限制。



表 4.3 先判断瓶颈类型，再谈优化



| 现象 | 瓶颈 | 优化方向 |
| --- | --- | --- |
| 大量小随机访存 | 延迟 | 提升局部性、预取 |
| 大数据流式处理 | 带宽 | 连续访问、向量化、DMA |
| 算术密集 | 算力 | 指令级并行、乘加单元 |
| 频繁同步 | 一致/同步开销 | 减少共享、批处理 |



表 4.4 按算术强度选优化方向



| 算术强度 | 瓶颈 | 典型优化 | 反例（越优化越慢） |
| --- | --- | --- | --- |
| 低（每字节运算少） | 带宽/延迟 | 连续访问、DMA、向量化 | 盲目展开循环但访存不变 |
| 中 | 混合 | 改布局 \+ 局部优化 | 只调编译器选项 |
| 高（运算密集） | 算力 | 乘加单元、并行 | 加 cache 预取（收益小） |



blocked\_loop.c 节选C

 

```text
// 循环分块（loop tiling）：让工作集装进 cache，把“复用”留在块内
for (int ii = 0; ii < N; ii += B)
  for (int kk = 0; kk < N; kk += B)
    for (int jj = 0; jj < N; jj += B)
      for (int i = ii; i < ii + B; i++)
        for (int k = kk; k < kk + B; k++)
          for (int j = jj; j < jj + B; j++)
            C[i][j] += A[i][k] * B[k][j];   // B×B 子块驻留 cache，复用率↑
```

分块把大矩阵乘法的“大工作集”切成“能装进 cache 的小块”，提升时间局部性



先测量，再优化



不要凭感觉优化“算得多的那段”。先用 profiling 找热点（[M09](doc:course-b18-m09#m09)），再看它是 latency-bound 还是 bandwidth-bound，最后才动手——否则方向错，越优化越慢。



```zhizhan-anchor
m04-pitfalls
```



```zhizhan-anchor
m04-pitfalls-t
```



## 4.6 常见误区与排障



失败路径与排障




- **随机访问大数组** ：命中率极低，性能差一个数量级。

- **跳着访问只用行里一个字** ：浪费整行的载入（见 4.3 的大步长 0%）。

- **数据结构布局差（AoS）** ：遍历单字段时命中差，应改 SoA。

- **只优化算力** ：其实是带宽瓶颈，白忙。

- **忽略 cache 与内存不一致** ：DMA/多核读到旧数据（M06/M07）。



◆ 自测 · Module 04（先答再看）




1. 为什么“顺序访问”通常比“大步长访问”快很多？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"顺序访问利用 **空间局部性** ：一行载入后的相邻字被随后用上，命中率高；大步长每次只用行里一个字，几乎每次落空（真实值 0%，见 4.3）。"}
   ```

2. 写回 (write-back) 策略下，为什么 DMA 可能读到旧数据？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"CPU 只改了 cache，主存还没更新。设备/DMA 直接读主存就拿到旧值。解决：传输前置  **clean** （把 cache 写回内存），见 M06。"}
   ```

3. 一个程序遍历结构体数组但只用一个字段，怎么写能更快？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"把“结构体数组 (AoS)”改成“字段各自成数组 (SoA)”，使遍历该字段变成 **连续内存访问** ，提升空间局部性与命中率。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：挑你项目里最热的那个循环，判断它是 latency-bound 还是 bandwidth-bound，并说明你会改布局还是改算法。



核对与延伸：[CS:APP 计算机系统](https://csapp.cs.cmu.edu/) · [CS:APP 计算机系统](https://csapp.cs.cmu.edu/)

 

动手练习



运行 ` labs/host_locality.c `：对比顺序、大步长、分块复用的真实命中率。



**检查结果：** 顺序=75%、步长64=0%、分块2遍=87.5%；据此能说明局部性对性能的影响量级。

 

迁移练习：把本章的“能用局部性原理提升命中率，按 cache line 组织数据，并评估“算力 vs 带宽”谁才是瓶颈。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 04 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b18-m04","criterion":"顺序=75%、步长64=0%、分块2遍=87.5%；据此能说明局部性对性能的影响量级。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b18-guide)
