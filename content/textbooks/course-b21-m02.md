# 采集、标注与数据契约

```zhizhan-anchor
m02
```



数据决定上限。数据工程要管住 **契约、标注一致性、质量与版本** ；没有契约，训练与现场就不一致。

 

> 前置：理解采样与单位量纲，读过 M01。 · ◷ 约 42 分钟 · ◈ 数据/训练/评估对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能为数据集定义契约（单位/量程/采样率）、标注规范、质量标志与确定性回放。

 

本章速览




- 数据契约（单位/量程/采样率）是地基。

- 标注要一致、数据要可回放。

- 坏数据不进训练。

 

```zhizhan-anchor
m02-contract
```



```zhizhan-anchor
m02-contract-t
```



## 2.1 契约、标注、质量、版本



数据决定上限。数据工程要管住契约（单位/量程/采样率）、标注一致性、质量标志与版本。没有契约，训练与现场就不一致。



```zhizhan-anchor
fig-图-2-1
```



**图 2.1**  数据工程的四关



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="数据工程的四关" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">契约：单位/量程/采样率</text><rect x="60" y="64" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="83.0" class="sv-lbl-hi">标注：规范/边界/一致</text><rect x="60" y="98" width="680" height="30" rx="6" class="sv-grn-s"></rect><text x="75" y="117.0" class="sv-lbl-hi">质量：时间戳/丢样/重复</text><rect x="60" y="132" width="680" height="30" rx="6" class="sv-box"></rect><text x="75" y="151.0" class="sv-lbl-hi">版本 + 确定性回放</text></svg>
```



契约（单位/量程/采样率）→ 标注规范 → 质量标志 → 版本 \+ 确定性回放。



表 2.1 数据工程五要素



| 要素 | 内容 | 风险 |
| --- | --- | --- |
| 契约 | 单位/量程/采样率 | 口径不一致 |
| 标注 | 规范/边界/一致性 | 标签噪声 |
| 质量 | 时间戳/丢样/重复 | 污染训练 |
| 版本 | 数据\+预处理 | 不可复现 |
| 回放 | 确定性重放 | 无法定位 |



contract.c 节选C

 

```text
if (v < RANGE_MIN || v > RANGE_MAX) outliers++;   // 越界检测
uint32_t h = fnv1a(data, n);                      // 回放哈希
/* 同批数据回放哈希必须一致；标注按规范+质检 */
```

契约校验量程 \+ 确定性回放哈希 \+ 标注规范



```zhizhan-anchor
m02-evidence
```



```zhizhan-anchor
m02-evidence-t
```



## 2.2 真实证据：契约校验与回放



下面这段程序按契约校验量程并做确定性回放：



host\_contract.cC

 

```text
/* host_contract.c —— 数据契约：单位/量程/采样率校验 + 确定性回放（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_contract.c -o host_contract && ./host_contract
 */
#include <stdio.h>
#include <stdint.h>

/* 契约：字段、单位、量程 [lo,hi]、采样率 fs(Hz) —— 训练与现场必须一致 */
typedef struct { const char *field, *unit; double lo, hi, fs; } contract_t;
static contract_t C = { "accel_x", "m/s^2", -16.0, 16.0, 100.0 };

static int valid(double v) { return v >= C.lo && v <= C.hi; }

/* 确定性回放：对量化后的样本做 FNV-1a，同批数据必须得到同一哈希 */
static uint32_t replay_hash(const double *x, int n) {
    uint32_t h = 2166136261u;
    for (int i = 0; i < n; i++) {
        long q = (long)(x[i] * 1000.0 + (x[i] < 0 ? -0.5 : 0.5));
        uint8_t *p = (uint8_t *)&q;
        for (unsigned k = 0; k < sizeof(long); k++) { h ^= p[k]; h *= 16777619u; }
    }
    return h;
}

int main(void) {
    int ok = 1;
    double batch_a[] = {0.0, 1.5, -2.25, 3.0, 16.0, -16.0};
    double batch_b[] = {0.0, 1.5, -2.25, 3.0, 16.0, -16.0};   /* 同批数据 */
    double bad[]     = {0.0, 20.0};                            /* 一个超量程样本 */

    printf("契约: %s 单位=%s 量程=[%.0f,%.0f] fs=%.0fHz\n",
           C.field, C.unit, C.lo, C.hi, C.fs);
    printf("采样间隔 dt=%.4fs（=1/fs）\n", 1.0 / C.fs);

    /* 量程校验：越界样本必须被标记为脏数据（不得入训） */
    int bad_n = 0;
    for (unsigned i = 0; i < sizeof(bad)/sizeof(bad[0]); i++) if (!valid(bad[i])) bad_n++;
    printf("越界样本数=%d（期望 1）\n", bad_n);
    if (bad_n != 1) ok = 0;

    /* 确定性回放：同批数据 → 同一哈希，实验可复现 */
    uint32_t h1 = replay_hash(batch_a, 6), h2 = replay_hash(batch_b, 6);
    printf("回放哈希 a=%u b=%u（同批→同哈希）\n", h1, h2);
    if (h1 != h2 || h1 == 0) ok = 0;

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

数据契约/回放模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_contract.c -o labs/host_contract && ./labs/host_contract
契约: accel_x 单位=m/s^2 量程=[-16,16] fs=100Hz
采样间隔 dt=0.0100s（=1/fs）
越界样本数=1（期望 1）
回放哈希 a=2619777321 b=2619777321（同批→同哈希）
RESULT: PASS
```



契约 accel\_x：单位 m/s²、量程 \[-16,16\]、fs=100Hz；越界样本被标记；同批回放哈希一致。



表 2.2 契约字段



| 字段 | 值 | 作用 |
| --- | --- | --- |
| 单位 | m/s^2 | 口径 |
| 量程 | \[-16,16\] | 越界检测 |
| fs | 100Hz | dt=0.01s |
| 回放哈希 | 稳定 | 可复现 |



```zhizhan-anchor
m02-label
```



```zhizhan-anchor
m02-label-t
```



## 2.3 标注与回放



标注要有一致的规范与质检；数据必须能确定性回放，否则实验不可复现。



contract.c 节选C

 

```text
if (v < RANGE_MIN || v > RANGE_MAX) outliers++;   // 越界检测
uint32_t h = fnv1a(data, n);                      // 回放哈希
/* 同批数据回放哈希必须一致；标注按规范+质检 */
```

契约校验量程 \+ 确定性回放哈希 \+ 标注规范



表 2.3 数据工程实践



| 做法 | 目的 | 避免 |
| --- | --- | --- |
| 契约 | 口径一致 | 现场/训练不符 |
| 标注规范 | 标签可靠 | 噪声 |
| 质量标志 | 过滤坏数据 | 污染 |
| 确定性回放 | 可复现 | 无法定位 |



```zhizhan-anchor
m02-check
```



```zhizhan-anchor
m02-check-t
```



## 2.4 自检



数据自检：契约明确、标注一致、质量可筛、可确定性回放。



```zhizhan-anchor
fig-图-2-2
```



**图 2.2**  契约与回放（真实值）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="契约与回放（真实值）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">越界样本</text><rect x="150" y="26" width="200" height="18" rx="4" class="sv-amb-s"></rect><text x="358" y="43" class="sv-lbl-hi">1(标志)</text><text x="12" y="67" class="sv-lbl">回放一致</text><rect x="150" y="50" width="200" height="18" rx="4" class="sv-grn-s"></rect><text x="358" y="67" class="sv-lbl-hi">1(标志)</text></svg>
```



越界样本被标记（1 例）；同批回放哈希 a=b 一致，保证可复现。



表 2.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 契约 | 写清单位/量程 | 口径不一致 |
| 标注 | 规范\+质检 | 噪声 |
| 质量 | 标志过滤 | 坏数据入训 |
| 回放 | 哈希一致 | 不可复现 |



```zhizhan-anchor
m02-pitfalls
```



```zhizhan-anchor
m02-pitfalls-t
```



## 2.5 常见误区与排障



失败路径与排障




- **无契约** ：口径不一致。

- **标注不一致** ：标签噪声。

- **坏数据入训** ：模型学错。

- **不可回放** ：无法复现。



◆ 自测 · Module 02（先答再看）




1. 为什么“数据契约”是 ML 工程的地基？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"它定义了字段单位/量程/采样率等口径；训练与现场都必须遵守，否则“数值对但语义错”，模型表现断崖式下降。"}
   ```

2. 为什么数据要“可确定性回放”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"相同输入应得到相同结果，实验才可复现、可对比、可回归。回放哈希一致是这一点的可验证标志。"}
   ```

3. 质量标志（时间戳/丢样/重复）有什么用？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"过滤坏数据，避免污染训练集；也让下游知道哪些数据可信。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你数据集写一份契约（单位/量程/采样率）与标注规范，并实现确定性回放校验。



核对与延伸：[Google ML 速查](https://developers.google.com/machine-learning/guides/rules-of-ml)

 

动手练习



运行 ` labs/host_contract.c `：按契约校验量程并做确定性回放。



**检查结果：** 契约 accel\_x 单位 m/s^2、量程 \[-16,16\]、fs=100Hz；越界样本数=1；同批回放哈希一致。

 

迁移练习：把本章的“能为数据集定义契约（单位/量程/采样率）、标注规范、质量标志与确定性回放。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 02 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b21-m02","criterion":"契约 accel_x 单位 m/s^2、量程 [-16,16]、fs=100Hz；越界样本数=1；同批回放哈希一致。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b21-guide)
