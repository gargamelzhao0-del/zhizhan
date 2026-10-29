# DMA 与用户态交互

```zhizhan-anchor
m08
```



[DMA](term:dma) 让外设直接搬内存，代价是它 **不经过 CPU cache** ：同一块内存有两个副本。按传输方向 clean/invalidate、按 cache line 对齐，才能杜绝“偶发旧数据”；用户态则通过 copy\_\*\_user 或 mmap 交互。

 

> 前置：Module 02 用户态拷贝与 Module 06 子系统资源。 · ◷ 约 44 分钟 · ◈ 三平台驱动对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能按 DMA 方向正确维护 cache（clean/invalidate）、对齐缓冲，并正确实现用户态拷贝或 mmap。

 

本章速览




- DMA 在带 cache 的 CPU 上有一致性问题：按方向 clean/invalidate。

- 流式映射一次性、一致映射长期共享；缓冲按 cache line 对齐。

- 用户态交互用 mmap \+ 完成量/中断通知，减少拷贝。

 

```zhizhan-anchor
m08-why
```



```zhizhan-anchor
m08-why-t
```



## 8.1 为什么 DMA 会读到旧数据



CPU 走 cache，DMA 绕过 cache 直连内存：两者看到 **两份副本** 。CPU 改了 cache 未写回 → DMA 读旧值；DMA 改了内存而 CPU 还读 cache → CPU 读旧值。表现为“偶发”，压力大时才暴露。



```zhizhan-anchor
fig-图-8-1
```



**图 8.1**  CPU-cache-内存-DMA 的四角关系



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="CPU-cache-内存-DMA 的四角关系" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">CPU</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">cache（会变旧）</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">主存</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">DMA 引擎</text></svg>
```



CPU 走 cache，DMA 直连内存。两次“失配”：CPU 写后未 clean、设备写后未 invalidate。



表 8.1 按方向维护 cache



| 方向 | 正确动作 | 为什么 | 常见错误 |
| --- | --- | --- | --- |
| CPU→设备 | clean | 让设备读到新值 | 忘记 clean |
| 设备→CPU | invalidate | 让 CPU 读主存最新 | 忘记 invalidate |
| 双向 | clean 后 invalidate | 清方向 \+ 丢旧 cache | 顺序颠倒 |
| 长期共享 | 一致内存（non-cacheable） | 免维护 | 误以为自动 |



```zhizhan-anchor
m08-evidence
```



```zhizhan-anchor
m08-evidence-t
```



## 8.2 真实证据：两种“旧数据”



下面这段程序把“漏 clean / 漏 invalidate”两种错误都跑出来：



host\_dma.cC

 

```text
/* host_dma.c —— DMA 与 cache 一致性模型（主机可运行）。
 * 设备（DMA）写内存不会更新 CPU cache：不 invalidate 就持续读到旧值；
 * CPU 写内存只到 cache：不 clean 设备就读到旧内存。本程序用“脏/有效”模型演示。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_dma.c -o host_dma && ./host_dma
 */
#include <stdio.h>
#include <stdint.h>

typedef struct { uint32_t mem; uint32_t cache; int cache_valid; } dma_t;

static void device_write(dma_t *d, uint32_t v) { d->mem = v; }        /* 设备只写内存，不动 cache */
static uint32_t cpu_read(dma_t *d) { return d->cache_valid ? d->cache : d->mem; }
static void cpu_write(dma_t *d, uint32_t v) { d->cache = v; d->cache_valid = 1; }  /* CPU 只写 cache */
static void invalidate(dma_t *d) { d->cache_valid = 0; }              /* mem→cache：令 cache 失效 */
static void clean(dma_t *d) { d->mem = d->cache; }                    /* cache→mem：刷回内存 */

int main(void) {
    int ok = 1;
    /* CPU 曾读过旧值 0x0（cache 有效），设备随后写 0xABCD */
    dma_t d = { 0x0, 0x0, 1 };
    device_write(&d, 0xABCD);
    printf("设备写后未 invalidate：CPU 读到 0x%X（期望旧值 0x0，脏数据）\n", cpu_read(&d));
    if (cpu_read(&d) != 0x0) ok = 0;

    invalidate(&d);
    printf("invalidate 后：CPU 读到 0x%X（期望 0xABCD）\n", cpu_read(&d));
    if (cpu_read(&d) != 0xABCD) ok = 0;

    cpu_write(&d, 0x1234);                 /* 只写进 cache */
    printf("CPU 写后未 clean：mem=0x%X（期望未更新=0xABCD）\n", d.mem);
    if (d.mem == 0x1234) ok = 0;

    clean(&d);
    printf("clean 后：mem=0x%X（期望 0x1234）\n", d.mem);
    if (d.mem != 0x1234) ok = 0;

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

DMA 一致性方向模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_dma.c -o labs/host_dma && ./labs/host_dma
设备写后未 invalidate：CPU 读到 0x0（期望旧值 0x0，脏数据）
invalidate 后：CPU 读到 0xABCD（期望 0xABCD）
CPU 写后未 clean：mem=0xABCD（期望未更新=0xABCD）
clean 后：mem=0x1234（期望 0x1234）
RESULT: PASS
```



“写出去 clean、读进来 invalidate”——方向反了都是白做。



```zhizhan-anchor
fig-图-8-2
```



**图 8.2**  DMA 传输的 clean/invalidate 时机



```zhizhan-figure
<svg viewBox="0 0 800 120" width="100%" height="120" role="img" aria-label="DMA 传输的 clean/invalidate 时机" preserveAspectRatio="xMidYMid meet"><path class="sv-dash" d="M150,26 V94"></path><text x="150" y="18" text-anchor="middle" class="sv-lbl-dim">0</text><path class="sv-dash" d="M299,26 V94"></path><text x="299" y="18" text-anchor="middle" class="sv-lbl-dim">12</text><path class="sv-dash" d="M460,26 V94"></path><text x="460" y="18" text-anchor="middle" class="sv-lbl-dim">25</text><path class="sv-dash" d="M621,26 V94"></path><text x="621" y="18" text-anchor="middle" class="sv-lbl-dim">38</text><path class="sv-dash" d="M770,26 V94"></path><text x="770" y="18" text-anchor="middle" class="sv-lbl-dim">50</text><text x="12" y="48" class="sv-lbl">CPU→设备</text><path class="sv-dash" d="M150,44 H770"></path><rect x="150" y="32" width="248" height="22" rx="4" class="sv-cyn-s"></rect><text x="274.0" y="47" text-anchor="middle" class="sv-lbl-hi">write</text><rect x="398" y="32" width="124" height="22" rx="4" class="sv-grn-s"></rect><text x="460.0" y="47" text-anchor="middle" class="sv-lbl-hi">clean</text><rect x="522" y="32" width="248" height="22" rx="4" class="sv-amb-s"></rect><text x="646.0" y="47" text-anchor="middle" class="sv-lbl-hi">DMA</text><text x="12" y="82" class="sv-lbl">设备→CPU</text><path class="sv-dash" d="M150,78 H770"></path><rect x="150" y="66" width="248" height="22" rx="4" class="sv-amb-s"></rect><text x="274.0" y="81" text-anchor="middle" class="sv-lbl-hi">DMA</text><rect x="398" y="66" width="124" height="22" rx="4" class="sv-grn-s"></rect><text x="460.0" y="81" text-anchor="middle" class="sv-lbl-hi">invalidate</text><rect x="522" y="66" width="248" height="22" rx="4" class="sv-cyn-s"></rect><text x="646.0" y="81" text-anchor="middle" class="sv-lbl-hi">read</text></svg>
```



CPU→设备：先写缓冲、clean、再启动 DMA；设备→CPU：DMA 完成中断里 invalidate、再读。时机错就读到旧数据。



```zhizhan-anchor
m08-user
```



```zhizhan-anchor
m08-user-t
```



## 8.3 用户态交互：copy\_\*\_user 与 mmap



用户态与驱动交互有两条路： **copy\_\*\_user** （一次拷贝，安全简单）与  **mmap** （把内核/设备内存映射到用户空间，零拷贝但需谨慎管理）。DMA 缓冲要按 cache line 对齐，避免维护误伤相邻数据。



表 8.2 用户态交互方式



| 方式 | 优点 | 代价 | 适用 |
| --- | --- | --- | --- |
| copy\_to/from\_user | 安全、简单 | 多一次拷贝 | 小数据、控制命令 |
| mmap | 零拷贝 | 需处理对齐/权限 | 大数据流、帧缓冲 |
| ioctl \+ copy | 语义清晰 | 拷贝开销 | 配置/查询 |
| mmap \+ DMA | 零拷贝\+硬件搬运 | cache 维护复杂 | 高吞吐采集 |



dma\_user.c 节选C

 

```text
// 按 cache line 对齐的 DMA 缓冲（避免 invalidate 误伤邻居）
__attribute__((aligned(64))) uint8_t dma_buf[4096];

dma_addr_t dma = dma_map_single(dev, dma_buf, sizeof dma_buf, DMA_FROM_DEVICE);
// ... DMA 完成后：
dma_unmap_single(dev, dma, sizeof dma_buf, DMA_FROM_DEVICE);  // 隐含同步
copy_to_user(ubuf, dma_buf, n);   // 再安全交给用户
```

对齐缓冲 \+ dma\_map/unmap 的流式 API（隐含方向同步）



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm08-routes\n```\n\n\n\n```zhizhan-anchor\nm08-routes-t\n```\n\n\n\n## 8.4 三条内核路线对照：DMA\n\n\n\n三条路线都用 ` dma_map_* ` 流式 API，差异在 DMA 控制器与 cache 是否需要显式维护。\n\n\n\n表 8.3 三条路线的 DMA\n\n\n\n| 内核路线 | DMA 控制器 | cache 维护 | 说明 |\n| --- | --- | --- | --- |\n| STM32MP1 | MDMA/DMA | 设备树 dma-names | 有 cache，需同步 |\n| i.MX6ULL | SDMA | DMA API 同步 | 有 cache |\n| V3s | DMA engine | DMA API 同步 | sunxi |"}
````



```zhizhan-anchor
m08-check
```



```zhizhan-anchor
m08-check-t
```



## 8.5 DMA 自检



DMA 问题几乎都是“方向/对齐/屏障”三条。自检清单一目了然：



表 8.4 DMA 自检清单



| 检查项 | 正确 | 错误后果 |
| --- | --- | --- |
| 方向 | CPU→设备 clean、设备→CPU invalidate | 读到旧数据 |
| 对齐 | 缓冲按 cache line 对齐 | 维护误伤邻居 |
| 时机 | 启动前 clean、中断里 invalidate | 偶发脏数据 |
| 映射 | dma\_map/unmap 成对 | 地址不一致/泄漏 |



dma\_check.sh 节选Shell

 

```text
dmesg | grep -i -E "dma|swiotlb|coherent"   # DMA 分配/一致性告警
cat /sys/kernel/debug/dmaengine/summary      # DMA 通道占用
# 采集异常时：确认缓冲对齐、clean/invalidate 时机、map/unmap 配对
```

DMA 异常先核对“方向/对齐/时机/映射”四件事



```zhizhan-anchor
m08-pitfalls
```



```zhizhan-anchor
m08-pitfalls-t
```



## 8.6 常见误区与排障



失败路径与排障




- **忘 invalidate** ：CPU 读旧 cache（偶发）。

- **忘 clean** ：设备读到未写回的值。

- **缓冲未按行对齐** ：维护误伤相邻变量。

- **mmap 越权/越界** ：用户态访问到不该访问的内存。



◆ 自测 · Module 08（先答再看）




1. 设备要写内存给 CPU 读，CPU 该做什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"在做读之前 invalidate 对应 cache 行，丢弃旧 cache，使 CPU 下次读从内存取最新值。"}
   ```

2. CPU 要写数据给 DMA 发送，启动 DMA 前要做什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"clean 对应 cache 行，把新值写回内存，否则 DMA 读到旧值。"}
   ```

3. 为什么 DMA 缓冲要按 cache line 对齐？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"维护以行为单位。不对齐时 invalidate/clean 一整行会波及行内相邻变量，可能丢数据或引入不一致。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：检查项目里所有 DMA 缓冲：方向、对齐、clean/invalidate 顺序，并改用 dma\_map\_\* 流式 API。



核对与延伸：[Linux 内核文档 · IIO](https://www.kernel.org/doc/html/latest/driver-api/iio/index.html) · [Linux 内核文档 · Runtime PM](https://www.kernel.org/doc/html/latest/power/runtime_pm.html)

 

动手练习



运行 ` labs/host_dma.c `：验证遗漏 clean/invalidate 造成的两种“旧数据”。



**检查结果：** 设备写后未 invalidate → CPU 读到旧值；补 invalidate 读到新值；CPU 写后未 clean → 内存未更新；补 clean 更新。

 

迁移练习：把本章的“能按 DMA 方向正确维护 cache（clean/invalidate）、对齐缓冲，并正确实现用户态拷贝或 mmap。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 08 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b10-m08","criterion":"设备写后未 invalidate → CPU 读到旧值；补 invalidate 读到新值；CPU 写后未 clean → 内存未更新；补 clean 更新。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b10-guide)
