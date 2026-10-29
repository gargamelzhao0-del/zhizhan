# 状态估计与传感器融合

```zhizhan-anchor
m07
```



传感器融合用 **模型 \+ 观测** 估计真实状态：互补滤波简单， **卡尔曼** 按不确定度加权。Q/R 决定信任谁。

 

> 前置：理解概率/方差，读过 M02 标定。 · ◷ 约 44 分钟 · ◈ 传感/DSP/控制对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能实现标量卡尔曼/互补滤波，设定 Q/R 并观察创新序列是否发散。

 

本章速览




- 融合=模型预测\+观测更新；Q/R 决定信任。

- 看创新序列发现异常观测。

- 丢样只预测不更新，不伪造观测。

 

```zhizhan-anchor
m07-kalman
```



```zhizhan-anchor
m07-kalman-t
```



## 7.1 预测/更新与 Q/R



融合用模型 \+ 观测估计真实状态。卡尔曼按不确定度加权：Q（过程噪声）大→更信观测；R（观测噪声）大→更信模型。



```zhizhan-anchor
fig-图-7-1
```



**图 7.1**  卡尔曼的两步循环



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="卡尔曼的两步循环" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">预测</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">更新</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">增益加权</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">循环</text></svg>
```



预测（用模型外推）→ 更新（用观测校正，增益由 P/Q/R 决定）→ 循环。



表 7.1 卡尔曼五概念



| 概念 | 作用 | 调参 |
| --- | --- | --- |
| 预测 | 用模型外推 | Q 大→更信观测 |
| 更新 | 用观测校正 | R 大→更信模型 |
| 卡尔曼增益 | 加权 | 自动随 P 变化 |
| 创新 | 观测−预测 | 异常检测 |
| 发散 | P 失控 | 检查模型/异常观测 |



kalman.c 节选C

 

```text
P = P + Q;                                   // 预测
K = P / (P + R); x += K*(z - x); P *= (1-K);  // 更新
/* 丢样：只预测不更新（R→无穷）；创新异常 → 报警 */
```

预测/更新；丢样只预测；创新查异常



```zhizhan-anchor
m07-evidence
```



```zhizhan-anchor
m07-evidence-t
```



## 7.2 真实证据：收敛与方差



下面这段程序验证标量卡尔曼收敛且方差不失控：



host\_kalman.cC

 

```text
/* host_kalman.c —— 标量卡尔曼/互补滤波融合（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_kalman.c -o host_kalman && ./host_kalman
 */
#include <stdio.h>
int main(void) {
    int ok = 1;
    /* 一维卡尔曼：预测 x 不变，更新用观测，增益随不确定度变化 */
    double x = 0, P = 1, Q = 1e-4, R = 0.1;
    double obs[] = {1.0, 1.1, 0.9, 1.05, 1.0};
    for (int i=0;i<5;i++) {
        P += Q;                                  /* 预测 */
        double K = P / (P + R);                  /* 增益 */
        x = x + K * (obs[i] - x);                /* 更新 */
        P = (1 - K) * P;
    }
    printf("融合结果 x=%.3f（观测均值≈1.01）\n", x);
    if (x < 0.9 || x > 1.1) ok = 0;
    printf("方差 P=%.4f（已收敛）\n", P);
    if (P <= 0) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

标量卡尔曼模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_kalman.c -o labs/host_kalman && ./labs/host_kalman
融合结果 x=0.990（观测均值≈1.01）
方差 P=0.0197（已收敛）
RESULT: PASS
```



Q=1e-4、R=0.1，融合结果 0.990 接近观测均值 1.01；方差 P=0.0197 收敛（\>0，未发散）。



表 7.2 融合结果



| 量 | 值 | 含义 |
| --- | --- | --- |
| 融合结果 | 0.990 | 接近真值 |
| 方差 P | 0.0197 | 收敛 |
| Q | 1e-4 | 过程噪声 |
| R | 0.1 | 观测噪声 |



```zhizhan-anchor
m07-innovation
```



```zhizhan-anchor
m07-innovation-t
```



## 7.3 创新序列与丢样



观察创新序列（观测−预测）可发现异常观测与模型失配；丢样时只预测不更新，绝不能伪造观测。



kalman.c 节选C

 

```text
x = x; P = P + Q;                          // 预测
K = P / (P + R); x += K*(z - x); P *= (1-K);  // 更新
/* 丢样：只预测不更新（R→无穷）；创新异常 → 报警 */
```

预测/更新；丢样只预测；创新查异常



表 7.3 融合情形处理



| 情形 | 处理 | 原因 |
| --- | --- | --- |
| 正常 | 预测\+更新 | 有观测 |
| 丢样 | 只预测 | 无观测（勿伪造） |
| 异常观测 | 据创新剔除/降权 | 离群 |
| 发散 | 查模型/Q/R | 失配 |



```zhizhan-anchor
m07-check
```



```zhizhan-anchor
m07-check-t
```



## 7.4 自检



融合自检：收敛不发散、Q/R 合理、创新可查、丢样只预测。



```zhizhan-anchor
fig-图-7-2
```



**图 7.2**  融合结果与方差（真实值）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="融合结果与方差（真实值）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">观测均值</text><rect x="150" y="26" width="551" height="18" rx="4" class="sv-cyn-s"></rect><text x="709" y="43" class="sv-lbl-hi">1010(×10⁻³)</text><text x="12" y="67" class="sv-lbl">融合结果</text><rect x="150" y="50" width="540" height="18" rx="4" class="sv-grn-s"></rect><text x="698" y="67" class="sv-lbl-hi">990(×10⁻³)</text><text x="12" y="91" class="sv-lbl">方差P</text><rect x="150" y="74" width="107" height="18" rx="4" class="sv-amb-s"></rect><text x="265" y="91" class="sv-lbl-hi">197(×10⁻³)</text></svg>
```



融合结果 0.990 接近观测均值 1.01；方差 P=0.0197 收敛（未发散）。



表 7.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 模型 | 状态方程 | 模型错 |
| Q/R | 按噪声定 | 不合理 |
| 创新 | 监控异常 | 忽略 |
| 丢样 | 只预测 | 伪造观测 |



```zhizhan-anchor
m07-pitfalls
```



```zhizhan-anchor
m07-pitfalls-t
```



## 7.5 常见误区与排障



失败路径与排障




- **丢样伪造观测** ：估计被带偏。

- **Q/R 不合理** ：过度平滑或抖动。

- **模型错** ：估计发散。

- **不看创新** ：异常观测未被发现。



◆ 自测 · Module 07（先答再看）




1. 丢样时滤波器应该怎么做？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"只做预测、跳过更新（相当于 R 无穷大）。绝不能“补一个观测值”，那会引入虚假信息使估计失真。"}
   ```

2. Q 和 R 分别越大意味着什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"Q（过程噪声）越大→更信观测、响应更快但更抖；R（观测噪声）越大→更信模型、更平滑但滞后。"}
   ```

3. “创新序列”有什么用？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"创新=观测−预测。若创新出现异常大值，说明观测离群或模型失配，可用于异常检测与告警。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你两路传感器做一次融合（卡尔曼/互补），设定 Q/R 并监控创新序列。



核对与延伸：[Kalman Filter 教程](https://www.kalmanfilter.net/)

 

动手练习



运行 ` labs/host_kalman.c `：验证标量卡尔曼收敛且方差不失控。



**检查结果：** 融合结果 x=0.990（观测均值≈1.01）；方差 P=0.0197 收敛（\>0）；无发散。

 

迁移练习：把本章的“能实现标量卡尔曼/互补滤波，设定 Q/R 并观察创新序列是否发散。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 07 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b20-m07","criterion":"融合结果 x=0.990（观测均值≈1.01）；方差 P=0.0197 收敛（>0）；无发散。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b20-guide)
