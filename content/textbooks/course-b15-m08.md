# AI 辅助嵌入式开发

```zhizhan-anchor
m08
```



AI 辅助开发能加速“写代码、找 bug、读日志、生成测试”，但输出必须 **人工复核** ：它可能给出看似合理却错误的代码/结论。

 

> 前置：有实际驱动/固件开发经验；能独立做代码评审与单元测试。 · ◷ 约 42 分钟 · ◈ 成熟度/适配对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能界定 AI 辅助的适用边界并对生成结果做人工复核与验证。

 

本章速览




- AI 是高效初级助手，输出必须人工复核。

- 安全/关键路径不盲信 AI。

- 注意代码来源与许可。

 

```zhizhan-anchor
m08-ai
```



```zhizhan-anchor
m08-ai-t
```



## 8.1 把 AI 当“高效的初级助手”



AI 能加速写代码、找 bug、读日志、生成测试，但会给出看似合理却错误的输出。适用于草稿、检索、解释；关键逻辑、安全相关与最终验证仍由人负责。



```zhizhan-anchor
fig-图-8-1
```



**图 8.1**  AI 辅助的正确用法



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="AI 辅助的正确用法" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">任务</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">AI 草稿</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">人工复核</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">测试验证</text></svg>
```



明确任务 → AI 生成草稿/候选 → 人工复核（正确性/边界/安全）→ 测试验证 → 采纳或丢弃。



表 8.1 AI 辅助的场景与风险



| 场景 | 收益 | 风险 |
| --- | --- | --- |
| 代码生成 | 提速 | 边界/安全错误 |
| 缺陷发现 | 补充人眼 | 误报漏报 |
| 日志分析 | 快速归纳 | 臆测结论 |
| 测试生成 | 覆盖提升 | 语义偏差 |
| 知识 | 快速入门 | 过时/编造 |



ai\_review.md 节选Text

 

```text
AI 生成 → 编译(-Werror) → 静态分析 → 单元测试 → 人工评审
安全/关键路径：人工复核覆盖率 100%
来源与许可：记录并核对，不引入不明许可代码
```

AI 输出必须过门禁 \+ 人工复核（关键路径 100%）



```zhizhan-anchor
m08-evidence
```



```zhizhan-anchor
m08-evidence-t
```



## 8.2 真实证据：加权评估矩阵（可复现）



对“是否引入某 AI 工具/技术”做加权评估，结论可复现：



host\_radar.cC

 

```text
/* host_radar.c —— 技术雷达与选型：加权评分矩阵（主机可运行）。
 * 按权重给候选技术打分，避免“只看热度”。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_radar.c -o host_radar && ./host_radar
 */
#include <stdio.h>
int main(void) {
    int ok = 1;
    /* 维度权重: 成熟度/生态/性能/迁移成本(越低越好，取负向) */
    int w[4] = {3, 3, 2, 2};
    int A[4] = {4, 4, 3, 4};     /* 技术 A */
    int B[4] = {5, 3, 5, 2};     /* 技术 B */
    int sa = 0, sb = 0, tw = 0;
    for (int i = 0; i < 4; i++) {
        int sign = (i == 3) ? -1 : 1;   /* 第 4 维“迁移成本”越低越好 */
        sa += sign * w[i] * A[i];
        sb += sign * w[i] * B[i];
        tw += w[i];
    }
    printf("A=%d B=%d 满分=%d\n", sa, sb, tw * 5);
    if (!(sa == 22 && sb == 30)) ok = 0;   /* A=3*4+3*4+2*3-2*4=22; B=3*5+3*3+2*5-2*2=30 */
    printf("结论：迁移成本计入负向后 B 更优（30>22），选型需按业务侧重权衡\n");
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

加权评估矩阵（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_radar.c -o labs/host_radar && ./labs/host_radar
A=22 B=30 满分=50
结论：迁移成本计入负向后 B 更优（30>22），选型需按业务侧重权衡
RESULT: PASS
```



加权评分满分 50（权重和 10×5）；迁移成本维度按负向计——评估可复现、可复核。



表 8.2 AI 适用/禁用边界



| 边界 | 允许 | 禁止 |
| --- | --- | --- |
| 代码草稿 | 可 | 直接上量产 |
| 安全/关键路径 | 辅助理解 | 以 AI 结论为准 |
| 测试 | 生成候选 | 不验证即采用 |
| 许可 | 核对来源 | 忽略版权 |



```zhizhan-anchor
m08-review
```



```zhizhan-anchor
m08-review-t
```



## 8.3 人工复核与验证



关键路径人工复核 100%；生成代码要过编译/静态/单测门禁；注意代码来源与许可。



ai\_review.md 节选Text

 

```text
AI 生成 → 编译(-Werror) → 静态分析 → 单元测试 → 人工评审
安全/关键路径：人工复核覆盖率 100%
来源与许可：记录并核对，不引入不明许可代码
```

AI 输出必须过门禁 \+ 人工复核，关键路径 100% 复核



表 8.3 复核与验证环节



| 环节 | 做法 | 目的 |
| --- | --- | --- |
| 门禁 | 编译/静态/单测 | 基础正确性 |
| 评审 | 人工复核 | 边界/安全 |
| 许可 | 来源核对 | 法律 |
| 学习 | 理解原理 | 能力增长 |



```zhizhan-anchor
m08-check
```



```zhizhan-anchor
m08-check-t
```



## 8.4 自检与成熟度对照



AI 辅助自检：边界清晰、有门禁、关键路径复核 100%、注意许可。



```zhizhan-anchor
fig-图-8-2
```



**图 8.2**  加权评分对照（真实值）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="加权评分对照（真实值）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">A</text><rect x="150" y="26" width="240" height="18" rx="4" class="sv-amb-s"></rect><text x="398" y="43" class="sv-lbl-hi">22分</text><text x="12" y="67" class="sv-lbl">B</text><rect x="150" y="50" width="327" height="18" rx="4" class="sv-grn-s"></rect><text x="485" y="67" class="sv-lbl-hi">30分</text><text x="12" y="91" class="sv-lbl">满分</text><rect x="150" y="74" width="545" height="18" rx="4" class="sv-box"></rect><text x="703" y="91" class="sv-lbl-hi">50分</text></svg>
```



A=22、B=30（满分 50）；迁移成本取负向后 B 更优。评分可复现，避免“感觉好”。



表 8.4 成熟度对照



| 成熟度 | 含义 | 策略 |
| --- | --- | --- |
| 当下可用 | 成熟工具\+流程 | 可引入 |
| 成长期 | 能力提升中 | 辅助使用 |
| 观察期 | 可信度不足 | 仅探索 |



```zhizhan-anchor
m08-pitfalls
```



```zhizhan-anchor
m08-pitfalls-t
```



## 8.5 常见误区与排障



失败路径与排障




- **盲信生成代码** ：引入难查的 bug。

- **安全路径用 AI 结论** ：风险不可控。

- **不审核许可** ：法律风险。

- **不学习只会问** ：能力不增长。



◆ 自测 · Module 08（先答再看）




1. AI 生成的驱动代码能直接上量产吗？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"不能。必须人工复核正确性、边界与安全，经过测试与评审；AI 适合做草稿与检索，最终责任在人。"}
   ```

2. 为什么安全/关键路径要求“人工复核 100%”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"AI 输出可能看似合理却错误，安全相关错误后果不可接受。关键路径必须逐条人工复核，不能外包给 AI。"}
   ```

3. 引入 AI 工具时为什么要注意“代码来源与许可”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"生成内容可能含来源不明或许可受限的代码，直接使用有法律与合规风险。要核对来源并记录。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为团队写一份 AI 辅助的“可用/禁用”边界，并把生成代码纳入编译/静态/单测门禁 \+ 人工复核。



核对与延伸：[LiteRT 微控制器](https://ai.google.dev/edge/litert/microcontrollers/overview)

 

动手练习



运行 ` labs/host_radar.c `（评估矩阵思路）；为团队定义 AI 辅助的“可用/禁用”边界。



**检查结果：** 明确 AI 适用/禁用边界；加权评分可复现（A=22、B=30、满分 50）；安全/关键路径人工复核 100%。

 

迁移练习：把本章的“能界定 AI 辅助的适用边界并对生成结果做人工复核与验证。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 08 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-anchor
m08-ai-generated-code
```



```zhizhan-anchor
m08-ai-generated-code-t
```



## AI 生成代码的交付边界

 

把 AI 用于解释日志、提出假设和生成候选实现；验收仍由需求、官方手册与独立测试决定。模型可能捏造寄存器、SDK API 或成功日志。把芯片型号、SDK 修订、接口限制和失败场景写进输入，但不向外部服务提交设备私钥与生产凭据。

 

练习：让工具给出一段 GPIO/ISR 实现，逐个核对头文件声明、寄存器副作用和可调用上下文，再注入超时、队列满与关闭竞态。测试预期来自手册或独立向量，不让生成器同时决定实现与全部答案。

 

当模型能够调用构建、刷写或云 API 时，最小化工具权限；外部文档和设备日志只能提供数据，不能授权新的操作。发布和不可逆写入由明确策略控制。完成一次“看似合理但 API 不存在”的反例比增加提示词篇幅更有学习价值。



```zhizhan-assessment
{"id":"course-b15-m08","criterion":"明确 AI 适用/禁用边界；加权评分可复现（A=22、B=30、满分 50）；安全/关键路径人工复核 100%。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b15-guide)
