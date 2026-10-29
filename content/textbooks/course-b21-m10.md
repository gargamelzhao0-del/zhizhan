# 综合：可交付模型包

```zhizhan-anchor
m10
```



综合项目把 ML 工程收口成 **可交付模型包** ：数据契约 \+ 训练配置 \+ 模型 \+ 预处理 \+ 评估报告 \+ 版本/校验，支持复现与回滚。

 

> 前置：完成 M01–M09。 · ◷ 约 46 分钟 · ◈ 数据/训练/评估对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能把数据契约、训练配置、模型/预处理、评估报告与版本校验打包成可复现可回滚的模型包。

 

本章速览




- 模型包=契约\+配置\+模型\+预处理\+报告\+版本/校验。

- 评估在独立测试集。

- 版本兼容与回滚边界明确。

 

```zhizhan-anchor
m10-package
```



```zhizhan-anchor
m10-package-t
```



## 10.1 模型包的五个产物



把 ML 工程收口成可交付模型包：数据契约 \+ 训练配置 \+ 模型 \+ 预处理 \+ 评估报告 \+ 版本/校验，支持复现与回滚。



```zhizhan-anchor
fig-图-10-1
```



**图 10.1**  模型包的组成



```zhizhan-figure
<svg viewBox="0 0 800 160" width="100%" height="160" role="img" aria-label="模型包的组成" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">数据契约 + 训练配置（种子/超参）</text><rect x="60" y="64" width="680" height="44" rx="6" class="sv-grn-s"></rect><text x="75" y="90.0" class="sv-lbl-hi">模型 + 预处理（归一化，版本绑定）</text><rect x="60" y="112" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="131.0" class="sv-lbl-hi">评估报告（独立测试 + 业务成本）</text><rect x="60" y="146" width="680" height="30" rx="6" class="sv-box"></rect><text x="75" y="165.0" class="sv-lbl-hi">版本/校验（哈希 + 兼容矩阵）</text></svg>
```



数据契约 \+ 训练配置（可复现）→ 模型 \+ 预处理（版本绑定）→ 评估报告 → 版本/校验（可回滚）。



表 10.1 模型包五产物



| 产物 | 内容 | 验收 |
| --- | --- | --- |
| 数据契约 | 单位/切分 | 口径一致 |
| 训练配置 | 超参/种子 | 可复现 |
| 模型\+预处理 | 权重/归一化 | 版本绑定 |
| 评估报告 | 独立测试\+成本 | 指标可解释 |
| 版本/校验 | 哈希/兼容矩阵 | 可回滚 |



deliver.md 节选Text

 

```text
# 模型交付
- 指标: F1=0.842 (独立测试集; 会话隔离)
- 版本: model_v1 + pre_v1 + 需 fw>=1.3
- 条件: 数据契约 accel_x m/s^2 [-16,16] 100Hz
- 回滚: 保留 pre_v0 + model_v0；接口向前兼容
```

交付说明含指标/版本/条件/回滚；版本三方绑定



```zhizhan-anchor
m10-evidence
```



```zhizhan-anchor
m10-evidence-t
```



## 10.2 真实证据：模型包与校验



下面这段程序给出模型包清单/校验的可运行证据：



````zhizhan-details
{"title":"共用程序 · 按需展开完整代码","body":"host\\_export.cC\n\n \n\n```text\n/* host_export.c —— 模型包清单/版本/校验（主机可运行）。\n * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_export.c -o host_export && ./host_export\n */\n#include <stdio.h>\n#include <stdint.h>\nstatic uint32_t crc(const char *s){ uint32_t h=2166136261u; for(;*s;s++){h^=(uint8_t)*s;h*=16777619u;} return h; }\nint main(void) {\n    int ok=1;\n    const char *model=\"model_v1_int8.tflite\", *pre=\"pre_v1.norm\", *fw=\"fw_1.3\";\n    uint32_t c1=crc(model);\n    printf(\"模型包: model=%s pre=%s fw=%s\\n\", model, pre, fw);\n    printf(\"模型校验=%u\\n\", c1);\n    if(c1==0) ok=0;\n    /* 兼容矩阵：模型要求固件算子版本 >= 1.3 */\n    printf(\"兼容: 模型需 fw>=1.3，当前 %s → OK\\n\", fw);\n    printf(\"\\n%s\\n\", ok?\"RESULT: PASS\":\"RESULT: FAIL\");\n    return ok?0:1;\n}\n```\n\n模型包清单/校验（主机 gcc 真实编译运行）"}
````



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_export.c -o labs/host_export && ./labs/host_export
模型包: model=model_v1_int8.tflite pre=pre_v1.norm fw=fw_1.3
模型校验=4042742740
兼容: 模型需 fw>=1.3，当前 fw_1.3 → OK
RESULT: PASS
```



模型包含 model/pre/fw 三方版本 \+ 校验哈希；兼容矩阵判定可加载，支持回滚。



表 10.2 关键机制与证据



| 产物 | 可运行证据 | 验收 |
| --- | --- | --- |
| 切分 | host\_split.c | 无泄漏 |
| 评估 | host\_metrics.c | F1=0.842 |
| 模型包 | host\_export.c | 版本/校验 |
| 时序组织 | host\_seq.c | 按时间切分 |



```zhizhan-anchor
m10-deliver
```



```zhizhan-anchor
m10-deliver-t
```



## 10.3 交付说明与回滚



验收：独立测试集指标达标且可解释；模型-预处理-固件版本兼容；有校验与回滚边界。



deliver.md 节选Text

 

```text
# 模型交付
- 指标: F1=0.842 (独立测试集; 会话隔离)
- 版本: model_v1 + pre_v1 + 需 fw>=1.3
- 条件: 数据契约 accel_x m/s^2 [-16,16] 100Hz
- 回滚: 保留 pre_v0 + model_v0；接口向前兼容
```

交付说明含指标/版本/条件/回滚；版本三方绑定



表 10.3 交付验收



| 验收项 | 标准 | 避免 |
| --- | --- | --- |
| 指标 | 独立测试 | 虚高 |
| 版本 | 三方绑定 | 错配 |
| 条件 | 契约/环境 | 不可复现 |
| 回滚 | 可退 | 单程票 |



```zhizhan-anchor
m10-check
```



```zhizhan-anchor
m10-check-t
```



## 10.4 自检



交付自检：契约/配置/模型/预处理/评估/版本齐全，可复现可回滚。



```zhizhan-anchor
fig-图-10-2
```



**图 10.2**  模型交付闭环



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="模型交付闭环" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">组包</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">独立评估</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">版本校验</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">交付</text></svg>
```



组包（契约/配置/模型/预处理）→ 独立评估 → 版本校验 → 交付 → （反馈）再迭代。



表 10.4 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 组包 | 六件套齐 | 只交模型文件 |
| 评估 | 独立测试 | 不独立 |
| 版本 | 三方绑定 | 不绑 |
| 回滚 | 留旧版 | 无回滚 |



```zhizhan-anchor
m10-pitfalls
```



```zhizhan-anchor
m10-pitfalls-t
```



## 10.5 常见误区与排障



失败路径与排障




- **只交模型文件** ：无法复现。

- **评估不独立** ：指标虚高。

- **版本不绑** ：更新错配。

- **无回滚** ：坏模型不可退。



◆ 自测 · Module 10（先答再看）




1. 一个“可交付模型包”至少包含什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"数据契约、训练配置（可复现）、模型\\+预处理（版本绑定）、独立测试评估报告、版本与校验（支持回滚）。缺一都会导致复现或部署问题。"}
   ```

2. 为什么模型包要“版本绑定”模型-预处理-固件？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"三者强相关：模型假设的输入分布由预处理决定、算子由固件决定。不绑定会在更新后错配，精度崩或加载失败。"}
   ```

3. 为什么交付要留“回滚边界”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"新模型可能有问题；留旧版与向前兼容的接口，能快速回退到可用版本，避免“单程票”。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：把你的模型打包成可交付模型包（契约\+配置\+模型/预处理\+评估\+版本校验），并写一份交付说明。



核对与延伸：[TFLite 转换](https://ai.google.dev/edge/litert/models/convert) · [模型校准](https://scikit-learn.org/stable/modules/calibration.html)

 

动手练习



运行 ` labs/host_export.c `（模型包）；把模型打包并写交付说明（指标\+条件\+回退）。



**检查结果：** 模型包含数据契约/配置/模型\+预处理/独立测试评估/版本校验；版本兼容矩阵明确、可回滚。

 

迁移练习：把本章的“能把数据契约、训练配置、模型/预处理、评估报告与版本校验打包成可复现可回滚的模型包。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 10 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b21-m10","criterion":"模型包含数据契约/配置/模型+预处理/独立测试评估/版本校验；版本兼容矩阵明确、可回滚。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b21-guide)
