# 设备群管理与服务接口

```zhizhan-anchor
m10
```



设备群管理要能 **批量、可控、可审计** 地管理大量设备：注册分组、配置下发确认、批量操作与灰度、离线设备的处理策略。

 

> 前置：完成 M01（设备注册）与 M06（协同架构）。 · ◷ 约 42 分钟 · ◈ 端/边/云三级对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：设计分批\+可回滚的批量配置与离线设备排队补发流程，识别并下发版本不一致配置。

 

本章速览




- 设备群要能分组、批量、可审计。

- 批量配置分批\+可回滚\+带确认。

- 离线设备排队补发。

 

```zhizhan-anchor
m10-model
```



```zhizhan-anchor
m10-model-t
```



## 10.1 分组、配置、批量、离线



设备群管理要能批量、可控、可审计：注册分组（按类型/区域）、配置下发确认（[幂等](term:idempotency)）、批量操作（分批\+回滚）、离线设备排队补发。



```zhizhan-anchor
fig-图-10-1
```



**图 10.1**  设备群管理的四个能力



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="设备群管理的四个能力" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">分组：按类型/区域</text><rect x="60" y="64" width="680" height="30" rx="6" class="sv-grn-s"></rect><text x="75" y="83.0" class="sv-lbl-hi">配置：版本+确认（幂等）</text><rect x="60" y="98" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="117.0" class="sv-lbl-hi">批量：分批+回滚</text><rect x="60" y="132" width="680" height="30" rx="6" class="sv-box"></rect><text x="75" y="151.0" class="sv-lbl-hi">离线：排队补发</text></svg>
```



分组（标签）→ 配置（版本\+确认）→ 批量（分批\+回滚）→ 离线（排队补发）。



表 10.1 设备群五能力



| 能力 | 内容 | 要点 |
| --- | --- | --- |
| 分组 | 按类型/区域 | 动态标签 |
| 配置 | 版本\+确认 | 幂等 |
| 批量 | 固件/参数 | 分批\+回滚 |
| API | REST/gRPC | 鉴权\+限流 |
| 离线 | 排队/标记 | 恢复补发 |



batch.c 节选C

 

```text
for (chunk in chunks(all, 100)) {        // 每批≤100
    push_batch(chunk, 3);                // 配置版本 3
    if (failed(chunk)) rollback(chunk);  // 可回滚
}
if (!dev.online) mark_pending(dev, 3);   // 离线→待生效
```

分批\+回滚；离线设备标“待生效”排队补发



```zhizhan-anchor
m10-evidence
```



```zhizhan-anchor
m10-evidence-t
```



## 10.2 真实证据：在线与配置版本



设备群管理的最小视图：谁在线、谁配置落后需下发：



````zhizhan-details
{"title":"共用程序 · 按需展开完整代码","body":"host\\_registry.cC\n\n \n\n```text\n/* host_registry.c —— 设备注册与物模型（属性/遥测）模型（主机可运行）。\n * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_registry.c -o host_registry && ./host_registry\n */\n#include <stdio.h>\n#include <string.h>\ntypedef struct { const char *id; const char *type; int online; int cfg_ver; } dev_t;\nint main(void) {\n    int ok = 1;\n    dev_t d[] = { {\"dev-001\",\"env\",1,3}, {\"dev-002\",\"env\",0,3}, {\"dev-003\",\"motor\",1,2} };\n    int n = (int)(sizeof(d)/sizeof(d[0])), online = 0;\n    for (int i = 0; i < n; i++) if (d[i].online) online++;\n    printf(\"设备数=%d 在线=%d\\n\", n, online);\n    if (!(n == 3 && online == 2)) ok = 0;\n    /* 配置版本不一致检测 */\n    int mismatch = 0; for (int i = 0; i < n; i++) if (d[i].cfg_ver != 3) mismatch++;\n    printf(\"配置版本≠3 的设备=%d（需下发）\\n\", mismatch);\n    if (mismatch != 1) ok = 0;\n    printf(\"\\n%s\\n\", ok ? \"RESULT: PASS\" : \"RESULT: FAIL\");\n    return ok ? 0 : 1;\n}\n```\n\n设备注册/配置版本模型（主机 gcc 真实编译运行）"}
````



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_registry.c -o labs/host_registry && ./labs/host_registry
设备数=3 在线=2
配置版本≠3 的设备=1（需下发）
RESULT: PASS
```



3 台设备、2 台在线；1 台配置版本落后需要下发——批量配置据此圈定目标。



表 10.2 群管理操作约束



| 操作 | 范围 | 约束 |
| --- | --- | --- |
| 配置下发 | 版本≠目标的设备 | 幂等\+确认 |
| 批量 | 每批 ≤100 台 | 可回滚 |
| API | 鉴权\+限流 | 防滥用 |
| 离线 | 标记“待生效” | 恢复补发 |



```zhizhan-anchor
m10-batch
```



```zhizhan-anchor
m10-batch-t
```



## 10.3 分批、回滚、离线策略



批量操作必须分批 \+ 可回滚 \+ 可观测；离线设备应排队待补，而不是直接丢弃，并标记“配置待生效”。



batch.c 节选C

 

```text
for (batch = devices_in_chunks(all, 100)) {   // 每批≤100
    push_batch(batch, cfg_ver=3);
    if (batch_failed() > 0) rollback_batch(batch);  // 可回滚
}
if (!dev.online) mark_pending(dev, 3);            // 离线→待生效
```

分批\+回滚；离线设备标“待生效”并排队补发



表 10.3 批量与离线策略



| 场景 | 处理 | 避免 |
| --- | --- | --- |
| 批量配置 | 分批\+回滚 | 全量事故 |
| 离线设备 | 排队补发 | 配置过期 |
| API 调用 | 鉴权\+限流 | 被刷 |
| 失败回滚 | 按批回退 | 坏配置扩散 |



```zhizhan-anchor
m10-check
```



```zhizhan-anchor
m10-check-t
```



## 10.4 自检与三级对照



群管理自检：可分组、配置可确认、批量可回滚、离线有策略。



```zhizhan-anchor
fig-图-10-2
```



**图 10.2**  配置版本分布（示例）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="配置版本分布（示例）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">v3 一致</text><rect x="150" y="26" width="300" height="18" rx="4" class="sv-grn-s"></rect><text x="458" y="43" class="sv-lbl-hi">2台</text><text x="12" y="67" class="sv-lbl">落后</text><rect x="150" y="50" width="150" height="18" rx="4" class="sv-red-s"></rect><text x="308" y="67" class="sv-lbl-hi">1台</text></svg>
```



多数设备配置一致，少数落后需下发；批量只针对落后设备，避免全量刷。



表 10.4 三级群管理



| 层级 | 群管理角色 | 注意 |
| --- | --- | --- |
| 设备端 | 接收/确认配置 | 幂等 |
| 边缘网关 | 代理下发 | 批内聚合 |
| 云平台 | 分组/批量/审计 | 回滚 |



```zhizhan-anchor
m10-pitfalls
```



```zhizhan-anchor
m10-pitfalls-t
```



## 10.5 常见误区与排障



失败路径与排障




- **批量不分批** ：一次性推全量，失败难回滚。

- **配置无确认** ：不知是否生效。

- **API 无限流鉴权** ：被刷。

- **离线直接丢** ：设备回来配置过期。



◆ 自测 · Module 10（先答再看）




1. 为什么批量配置要“分批 \+ 可回滚”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"全量一次推的坏配置会同时影响所有设备；分批能限制影响面，可回滚能快速止损。这与固件灰度的思路一致。"}
   ```

2. 离线设备回来时应该怎么处理？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"不能直接丢弃；应标记“配置待生效”并排队，设备恢复后补发，避免配置过期或用错配置。"}
   ```

3. 服务 API 为什么必须“鉴权 \+ 限流”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"设备群 API 一旦暴露，无鉴权会被越权调用、无限流会被刷爆，导致平台不可用或被恶意操作。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你设备群设计分组、批量配置（分批\+回滚）与离线补发策略，并加 API 鉴权与限流。



核对与延伸：[AWS IoT / 物模型概念](https://docs.aws.amazon.com/iot/) · [OPC UA 概览](https://opcfoundation.org/about/opc-technologies/opc-ua/)

 

动手练习



运行 ` labs/host_registry.c `（设备/配置版本）：设计你的批量配置流程与离线策略。



**检查结果：** 设备可分组；配置带版本 3 与确认，版本≠3 的 1 台需下发；批量每批≤100 台可回滚；离线有排队补发。

 

迁移练习：把本章的“设计分批\+可回滚的批量配置与离线设备排队补发流程，识别并下发版本不一致配置。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 10 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b14-m10","criterion":"设备可分组；配置带版本 3 与确认，版本≠3 的 1 台需下发；批量每批≤100 台可回滚；离线有排队补发。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b14-guide)
