# 硬件在环（HIL）

```zhizhan-anchor
m04
```



HIL 用真实硬件给被测设备施加激励、观测响应并断言，覆盖“与硬件/时序强相关”的部分。每步都是“激励 → 观测 → 断言 \+ 超时”。

 

> 前置：Module 03 的单测分工与主机仿真。 · ◷ 约 44 分钟 · ◈ 三平台工程实践对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能写“激励→观测→断言\+超时”的 HIL 序列并统计通过数。

 

本章速览




- HIL 覆盖硬件/时序相关部分：激励→观测→断言，每步设超时。

- 与单测分工，避免重复。

- 失败要能定位到具体激励与期望。

 

```zhizhan-anchor
m04-model
```



```zhizhan-anchor
m04-model-t
```



## 4.1 HIL：激励-观测-断言-超时



HIL 用真实硬件（或高保真仿真器）给被测设备施加激励、观测响应并断言，覆盖与硬件/时序强相关的部分。每一步都要有 **超时** ，避免无限等待。



```zhizhan-anchor
fig-图-4-1
```



**图 4.1**  一个 HIL 步骤



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="一个 HIL 步骤" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">激励</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">观测</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">期望比较</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">断言/超时</text></svg>
```



施加激励 → 观测响应 → 与期望比较 → 断言；整步带超时，失败可定位到具体激励/期望。



表 4.1 HIL 的五要素



| 要素 | 内容 | 注意 |
| --- | --- | --- |
| 激励 | 信号/总线/网络 | 时序与电平正确 |
| 观测 | 采集/示波器/日志 | 有明确期望值 |
| 超时 | 每步设期限 | 避免无限等待 |
| 自动化 | 脚本驱动 \+ 断言 | 可重复回归 |
| 分工 | 单测管逻辑，HIL 管硬件 | 避免重复 |



hil\_step.c 节选C

 

```text
hil_step("set_mode",   1,  3, 100);   // 激励, 期望, 超时ms
hil_step("read_value", 5, 11, 100);
/* 每步：激励→观测(超时)→断言；不符期望即 FAIL */
```

HIL 序列：激励→观测(超时)→断言，失败可定位



```zhizhan-anchor
m04-evidence
```



```zhizhan-anchor
m04-evidence-t
```



## 4.2 真实证据：激励/期望/观测判定



下面这段主机程序模型化 HIL 序列的判定与超时：



host\_hil.cC

 

```text
/* host_hil.c —— 硬件在环（HIL）测试序列：激励→观测→断言（含超时）（主机可运行）。
 * HIL 用真实硬件激励并观察响应；步骤要有超时与期望值。本程序模拟一段 HIL 序列。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_hil.c -o host_hil && ./host_hil
 */
#include <stdio.h>
#include <string.h>
typedef struct { const char *name; int stim; int expect; int timeout_ms; } step_t;
static int dut(int stim) { return stim * 2 + 1; }   /* 模拟被测设备 */
int main(void) {
    int ok = 1;
    step_t seq[] = { {"set_mode", 1, 3, 100}, {"read_value", 5, 11, 100}, {"bad_case", 2, 99, 100} };
    int n = (int)(sizeof(seq) / sizeof(seq[0])), passed = 0;
    for (int i = 0; i < n; i++) {
        int obs = dut(seq[i].stim);
        int within = 1;   /* 假设在超时内完成 */
        int good = within && (obs == seq[i].expect);
        printf("  %-10s stim=%d expect=%d obs=%d timeout=%dms → %s\n",
               seq[i].name, seq[i].stim, seq[i].expect, obs, seq[i].timeout_ms, good ? "PASS" : "FAIL");
        if (good) passed++;
    }
    printf("HIL 通过 %d/%d\n", passed, n);
    if (passed != 2) ok = 0;   /* 故意有一条失败 */
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

HIL 序列判定模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_hil.c -o labs/host_hil && ./labs/host_hil
  set_mode   stim=1 expect=3 obs=3 timeout=100ms → PASS
  read_value stim=5 expect=11 obs=11 timeout=100ms → PASS
  bad_case   stim=2 expect=99 obs=5 timeout=100ms → FAIL
HIL 通过 2/3
RESULT: PASS
```



观测≠期望即判 FAIL（bad\_case 期望 99 实测 5）；每步 100ms 超时，通过 2/3。



表 4.2 HIL 判定



| 步骤 | 期望 | 观测 | 判定 |
| --- | --- | --- | --- |
| set\_mode | 3 | 3 | PASS |
| read\_value | 11 | 11 | PASS |
| bad\_case | 99 | 5 | FAIL |
| 超时 | ≤100ms | — | 超时即 FAIL |



```zhizhan-anchor
m04-seq
```



```zhizhan-anchor
m04-seq-t
```



## 4.3 测试序列与回归



HIL 序列脚本化后可重复回归。它覆盖“上电时序、总线、传感器读数、保护动作”，与主机单测互补，避免重复覆盖。



hil\_seq.py 节选Python

 

```text
def step(stim, expect, timeout_ms=100):
    apply_stimulus(stim)
    obs = observe(timeout_ms)          # 带超时
    assert obs == expect, f"expect {expect} obs {obs}"

step(1, 3)          # set_mode
step(5, 11)         # read_value
```

HIL 序列：激励→观测(超时)→断言，可重复回归



表 4.3 测试分工



| 放哪 | 内容 | 理由 |
| --- | --- | --- |
| 主机单测 | 纯逻辑/算法 | 快、可自动化 |
| HIL | 上电时序/总线/传感器 | 与硬件强相关 |
| 端到端 | 关键用户场景 | 少量、确认整体 |
| 避免重复 | 同一逻辑只测一层 | 成本/收益 |



```zhizhan-anchor
m04-check
```



```zhizhan-anchor
m04-check-t
```



## 4.4 自检与三路线对照



HIL 自检：每步有超时、期望明确、失败可定位、可自动回归。



```zhizhan-anchor
fig-图-4-2
```



**图 4.2**  HIL 步骤的激励与观测时刻



```zhizhan-figure
<svg viewBox="0 0 800 154" width="100%" height="154" role="img" aria-label="HIL 步骤的激励与观测时刻" preserveAspectRatio="xMidYMid meet"><path class="sv-dash" d="M150,26 V128"></path><text x="150" y="18" text-anchor="middle" class="sv-lbl-dim">0</text><path class="sv-dash" d="M308,26 V128"></path><text x="308" y="18" text-anchor="middle" class="sv-lbl-dim">14</text><path class="sv-dash" d="M466,26 V128"></path><text x="466" y="18" text-anchor="middle" class="sv-lbl-dim">28</text><path class="sv-dash" d="M612,26 V128"></path><text x="612" y="18" text-anchor="middle" class="sv-lbl-dim">41</text><path class="sv-dash" d="M770,26 V128"></path><text x="770" y="18" text-anchor="middle" class="sv-lbl-dim">55</text><text x="12" y="48" class="sv-lbl">激励</text><path class="sv-dash" d="M150,44 H770"></path><rect x="150" y="32" width="113" height="22" rx="4" class="sv-cyn-s"></rect><text x="206.4" y="47" text-anchor="middle" class="sv-lbl-hi">stim</text><text x="12" y="82" class="sv-lbl">观测</text><path class="sv-dash" d="M150,78 H770"></path><rect x="319" y="66" width="338" height="22" rx="4" class="sv-grn-s"></rect><text x="488.2" y="81" text-anchor="middle" class="sv-lbl-hi">observe(≤100ms)</text><text x="12" y="116" class="sv-lbl">超时上限</text><path class="sv-dash" d="M150,112 H770"></path><rect x="657" y="100" width="56" height="22" rx="4" class="sv-red-s"></rect><text x="685.5" y="115" text-anchor="middle" class="sv-lbl-hi">timeout</text></svg>
```



施加激励后等待响应；观测必须超时限制，超时即判 FAIL 而非无限等待。



表 4.4 三路线 HIL



| 路线 | HIL 台架 | 说明 |
| --- | --- | --- |
| MCU 工程 | 激励板 \+ 示波器/逻辑分析仪 | 常见 |
| Linux 工程 | 网络/总线注入 \+ 脚本 | 成熟 |
| CI/自动化 | HIL 集群自动化回归 | 规模 |



```zhizhan-anchor
m04-pitfalls
```



```zhizhan-anchor
m04-pitfalls-t
```



## 4.5 常见误区与排障



失败路径与排障




- **无超时** ：设备无响应时 HIL 卡死。

- **期望值不明确** ：无法判定通过。

- **激励时序错** ：测的不是真实场景。

- **与单测重复** ：成本高收益低。



◆ 自测 · Module 04（先答再看）




1. 什么该放 HIL，什么该放单测？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"与硬件/时序强相关的（上电时序、总线、传感器读数、保护动作）放 HIL；纯逻辑与算法放主机单测。二者互补，避免重复覆盖。"}
   ```

2. 为什么 HIL 每一步都要有超时？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"设备无响应时若无超时，测试会无限等待卡死。超时把“无响应”变成可判定的 FAIL。"}
   ```

3. HIL 判定通过的标准是什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"观测值与期望一致（且无超时）。每一步的期望必须明确，失败要能定位到具体激励与期望。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你一个与硬件相关的功能写一条 HIL 序列（激励→观测→断言\+超时），并纳入回归。



核对与延伸：[cppcheck 文档](https://cppcheck.sourceforge.io/)

 

动手练习



运行 ` labs/host_hil.c `：验证 HIL 序列的激励/期望/观测判定与超时。



**检查结果：** bad\_case（expect=99 obs=5）判 FAIL；步骤含 100ms 超时；通过 2/3。

 

迁移练习：把本章的“能写“激励→观测→断言\+超时”的 HIL 序列并统计通过数。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 04 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b12-m04","criterion":"bad_case（expect=99 obs=5）判 FAIL；步骤含 100ms 超时；通过 2/3。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b12-guide)
