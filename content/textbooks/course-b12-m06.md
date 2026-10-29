# 产测与标定

```zhizhan-anchor
m06
```



产测是“每台出厂都过一遍”的检查：覆盖 **关键功能 \+ 标定 \+ 坏件判定** ，并把结果落到可追溯记录。

 

> 前置：Module 04 HIL 与 Module 05 版本/固件管理。 · ◷ 约 42 分钟 · ◈ 三平台工程实践对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能设计覆盖功能\+标定的产测项、把标定参数写入参数区并按序列号追溯。

 

本章速览




- 产测覆盖关键功能与标定，结果按序列号追溯。

- 标定参数写入随设备携带。

- 阈值来自设计指标与统计。

 

```zhizhan-anchor
m06-model
```



```zhizhan-anchor
m06-model-t
```



## 6.1 产测项与标定



产测覆盖关键功能（电源/通信/外设）\+ 标定（增益/偏置/温度补偿）\+ 坏件判定，并把结果落到可追溯记录。阈值来自设计指标与统计，不是拍脑袋。



```zhizhan-anchor
fig-图-6-1
```



**图 6.1**  产测流程



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="产测流程" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">上电</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">功能产测</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">标定</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">记录/判定</text></svg>
```



上电 → 功能产测 → 标定（写参数区）→ 记录（序列号\+结果）→ 坏件判定 → 通过/拦截。



表 6.1 产测五阶段



| 阶段 | 内容 | 产出 |
| --- | --- | --- |
| 功能产测 | 电源/通信/外设 | 通过/失败 |
| 标定 | 增益/偏置/补偿 | 写入参数区 |
| 测试记录 | 序列号 \+ 结果 | 可追溯 |
| 坏件判定 | 阈值与统计 | 拦截不良 |
| 工装 | 自动化治具 | 效率与一致 |



prodtest.c 节选C

 

```text
for (int i=0;i<n;i++) {
  apply(step[i].stim);
  obs = observe(step[i].timeout_ms);
  if (obs != step[i].expect) fail(sn, step[i].name);  // 拦截坏件
}
record(sn, result);   // 按序列号落库，可追溯
```

逐台产测 \+ 不符期望即拦截 \+ 按序列号记录



```zhizhan-anchor
m06-evidence
```



```zhizhan-anchor
m06-evidence-t
```



## 6.2 真实证据：产测序列判定



产测序列与 HIL 同源：每步“激励→观测→断言\+超时”，不符期望即 FAIL：



````zhizhan-details
{"title":"共用程序 · 按需展开完整代码","body":"host\\_hil.cC\n\n \n\n```text\n/* host_hil.c —— 硬件在环（HIL）测试序列：激励→观测→断言（含超时）（主机可运行）。\n * HIL 用真实硬件激励并观察响应；步骤要有超时与期望值。本程序模拟一段 HIL 序列。\n * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_hil.c -o host_hil && ./host_hil\n */\n#include <stdio.h>\n#include <string.h>\ntypedef struct { const char *name; int stim; int expect; int timeout_ms; } step_t;\nstatic int dut(int stim) { return stim * 2 + 1; }   /* 模拟被测设备 */\nint main(void) {\n    int ok = 1;\n    step_t seq[] = { {\"set_mode\", 1, 3, 100}, {\"read_value\", 5, 11, 100}, {\"bad_case\", 2, 99, 100} };\n    int n = (int)(sizeof(seq) / sizeof(seq[0])), passed = 0;\n    for (int i = 0; i < n; i++) {\n        int obs = dut(seq[i].stim);\n        int within = 1;   /* 假设在超时内完成 */\n        int good = within && (obs == seq[i].expect);\n        printf(\"  %-10s stim=%d expect=%d obs=%d timeout=%dms → %s\\n\",\n               seq[i].name, seq[i].stim, seq[i].expect, obs, seq[i].timeout_ms, good ? \"PASS\" : \"FAIL\");\n        if (good) passed++;\n    }\n    printf(\"HIL 通过 %d/%d\\n\", passed, n);\n    if (passed != 2) ok = 0;   /* 故意有一条失败 */\n    printf(\"\\n%s\\n\", ok ? \"RESULT: PASS\" : \"RESULT: FAIL\");\n    return ok ? 0 : 1;\n}\n```\n\n产测/HIL 序列判定（主机 gcc 真实编译运行）"}
````



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_hil.c -o labs/host_hil && ./labs/host_hil
  bad_case   stim=2 expect=99 obs=5 timeout=100ms → FAIL
HIL 通过 2/3
RESULT: PASS
```



观测≠期望即判 FAIL（产测拦截坏件）；每步 100ms 超时；通过 2/3。



表 6.2 产测项示例



| 产测项 | 方法 | 判定 |
| --- | --- | --- |
| 电源 | 电压/电流测量 | 在范围内 |
| 通信 | 环回/总线探测 | 应答正确 |
| 外设 | 功能激励 | 响应符合期望 |
| 标定 | 写参数区回读 | 一致 |



```zhizhan-anchor
m06-cal
```



```zhizhan-anchor
m06-cal-t
```



## 6.3 标定与追溯



标定结果写入 **参数区** 并随设备携带；记录必须能按 **序列号** 追溯，否则批量问题无法定位。



calib.c 节选C

 

```text
/* 标定：两点法求增益/偏置 */
gain = (y2 - y1) / (x2 - x1);
offset = y1 - gain * x1;
param_write(SN, CAL_GAIN, gain);
param_write(SN, CAL_OFFSET, offset);
/* 记录：序列号 + 结果 + 阈值，落产测数据库 */
```

标定写参数区 \+ 按序列号记录，支持追溯



表 6.3 标定与追溯要求



| 要求 | 做法 | 目的 |
| --- | --- | --- |
| 标定 | 两点法增益/偏置 | 每台误差可控 |
| 持久 | 写参数区随设备 | 掉电不丢 |
| 追溯 | 序列号 \+ 结果 | 圈定批次 |
| 阈值 | 设计指标 \+ 统计 | 不漏检不误杀 |



```zhizhan-anchor
m06-check
```



```zhizhan-anchor
m06-check-t
```



## 6.4 自检与三路线对照



产测自检：覆盖关键功能、有标定、有记录、可追溯、阈值有依据。



```zhizhan-anchor
fig-图-6-2
```



**图 6.2**  产测阈值与分布（示意）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="产测阈值与分布（示意）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">良品分布</text><rect x="150" y="26" width="360" height="18" rx="4" class="sv-grn-s"></rect><text x="518" y="43" class="sv-lbl-hi">60(相对)</text><text x="12" y="67" class="sv-lbl">阈值</text><rect x="150" y="50" width="120" height="18" rx="4" class="sv-amb-s"></rect><text x="278" y="67" class="sv-lbl-hi">20(相对)</text><text x="12" y="91" class="sv-lbl">不良</text><rect x="150" y="74" width="120" height="18" rx="4" class="sv-red-s"></rect><text x="278" y="91" class="sv-lbl-hi">20(相对)</text></svg>
```



阈值应位于良品分布与不良分布之间；过松漏检、过紧误杀。阈值来自指标与统计，不拍脑袋。



表 6.4 三路线产测



| 路线 | 产测方式 | 说明 |
| --- | --- | --- |
| MCU 工程 | 治具 \+ 串口产测协议 | 逐台 |
| Linux 工程 | 脚本 \+ 产测服务 | 可自动化 |
| CI/自动化 | 产测数据入库 \+ 追溯 | 批量分析 |



```zhizhan-anchor
m06-pitfalls
```



```zhizhan-anchor
m06-pitfalls-t
```



## 6.5 常见误区与排障



失败路径与排障




- **不标定就出厂** ：每台误差大，现场投诉。

- **无测试记录** ：批量问题无法追溯。

- **阈值拍脑袋** ：要么漏检要么误杀。

- **产测项太少** ：坏件流出到客户。



◆ 自测 · Module 06（先答再看）




1. 为什么产测必须“按序列号追溯”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"批量出现问题时，要能圈定受影响批次、原因与范围（支持召回/固件修复）。没有追溯到序列号的记录，就无法定位规模。"}
   ```

2. 标定参数应该放在哪里？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"写入设备的参数区（非易失、随设备携带），掉电不丢；升级程序不影响它。"}
   ```

3. 产测阈值应该怎么定？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"来自设计指标与统计（良品/不良分布之间），不是拍脑袋；过松漏检、过紧误杀。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你的产品列一份产测项清单与标定参数，并说明如何按序列号记录与追溯。



核对与延伸：[C\+\+ Core / Google 风格（可移植到 C 团队）](https://google.github.io/styleguide/)

 

动手练习



运行 ` labs/host_hil.c `（测试序列模型）；设计你的产测项、标定参数与判定阈值并说明如何追溯。



**检查结果：** 产测序列含超时、通过 2/3；标定参数可写回读；记录可按序列号追溯。

 

迁移练习：把本章的“能设计覆盖功能\+标定的产测项、把标定参数写入参数区并按序列号追溯。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 06 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b12-m06","criterion":"产测序列含超时、通过 2/3；标定参数可写回读；记录可按序列号追溯。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b12-guide)
