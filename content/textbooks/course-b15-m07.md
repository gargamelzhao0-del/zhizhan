# 边缘计算与容器化

```zhizhan-anchor
m07
```



边缘容器把“依赖与运行环境”打包：便于部署与回滚，代价是运行时开销与存储。轻量编排（K3s）适合边缘。

 

> 前置：了解 Linux 进程/命名空间与容器基本概念；有镜像构建经验。 · ◷ 约 42 分钟 · ◈ 成熟度/适配对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能为边缘节点规划容器资源上限、镜像分发与可观测方案。

 

本章速览




- 边缘容器要设资源上限防互扰。

- 镜像分层缓存、数据放卷。

- 可观测性齐备。

 

```zhizhan-anchor
m07-edge
```



```zhizhan-anchor
m07-edge-t
```



## 7.1 边缘容器：隔离、分发、可观测



容器把依赖与运行环境打包，便于部署与回滚。要点：设资源上限防互扰、镜像分层与缓存省带宽、只读镜像 \+ 卷保数据、可观测性齐备。



```zhizhan-anchor
fig-图-7-1
```



**图 7.1**  边缘容器的四个要点



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="边缘容器的四个要点" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">资源隔离：CPU/内存上限</text><rect x="60" y="64" width="680" height="30" rx="6" class="sv-grn-s"></rect><text x="75" y="83.0" class="sv-lbl-hi">镜像分发：分层/缓存</text><rect x="60" y="98" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="117.0" class="sv-lbl-hi">数据：只读镜像 + 卷</text><rect x="60" y="132" width="680" height="30" rx="6" class="sv-box"></rect><text x="75" y="151.0" class="sv-lbl-hi">可观测：日志/指标</text></svg>
```



资源隔离（上限）→ 镜像分发（分层/缓存）→ 数据与镜像分离（卷）→ 可观测（日志/指标）。



表 7.1 边缘容器五概念



| 概念 | 作用 | 注意 |
| --- | --- | --- |
| 容器 | 依赖隔离 | 镜像/存储 |
| 编排 | 批量管理 | 资源开销 |
| 隔离 | CPU/内存限制 | 避免互相拖垮 |
| 分发 | 镜像仓库/P2P | 弱网 |
| 观测 | 日志/指标 | 汇聚 |



compose.yml 节选YAML

 

```text
services:
  app:
    image: registry/edge-app:1.3
    read_only: true
    mem_limit: 256m      # 资源上限
    volumes: [ "data:/var/lib/app" ]
```

资源上限 \+ 只读镜像 \+ 卷 \+ 日志



```zhizhan-anchor
m07-evidence
```



```zhizhan-anchor
m07-evidence-t
```



## 7.2 真实证据：资源分配（类比）



容器资源隔离的核心是“不让一个容器拖垮节点”。用资源分配模型类比均衡：



````zhizhan-details
{"title":"共用程序 · 按需展开完整代码","body":"host\\_hetero.cC\n\n \n\n```text\n/* host_hetero.c —— 异构多核/加速器：任务分配与负载均衡（主机可运行）。\n * 把任务按成本分配到能力不同的核/加速器，最小化最大完成时间（简化贪心）。\n * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_hetero.c -o host_hetero && ./host_hetero\n */\n#include <stdio.h>\nint main(void) {\n    int ok = 1;\n    int cost[] = {5, 3, 4, 2};              /* 4 个任务成本 */\n    int n = 4, core[2] = {0, 0};            /* 2 个核负载 */\n    for (int i = 0; i < n; i++) core[core[0] <= core[1] ? 0 : 1] += cost[i];   /* 贪心分给较空核 */\n    int makespan = core[0] > core[1] ? core[0] : core[1];\n    printf(\"负载 核0=%d 核1=%d makespan=%d\\n\", core[0], core[1], makespan);\n    if (makespan != 7) ok = 0;              /* 5+2=7 与 3+4=7 */\n    printf(\"较单核总成本=%d 缩短=%d%%\\n\", 14, (14-makespan)*100/14);\n    printf(\"\\n%s\\n\", ok ? \"RESULT: PASS\" : \"RESULT: FAIL\");\n    return ok ? 0 : 1;\n}\n```\n\n资源分配/均衡模型（主机 gcc 真实编译运行）"}
````



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_hetero.c -o labs/host_hetero && ./labs/host_hetero
负载 核0=7 核1=7 makespan=7
较单核总成本=14 缩短=50%
RESULT: PASS
```



资源均衡分配（makespan=7）类比容器资源上限的作用：避免单容器抢占拖垮节点。



表 7.2 容器规划要点



| 要点 | 做法 | 避免 |
| --- | --- | --- |
| 资源上限 | CPU/内存 limit | 单容器拖垮节点 |
| 镜像分层 | bas 层缓存 | 弱网分发慢 |
| 数据分离 | 只读镜像 \+ 卷 | 升级丢数据 |
| 可观测 | 日志/指标汇聚 | 出问题看不见 |



```zhizhan-anchor
m07-dist
```



```zhizhan-anchor
m07-dist-t
```



## 7.3 分发与 OTA



弱网环境靠镜像分层与缓存降低增量；容器化 [OTA](term:ota) 与固件 OTA 一样要“可失败、可回滚”，数据与镜像分离。



compose.yml 节选YAML

 

```text
services:
  app:
    image: registry/edge-app:1.3
    read_only: true
    mem_limit: 256m      # 资源上限（≤节点内存 50%）
    volumes: [ "data:/var/lib/app" ]  # 数据与镜像分离
    logging: { driver: journald }
```

资源上限 \+ 只读镜像 \+ 卷 \+ 日志



表 7.3 分发与 OTA



| 目标 | 做法 | 避免 |
| --- | --- | --- |
| 部署/回滚 | 容器版本化 | 手工改环境 |
| 弱网 | 分层\+缓存 | 全量重拉 |
| 数据 | 卷 | 数据放镜像 |
| 安全 | 只读镜像\+最小权限 | 容器 root |



```zhizhan-anchor
m07-check
```



```zhizhan-anchor
m07-check-t
```



## 7.4 自检与成熟度对照



边缘容器自检：有资源上限、镜像可分发、数据分离、可观测。



```zhizhan-anchor
fig-图-7-2
```



**图 7.2**  边缘容器交付闭环



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="边缘容器交付闭环" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">构建</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">分发</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">运行</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">观测/回滚</text></svg>
```



构建镜像（分层）→ 分发（缓存）→ 运行（资源上限/只读）→ 观测 → 升级/回滚。



表 7.4 成熟度对照



| 成熟度 | 含义 | 策略 |
| --- | --- | --- |
| 当下可用 | Docker/K3s 成熟 | 可用 |
| 成长期 | 边缘编排推进 | 试点 |
| 观察期 | 资源受限 | 慎用 |



```zhizhan-anchor
m07-pitfalls
```



```zhizhan-anchor
m07-pitfalls-t
```



## 7.5 常见误区与排障



失败路径与排障




- **无资源上限** ：一个容器拖垮节点。

- **镜像不分层** ：弱网分发慢。

- **数据放镜像** ：升级丢数据。

- **无可观测** ：出问题看不见。



◆ 自测 · Module 07（先答再看）




1. 边缘容器为什么要设 CPU/内存上限？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"多容器共享节点资源，无上限时一个容器突发会抢占其它容器资源，导致关键服务（如实时控制）被拖垮。上限保证隔离与可预测性。"}
   ```

2. 为什么“数据不能放在镜像里”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"容器升级会替换镜像，镜像内的数据随之丢失。可写数据应放卷/外部存储，升级只换镜像，数据不丢且可回滚。"}
   ```

3. 弱网环境如何降低镜像分发开销？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"镜像分层 \\+ 缓存：只拉取变化的层，增量小；配合本地缓存/边缘仓库减少重复下载。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你边缘节点规划容器资源上限、只读镜像\+卷、镜像分层与可观测方案，并做一次升级回滚演练。



核对与延伸：[RISC-V 官方](https://riscv.org/)

 

动手练习



运行 ` labs/host_hetero.c `（资源分配/均衡）；为边缘节点规划容器资源上限与分发策略。



**检查结果：** 容器有资源上限（单容器≤节点内存 50%）；资源分配对照 host\_hetero.c（核0=7、核1=7、makespan=7）；数据与镜像分离、可观测齐备。

 

迁移练习：把本章的“能为边缘节点规划容器资源上限、镜像分发与可观测方案。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 07 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b15-m07","criterion":"容器有资源上限（单容器≤节点内存 50%）；资源分配对照 host_hetero.c（核0=7、核1=7、makespan=7）；数据与镜像分离、可观测齐备。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b15-guide)
