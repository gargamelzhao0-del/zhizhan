# 设备接入与物模型

```zhizhan-anchor
m01
```



接入层要把设备“说清楚”：用 **物模型** 定义属性、遥测与命令，并管理设备身份、配置版本与在线状态。

 

> 前置：会写 C、了解 MQTT/HTTP 基础概念。 · ◷ 约 42 分钟 · ◈ 端/边/云三级对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：为设备定义含字段单位/范围/类型的物模型，并实现配置版本下发与确认。

 

本章速览




- 物模型定义属性/遥测/命令，字段单位与范围要写清。

- 设备一机一密，配置带版本与确认。

- 在线状态靠心跳/遗嘱，不靠猜。

 

```zhizhan-anchor
m01-model
```



```zhizhan-anchor
m01-model-t
```



## 1.1 物模型与身份



物模型是端云契约：字段名、单位、类型、范围都要定死，否则“数值对但语义错”。同时管理设备身份（一机一密）、配置版本（下发\+确认）与在线状态（心跳/遗嘱）。



```zhizhan-anchor
fig-图-1-1
```



**图 1.1**  物模型的三个面



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="物模型的三个面" preserveAspectRatio="xMidYMid meet"><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="var(--grn)"></path></marker><marker id="aha" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="var(--amb)"></path></marker></defs><rect x="60" y="30" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">属性 property（可读写）</text><rect x="60" y="64" width="680" height="30" rx="6" class="sv-grn-s"></rect><text x="75" y="83.0" class="sv-lbl-hi">遥测 telemetry（上行）</text><rect x="60" y="98" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="117.0" class="sv-lbl-hi">命令 command（下行）</text><rect x="60" y="132" width="680" height="30" rx="6" class="sv-box"></rect><text x="75" y="151.0" class="sv-lbl-hi">字段：单位/类型/范围</text></svg>
```



属性（可读写状态）、遥测（只上行测量）、命令（下行控制）。每个字段带单位与量程。



表 1.1 接入五要素



| 要素 | 内容 | 风险 |
| --- | --- | --- |
| 物模型 | 属性/遥测/命令 | 语义不清 |
| 身份 | 设备 ID/密钥 | 伪造接入 |
| 注册 | 一机一密 | 共用密钥 |
| 配置版本 | 下发与确认 | 版本漂移 |
| 在线 | 心跳/遗嘱 | 状态不准 |



thing\_model.json 节选JSON

 

```text
{ "temp": { "unit": "℃", "type": "float", "range": [-40, 85] },
  "online": { "type": "bool" }, "cfg_ver": { "type": "int" } }
```

物模型字段带单位/类型/范围，端云契约一致



```zhizhan-anchor
m01-evidence
```



```zhizhan-anchor
m01-evidence-t
```



## 1.2 真实证据：在线与配置版本



下面这段程序统计在线设备并检测配置版本不一致的设备：



host\_registry.cC

 

```text
/* host_registry.c —— 设备注册与物模型（属性/遥测）模型（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_registry.c -o host_registry && ./host_registry
 */
#include <stdio.h>
#include <string.h>
typedef struct { const char *id; const char *type; int online; int cfg_ver; } dev_t;
int main(void) {
    int ok = 1;
    dev_t d[] = { {"dev-001","env",1,3}, {"dev-002","env",0,3}, {"dev-003","motor",1,2} };
    int n = (int)(sizeof(d)/sizeof(d[0])), online = 0;
    for (int i = 0; i < n; i++) if (d[i].online) online++;
    printf("设备数=%d 在线=%d\n", n, online);
    if (!(n == 3 && online == 2)) ok = 0;
    /* 配置版本不一致检测 */
    int mismatch = 0; for (int i = 0; i < n; i++) if (d[i].cfg_ver != 3) mismatch++;
    printf("配置版本≠3 的设备=%d（需下发）\n", mismatch);
    if (mismatch != 1) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

设备注册/在线/配置版本模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_registry.c -o labs/host_registry && ./labs/host_registry
设备数=3 在线=2
配置版本≠3 的设备=1（需下发）
RESULT: PASS
```



3 台设备、2 台在线；1 台配置版本落后需要下发——这是设备群管理的最小视图。



表 1.2 设备注册字段



| 字段 | 含义 | 判定 |
| --- | --- | --- |
| device\_id | 设备唯一标识 | 一机一密 |
| online | 心跳未超时 | \>30s 判离线 |
| cfg\_ver | 配置版本 | ≠目标即待下发 |
| stage | 出厂/现场 | 管理策略不同 |



```zhizhan-anchor
m01-cfg
```



```zhizhan-anchor
m01-cfg-t
```



## 1.3 配置下发与确认



配置要带 **版本 \+ 确认** ：下发后设备回执，才能知道是否生效；否则“发下去没生效”无法察觉。



registry.c 节选C

 

```text
for (int i=0;i<n;i++)
  if (dev[i].online && dev[i].cfg_ver != TARGET_VER)
    push_config(dev[i].id, TARGET_VER);   // 下发并等回执
/* 收到回执后更新 cfg_ver；超时未确认则重试 */
```

按目标版本下发 \+ 回执确认，杜绝“发了没生效”



表 1.3 接入实践



| 做法 | 目的 | 注意 |
| --- | --- | --- |
| 版本\+确认 | 确保生效 | [幂等](term:idempotency) |
| 一机一密 | 限影响面 | 可吊销 |
| 心跳/遗嘱 | 状态准确 | 超时阈值 |
| 单位/量程 | 语义明确 | 写入契约 |



```zhizhan-anchor
m01-check
```



```zhizhan-anchor
m01-check-t
```



## 1.4 自检与三级对照



接入自检：物模型完整、身份唯一、配置可确认、在线准确。



```zhizhan-anchor
fig-图-1-2
```



**图 1.2**  在线/离线与配置一致性（示例）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="在线/离线与配置一致性（示例）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">在线</text><rect x="150" y="26" width="300" height="18" rx="4" class="sv-grn-s"></rect><text x="458" y="43" class="sv-lbl-hi">2台</text><text x="12" y="67" class="sv-lbl">离线</text><rect x="150" y="50" width="150" height="18" rx="4" class="sv-amb-s"></rect><text x="308" y="67" class="sv-lbl-hi">1台</text><text x="12" y="91" class="sv-lbl">配置待下发</text><rect x="150" y="74" width="150" height="18" rx="4" class="sv-red-s"></rect><text x="308" y="91" class="sv-lbl-hi">1台</text></svg>
```



3 台设备中 2 台在线、1 台配置落后。设备群管理要一眼看出“谁在线、谁需要下发”。



表 1.4 三级接入



| 层级 | 接入角色 | 注意 |
| --- | --- | --- |
| 设备端 | 上报/接收命令 | 物模型契约 |
| 边缘网关 | 代理/缓存 | 协议转换 |
| 云平台 | 注册/管理 | 身份与版本 |



```zhizhan-anchor
m01-pitfalls
```



```zhizhan-anchor
m01-pitfalls-t
```



## 1.5 常见误区与排障



失败路径与排障




- **物模型无单位/范围** ：数据无法解释。

- **共用密钥** ：一台被破全网风险。

- **配置无确认** ：不知道是否生效。

- **在线状态靠猜** ：心跳/遗嘱缺失。



◆ 自测 · Module 01（先答再看）




1. 为什么物模型必须写清单位与范围？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"没有单位/范围，数据无法解释与聚合（温度是 ℃ 还是 ℉？电流是 mA 还是 A？），上下游各按自己理解处理，导致“数值对但语义错”。"}
   ```

2. 为什么设备密钥要“一机一密”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"共用一套密钥意味着一次泄露即全网可伪造；一机一密把影响限制在单台，且可单独吊销/轮换。"}
   ```

3. 配置下发为什么必须带“确认”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"发送成功不等于设备已应用。带版本\\+回执才能确认生效，否则“发下去没生效”无法察觉。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你的设备定义物模型（字段\+单位\+范围\+类型），并实现带版本与确认的配置下发。



核对与延伸：[AWS IoT / 物模型概念](https://docs.aws.amazon.com/iot/)

 

动手练习



运行 ` labs/host_registry.c `：统计在线设备并检测配置版本不一致的设备。



**检查结果：** 设备数 3、在线 2；配置版本≠3 的设备=1 被识别并需下发。

 

迁移练习：把本章的“为设备定义含字段单位/范围/类型的物模型，并实现配置版本下发与确认。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 01 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b14-m01","criterion":"设备数 3、在线 2；配置版本≠3 的设备=1 被识别并需下发。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b14-guide)
