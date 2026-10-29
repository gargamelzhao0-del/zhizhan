# 资产、威胁与信任边界

```zhizhan-anchor
m01
```



安全从 **威胁建模** 开始：列出要保护的 **资产** 、可能的 **攻击面** 与 **信任边界** ，按“暴露 × 影响”排优先级。

 

> 前置：了解设备的基本组成（网络/调试/总线/物理接口）与常见攻击概念。 · ◷ 约 42 分钟 · ◈ 身份/固件/通信对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能列出资产/攻击面/信任边界清单，并按“暴露×影响”排出缓解优先级。

 

本章速览




- 先威胁建模：资产/攻击面/信任边界，按暴露×影响排序。

- 调试口是常被忽略的高危入口。

- 先保护高暴露高影响项。

 

```zhizhan-anchor
m01-threat
```



```zhizhan-anchor
m01-threat-t
```



## 1.1 资产、攻击面、信任边界



安全从威胁建模开始：列资产、攻击面与信任边界，按“暴露×影响”排优先级。先保护高暴露\+高影响的资产（常见是网络接口与密钥）；调试口是常被忽略的高危入口。



```zhizhan-anchor
fig-图-1-1
```



**图 1.1**  威胁建模流程



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="威胁建模流程" preserveAspectRatio="xMidYMid meet"><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="var(--grn)"></path></marker><marker id="aha" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="var(--amb)"></path></marker></defs><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">列资产</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">攻击面</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">信任边界</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">风险排序</text></svg>
```



列资产 → 列攻击面（网络/调试/总线/物理）→ 定信任边界 → 风险=暴露×影响 → 排缓解优先级。



表 1.1 威胁建模五概念



| 概念 | 内容 | 输出 |
| --- | --- | --- |
| 资产 | 数据/密钥/功能 | 保护清单 |
| 攻击面 | 网络/调试/总线/物理 | 入口清单 |
| 信任边界 | 谁信任谁 | 验证点 |
| 风险 | 暴露×影响 | 优先级 |
| 缓解 | 加密/认证/隔离 | 措施 |



```zhizhan-anchor
m01-evidence
```



```zhizhan-anchor
m01-evidence-t
```



## 1.2 真实证据：风险排序



下面这段程序按暴露×影响给攻击面排序：



host\_threat.cC

 

```text
/* host_threat.c —— 威胁建模：攻击面与风险评分（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_threat.c -o host_threat && ./host_threat
 */
#include <stdio.h>
int main(void) {
    int ok = 1;
    /* 资产: 暴露面(1-5) × 影响(1-5) = 风险 */
    int surface[4] = {5,3,2,1}, impact[4] = {5,4,3,5};
    const char *name[4] = {"网络接口","调试口","本地总线","物理外壳"};
    for (int i=0;i<4;i++) printf("  %-8s 风险=%d\n", name[i], surface[i]*impact[i]);
    /* 最高风险优先缓解 */
    int maxr = 0, mi = 0;
    for (int i=0;i<4;i++) if (surface[i]*impact[i] > maxr) { maxr = surface[i]*impact[i]; mi = i; }
    printf("最高风险: %s (%d)，优先缓解\n", name[mi], maxr);
    if (!(mi == 0 && maxr == 25)) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

威胁建模/风险排序模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_threat.c -o labs/host_threat && ./labs/host_threat
  网络接口 风险=25
  调试口 风险=12
  本地总线 风险=6
  物理外壳 风险=5
最高风险: 网络接口 (25)，优先缓解
RESULT: PASS
```



风险=暴露(1–5)×影响(1–5)；网络接口=5×5=25 最高，优先缓解；调试口次之。



表 1.2 风险排序



| 攻击面 | 暴露 | 影响 | 风险 |
| --- | --- | --- | --- |
| 网络接口 | 5 | 5 | 25 |
| 调试口 | 3 | 4 | 12 |
| 本地总线 | 2 | 3 | 6 |
| 物理外壳 | 1 | 5 | 5 |



```zhizhan-anchor
m01-debug
```



```zhizhan-anchor
m01-debug-t
```



## 1.3 调试口与优先级



调试口能读写内存、改固件、绕过逻辑，是高危入口；资源优先给“高暴露\+高影响”项。



threat.c 节选C

 

```text
risk = exposure * impact;                  // 暴露×影响
if (risk == max) mitigate_first(item);     // 最高风险优先
/* 调试口/网络接口常是最高危入口，量产要锁定/加固 */
```

风险=暴露×影响；优先缓解最高项



```zhizhan-anchor
m01-check
```



```zhizhan-anchor
m01-check-t
```



## 1.4 自检与成熟度对照



威胁建模自检：资产/攻击面/信任边界齐、有风险量化、有优先级。



```zhizhan-anchor
fig-图-1-2
```



**图 1.2**  攻击面风险（真实值）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="攻击面风险（真实值）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">网络</text><rect x="150" y="26" width="500" height="18" rx="4" class="sv-red-s"></rect><text x="658" y="43" class="sv-lbl-hi">25风险</text><text x="12" y="67" class="sv-lbl">调试口</text><rect x="150" y="50" width="240" height="18" rx="4" class="sv-amb-s"></rect><text x="398" y="67" class="sv-lbl-hi">12风险</text><text x="12" y="91" class="sv-lbl">总线</text><rect x="150" y="74" width="120" height="18" rx="4" class="sv-cyn-s"></rect><text x="278" y="91" class="sv-lbl-hi">6风险</text><text x="12" y="115" class="sv-lbl">物理</text><rect x="150" y="98" width="100" height="18" rx="4" class="sv-box"></rect><text x="258" y="115" class="sv-lbl-hi">5风险</text></svg>
```



网络接口 25、调试口 12、总线 6、物理 5。按风险排序优先缓解。



表 1.3 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 资产 | 数据/密钥 | 漏 |
| 攻击面 | 全部入口 | 忽略调试 |
| 量化 | 暴露×影响 | 凭感觉 |
| 排序 | 高优先 | 平均用力 |



```zhizhan-anchor
m01-quick
```



```zhizhan-anchor
m01-quick-t
```



## 速查与常见错误



把本章的易错点与对策集中对照：



risk.c 节选C

 

```text
risk = exposure * impact;              // 暴露×影响
sort_desc(items, risk);                 // 高风险优先缓解
/* 调试口/网络接口优先处理 */
```

风险量化排序，高暴露×高影响优先



表 1.4 攻击面与缓解



| 要点 | 正确做法 |
| --- | --- |
| 网络接口 | [TLS](term:tls)/认证/最小服务 |
| 调试口 | 量产锁定 |
| 本地总线 | 物理防护/隔离 |
| 物理外壳 | 防拆/防读取 |



```zhizhan-anchor
m01-pitfalls
```



```zhizhan-anchor
m01-pitfalls-t
```



## 1.5 常见误区与排障



失败路径与排障




- **不做威胁建模** ：漏掉关键入口。

- **忽略调试口** ：高危入口敞开。

- **只防网络** ：物理/总线被忽略。

- **不排优先级** ：资源浪费在低风险。



◆ 自测 · Module 01（先答再看）




1. 为什么调试口常是高危入口？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"调试口能读写内存、改固件、绕过程序逻辑；一旦量产设备仍开放未锁的调试口，攻击者可完全控制设备。应在量产时锁定。"}
   ```

2. 风险如何量化排序？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"风险=暴露×影响（各 1–5）。分数越高越优先缓解，把资源投在高暴露\\+高影响项上。"}
   ```

3. 为什么要先定“信任边界”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"信任边界决定“谁需要被验证”。跨边界的输入都要按不可信处理、施加验证，避免盲目信任导致漏洞。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你的设备列一份资产/攻击面/信任边界清单，并按暴露×影响排出缓解优先级。



核对与延伸：[OWASP 嵌入式应用安全](https://owasp.org/www-project-embedded-application-security/)

 

动手练习



运行 ` labs/host_threat.c `：按暴露×影响给攻击面排序。



**检查结果：** 最高风险项（网络接口 25）被识别并优先缓解；风险排序合理。

 

迁移练习：把本章的“能列出资产/攻击面/信任边界清单，并按“暴露×影响”排出缓解优先级。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 01 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b22-m01","criterion":"最高风险项（网络接口 25）被识别并优先缓解；风险排序合理。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b22-guide)
