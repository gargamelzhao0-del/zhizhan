# 选型与成本

```zhizhan-anchor
m09
```



选型不是只比单价：要算 **总拥有成本** （开发、维护、认证、供应风险），并考虑器件的 **生命周期与替代料** 。

 

> 前置：Module 08 的现场数据与 Module 07 的合规成本。 · ◷ 约 42 分钟 · ◈ 三平台工程实践对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能按功能/成本/供应/生态/替代维度选型，算 BOM 与总拥有成本并准备替代料。

 

本章速览




- 选型算总拥有成本，不只比单价。

- 关键器件要有替代方案，防断供。

- BOM 按批量与良率估算。

 

```zhizhan-anchor
m09-model
```



```zhizhan-anchor
m09-model-t
```



## 9.1 选型的五个维度



选型要算总拥有成本（开发\+维护\+认证\+供应风险），而不是只比单价；并考虑器件生命周期与替代料，避免单一来源断供。



```zhizhan-anchor
fig-图-9-1
```



**图 9.1**  总拥有成本（TCO）的构成



```zhizhan-figure
<svg viewBox="0 0 800 160" width="100%" height="160" role="img" aria-label="总拥有成本（TCO）的构成" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">BOM（物料）</text><rect x="60" y="64" width="680" height="44" rx="6" class="sv-amb-s"></rect><text x="75" y="90.0" class="sv-lbl-hi">开发/维护</text><rect x="60" y="112" width="680" height="30" rx="6" class="sv-grn-s"></rect><text x="75" y="131.0" class="sv-lbl-hi">认证（EMC/安全）</text><rect x="60" y="146" width="680" height="30" rx="6" class="sv-red-s"></rect><text x="75" y="165.0" class="sv-lbl-hi">供应风险（断供/停产）</text></svg>
```



BOM 只是冰山一角；开发、维护、认证、供应风险往往更高。选型要算 TCO。



表 9.1 选型五维度



| 维度 | 内容 | 风险 |
| --- | --- | --- |
| 功能/性能 | 是否满足需求 | 规格不足 |
| 成本 | BOM \+ 工时 \+ 认证 | 只比单价 |
| 供应 | 交期/生命周期 | 停产断供 |
| 生态 | 资料/工具/社区 | 支持差 |
| 替代 | pin-to-pin 备选 | 唯一来源 |



tco.c 节选C

 

```text
double tco = bom_unit * qty / yield      // 物料(含良率)
           + dev_cost + maintenance       // 开发/维护
           + cert_cost                   // 认证
           + supply_risk_cost;           // 供应风险
```

TCO 要把开发/维护/认证/供应风险都算进来



```zhizhan-anchor
m09-evidence
```



```zhizhan-anchor
m09-evidence-t
```



## 9.2 真实证据：BOM 与批量成本



下面这段主机程序计算单板 BOM 与批量物料成本：



host\_bom.cC

 

```text
/* host_bom.c —— 选型与成本：BOM 成本估算与批量缩放（主机可运行）。
 * BOM 成本 = Σ(单价 × 数量)；量产要按批量与良率估算实际成本。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_bom.c -o host_bom && ./host_bom
 */
#include <stdio.h>
typedef struct { const char *name; int unit_milli; int qty; } item_t;   /* unit_milli: 单价(‰元) */
int main(void) {
    int ok = 1;
    item_t bom[] = { {"MCU", 12000, 1}, {"Flash", 3000, 1}, {"Passives", 50, 60}, {"PCB", 5000, 1} };
    int n = (int)(sizeof(bom) / sizeof(bom[0]));
    long total_milli = 0;
    for (int i = 0; i < n; i++) total_milli += (long)bom[i].unit_milli * bom[i].qty;
    printf("单板 BOM = %.2f 元\n", total_milli / 1000.0);
    if (total_milli != 23000) ok = 0;             /* 12+3+3+5=23 元 = 23000‰ */
    long batch = total_milli * 10000;             /* 1 万台 */
    printf("1 万台物料成本 = %.0f 元（不含良率/工时）\n", batch / 1000.0);
    if (batch / 1000 != 230000) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

BOM 成本模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_bom.c -o labs/host_bom && ./labs/host_bom
单板 BOM = 23.00 元
1 万台物料成本 = 230000 元（不含良率/工时）
RESULT: PASS
```



BOM=23.00 元/台、1 万台=23 万元。注意这是“物料”，不含良率、工时、认证。



表 9.2 BOM 与 TCO 的差异



| 成本项 | 是否含 | 说明 |
| --- | --- | --- |
| 物料 BOM | 含 | 23.00 元/台 |
| 良率损耗 | 未含 | 按良率上浮 |
| 工时/产测 | 未含 | 产线成本 |
| 认证/维护 | 未含 | TCO 大头 |



```zhizhan-anchor
m09-alt
```



```zhizhan-anchor
m09-alt-t
```



## 9.3 替代料与生命周期



关键器件要有 pin-to-pin 替代；关注生命周期，避免量产中途停产。替代料需提前验证软硬件兼容。



bom.csv 节选CSV

 

```text
器件,型号,单价,替代料,生命周期
MCU,XX32F103,12.0,YY32F103,2031+
Flash,W25Q64,3.5,W25Q64JV,长期
LDO,AMS1117,0.4,替代型号Z,长期
```

关键器件有 pin-to-pin 替代 \+ 生命周期评估



表 9.3 供应链风险控制



| 做法 | 目的 | 注意 |
| --- | --- | --- |
| pin-to-pin 替代 | 不改板换料 | 需验证兼容 |
| 生命周期评估 | 避免停产 | 看 EOL 通告 |
| 多来源 | 抗断供 | 一致性验证 |
| 认证成本 | 预算完整 | 别漏项 |



```zhizhan-anchor
m09-check
```



```zhizhan-anchor
m09-check-t
```



## 9.4 自检与三路线对照



选型自检：TCO 算全、供应可控、有替代、认证预算在内。



```zhizhan-anchor
fig-图-9-2
```



**图 9.2**  TCO 各部分的量级（示意）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="TCO 各部分的量级（示意）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">BOM</text><rect x="150" y="26" width="180" height="18" rx="4" class="sv-cyn-s"></rect><text x="338" y="43" class="sv-lbl-hi">30%</text><text x="12" y="67" class="sv-lbl">开发/维护</text><rect x="150" y="50" width="270" height="18" rx="4" class="sv-amb-s"></rect><text x="428" y="67" class="sv-lbl-hi">45%</text><text x="12" y="91" class="sv-lbl">认证</text><rect x="150" y="74" width="90" height="18" rx="4" class="sv-grn-s"></rect><text x="248" y="91" class="sv-lbl-hi">15%</text><text x="12" y="115" class="sv-lbl">供应风险</text><rect x="150" y="98" width="60" height="18" rx="4" class="sv-red-s"></rect><text x="218" y="115" class="sv-lbl-hi">10%</text></svg>
```



BOM 占比可能远小于开发\+维护\+认证；只看单价会严重低估总成本。



表 9.4 三路线选型



| 路线 | 选型侧重 | 说明 |
| --- | --- | --- |
| MCU 工程 | BOM \+ 生命周期 | 成本敏感 |
| Linux 工程 | 算力 \+ 内存 \+ 生态 | 性能/生态 |
| CI/自动化 | 标准化与可采购 | 供应链 |



```zhizhan-anchor
m09-pitfalls
```



```zhizhan-anchor
m09-pitfalls-t
```



## 9.5 常见误区与排障



失败路径与排障




- **只看单价** ：总成本失控。

- **忽略生命周期** ：量产中途停产。

- **唯一来源** ：断供即停线。

- **不评估认证成本** ：预算漏项。



◆ 自测 · Module 09（先答再看）




1. 为什么关键器件要准备 pin-to-pin 替代料？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"供应波动/停产随时可能发生；pin-to-pin 替代能在不改板的情况下切换，降低断供风险（需提前验证软硬件兼容）。"}
   ```

2. 为什么“只看单价”会低估成本？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"总拥有成本还包括开发、维护、认证与供应风险，往往远高于 BOM；只看单价会漏掉这些大头。"}
   ```

3. 选型时“生命周期”指什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"器件的供货年限与停产计划（EOL）。要确保覆盖产品生命周期，避免量产中途断供。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你产品列一张 BOM（含替代料与生命周期），并估算 TCO 而不只是物料成本。



核对与延伸：[C\+\+ Core / Google 风格（可移植到 C 团队）](https://google.github.io/styleguide/)

 

动手练习



运行 ` labs/host_bom.c `：计算单板 BOM 与批量物料成本。



**检查结果：** 单板 BOM=23.00 元、1 万台物料=230000 元；关键器件有 pin-to-pin 替代。

 

迁移练习：把本章的“能按功能/成本/供应/生态/替代维度选型，算 BOM 与总拥有成本并准备替代料。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 09 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b12-m09","criterion":"单板 BOM=23.00 元、1 万台物料=230000 元；关键器件有 pin-to-pin 替代。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b12-guide)
