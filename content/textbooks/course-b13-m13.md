# 模型、预处理与固件兼容

```zhizhan-anchor
m13
```



端侧 AI 的隐性大坑是 **版本错配** ：模型更新了，但预处理或固件没同步，精度直接崩。必须把  **模型 / 预处理 / 固件**  三方版本与接口契约管起来。

 

> 前置：Module 05 的量化与 Module 09 的模型 [OTA](term:ota)。 · ◷ 约 42 分钟 · ◈ 端/边/云三级对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能建立模型/预处理/固件兼容矩阵，升级校验通过才加载并明确回退边界。

 

本章速览




- 模型/预处理/固件三方版本与接口契约要管。

- 建兼容矩阵并校验。

- 回退要有边界。

 

```zhizhan-anchor
m13-versions
```



```zhizhan-anchor
m13-versions-t
```



## 13.1 三方版本与接口契约



模型 / 预处理 / 固件三方必须版本配对：模型变了预处理要同步、固件算子要支持新模型、张量形状/类型（接口）不能变。任一错配，精度崩或加载失败。



```zhizhan-anchor
fig-图-13-1
```



**图 13.1**  三方版本与接口契约



```zhizhan-figure
<svg viewBox="0 0 800 170" width="100%" height="170" role="img" aria-label="三方版本与接口契约" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-grn-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">模型：权重/结构（输入输出）</text><rect x="60" y="64" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="83.0" class="sv-lbl-hi">预处理：归一化/特征（与训练配对）</text><rect x="60" y="98" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="117.0" class="sv-lbl-hi">固件：算子/运行时（能否加载）</text><rect x="60" y="132" width="680" height="30" rx="6" class="sv-red-s"></rect><text x="75" y="151.0" class="sv-lbl-hi">接口：张量形状/类型（硬约束）</text></svg>
```



模型（权重/结构）\+ 预处理（归一化/特征）\+ 固件（算子/运行时）三者配对；接口（张量形状/类型）是硬约束。



表 13.1 三方版本



| 版本 | 内容 | 变更影响 |
| --- | --- | --- |
| 模型 | 权重/结构 | 需匹配输入输出 |
| 预处理 | 归一化/特征 | 必须与训练一致 |
| 固件 | 算子/运行时 | 决定模型能否加载 |
| 接口 | 张量形状/类型 | 错配即崩 |



compat.c 节选C

 

```text
if (!compat_ok(model_ver, preproc_ver, fw_ver)) return -1;  // 三方配对
if (tensor_shape_changed(model)) return -2;                  // 接口硬约束
load(model);   // 校验通过才加载，否则回退边界内回滚
```

三方版本配对 \+ 接口固定，校验通过才加载



```zhizhan-anchor
m13-evidence
```



```zhizhan-anchor
m13-evidence-t
```



## 13.2 真实证据：接口基准（scale/zp）



接口基准由量化参数定义；误差上界与裁剪数给出接口的“契约”：



````zhizhan-details
{"title":"共用程序 · 按需展开完整代码","body":"host\\_quant.cC\n\n \n\n```text\n/* host_quant.c —— int8 量化/反量化、误差上界与越界裁剪（主机可运行）。\n * 量化：q = clamp(round(x/scale) + zero_point, -128, 127)，反量化 x' = (q - zero_point)*scale。\n * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_quant.c -o host_quant && ./host_quant\n */\n#include <stdio.h>\n#include <math.h>\nstatic int clamp(int v, int lo, int hi) { return v < lo ? lo : (v > hi ? hi : v); }\nint main(void) {\n    int ok = 1;\n    float scale = 0.02f; int zp = 0;\n    /* 含网格外的值（产生非零误差）与超出可表示范围的值（触发裁剪） */\n    float xs[] = {0.0f, 0.5f, -0.5f, 1.0f, -1.0f, 0.011f, 3.0f, -3.0f};\n    float maxerr_in = 0.0f;\n    int clamped = 0;\n    for (unsigned i = 0; i < sizeof(xs)/sizeof(xs[0]); i++) {\n        int raw = (int)lroundf(xs[i]/scale) + zp;\n        int q = clamp(raw, -128, 127);\n        int in_range = (raw >= -128 && raw <= 127);\n        if (!in_range) clamped++;\n        float xr = (q - zp) * scale;\n        float e = fabsf(xr - xs[i]);\n        if (in_range && e > maxerr_in) maxerr_in = e;\n        printf(\"x=%+.3f q=%4d%s x'=%+.3f err=%.4f\\n\", xs[i], q, in_range ? \"   \" : \" clamp\", xr, e);\n    }\n    printf(\"范围内最大误差=%.4f（≤ scale/2=%.3f）；被裁剪样本数=%d（期望 2）\\n\",\n           maxerr_in, scale/2, clamped);\n    if (maxerr_in > scale/2 + 1e-6) ok = 0;\n    if (clamped != 2) ok = 0;\n    printf(\"\\n%s\\n\", ok ? \"RESULT: PASS\" : \"RESULT: FAIL\");\n    return ok ? 0 : 1;\n}\n```\n\n量化接口与误差（主机 gcc 真实编译运行）"}
````



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_quant.c -o labs/host_quant && ./labs/host_quant
范围内最大误差=0.0090（≤ scale/2=0.010）；被裁剪样本数=2（期望 2）
RESULT: PASS
```



接口基准 scale=0.02、zp=0；误差 ≤ scale/2=0.010、裁剪 2 例。三方版本错配即拒绝加载。



表 13.2 接口基准



| 接口项 | 基准 | 说明 |
| --- | --- | --- |
| scale | 0.02 | 步长 |
| zero-point | 0 | 对称 |
| 误差上界 | ≤0.010 | scale/2 |
| 裁剪 | 2 例 | 越界样本 |



```zhizhan-anchor
m13-matrix
```



```zhizhan-anchor
m13-matrix-t
```



## 13.3 兼容矩阵与回退边界



定义兼容矩阵（哪些模型版本可与哪些固件/预处理组合）；升级时校验三方版本；回退要有边界——预处理不可回退时，模型也不能随便退。



compat.json 节选JSON

 

```text
{ "model": "m-1.3", "preproc": "pp-1.3", "fw_min": "fw-2.1",
  "tensor": { "in": [1,32,3], "dtype": "int8", "scale": 0.02 },
  "compatible": [ {"model":"m-1.2","preproc":"pp-1.3","fw":"fw-2.0"} ],
  "rollback_bound": "pp>=1.3 时 m 最低 1.2" }
```

兼容矩阵 \+ 接口契约 \+ 回退边界



表 13.3 兼容管理



| 做法 | 目的 | 注意 |
| --- | --- | --- |
| 兼容矩阵 | 组合受约束 | 升级校验 |
| 接口契约 | 张量形状/类型固定 | 变更需版本 |
| 升级校验 | 三方配对才加载 | 拒绝错配 |
| 回退边界 | 明确可退范围 | 预处理约束模型 |



```zhizhan-anchor
m13-check
```



```zhizhan-anchor
m13-check-t
```



## 13.4 自检与三级对照



兼容自检：三方版本可查、接口固定、升级校验、回退有边界。



```zhizhan-anchor
fig-图-13-2
```



**图 13.2**  升级校验的门禁



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="升级校验的门禁" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">新模型</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">校验预处理</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">校验固件/接口</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">加载或拒绝</text></svg>
```



新模型 → 校验预处理版本 → 校验固件算子/接口 → 通过才加载；否则拒绝并回退。



表 13.4 三级兼容



| 层级 | 兼容关注 | 说明 |
| --- | --- | --- |
| MCU 端 | 算子/内存/接口 | 严格 |
| Linux 边缘 | 运行时/算子 | 较强 |
| 云/训练 | 数据/模型版本 | 一起管理 |



```zhizhan-anchor
m13-pitfalls
```



```zhizhan-anchor
m13-pitfalls-t
```



## 13.5 常见误区与排障



失败路径与排障




- **只升模型不升预处理** ：精度崩。

- **固件算子不支持新模型** ：加载失败。

- **张量形状/类型变** ：接口错配崩。

- **回退无边界** ：退回后状态错乱。



◆ 自测 · Module 13（先答再看）




1. 为什么端侧 AI 要把“预处理版本”也纳入管理？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"预处理（归一化/特征）与模型是配对的；模型假设的输入分布由预处理决定。只升模型不改预处理，输入分布就变了，精度崩。"}
   ```

2. “兼容矩阵”解决什么问题？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"明确哪些模型版本可与哪些固件/预处理组合，升级时校验三方配对，避免错配导致加载失败或精度崩。"}
   ```

3. 为什么回退要有边界？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"某些升级不可逆（如预处理结构变化）。若无边界地回退，可能出现“旧模型 \\+ 新预处理”的错配组合，状态错乱。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你的设备定义模型-预处理-固件兼容矩阵与接口契约（张量/量化参数），并加升级校验。



核对与延伸：[TFLite Micro 文档](https://ai.google.dev/edge/litert/microcontrollers/overview) · [ONNX Runtime](https://onnxruntime.ai/docs/)

 

动手练习



运行 ` labs/host_quant.c `（量化接口/精度）；为你的设备定义模型-预处理-固件兼容矩阵。



**检查结果：** 三方版本可查且组合受约束；接口基准 scale=0.02、zero-point=0，误差 ≤ scale/2=0.010、裁剪 2 例；回退边界明确。

 

迁移练习：把本章的“能建立模型/预处理/固件兼容矩阵，升级校验通过才加载并明确回退边界。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 13 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b13-m13","criterion":"三方版本可查且组合受约束；接口基准 scale=0.02、zero-point=0，误差 ≤ scale/2=0.010、裁剪 2 例；回退边界明确。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b13-guide)
