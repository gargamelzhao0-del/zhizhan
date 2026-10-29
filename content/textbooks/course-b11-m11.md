# 综合：可运维 Linux 边缘服务

```zhizhan-anchor
m11
```



把系统编程/IPC/网络/并发/服务化/配置/[OTA](term:ota) 整合为一个真正可交付的服务： **多线程/多进程 \+ 网络 \+ 配置持久化 \+ 服务托管 \+ 可观测 \+ 可升级回滚** 。

 

> 前置：Module 01–10 的系统编程/IPC/网络/并发/服务/配置/OTA。 · ◷ 约 46 分钟 · ◈ 三条构建/部署路线对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能把多线程、网络、配置持久化与服务托管整合为可观测、可恢复、可升级的服务。

 

本章速览




- 可运维 = 可观测 \+ 可恢复 \+ 可升级 \+ 有上界。

- 交付前做冒烟、故障注入与长跑。

- 写清“失败时怎么恢复”。

 

```zhizhan-anchor
m11-arch
```



```zhizhan-anchor
m11-arch-t
```



## 11.1 可运维服务的架构



综合项目把前面能力拼成可交付的服务：多线程/多进程 \+ 网络 \+ 配置持久化 \+ 服务托管 \+ 可观测 \+ 可升级回滚。可运维不是附加项，而是产品的一部分。



```zhizhan-anchor
fig-图-11-1
```



**图 11.1**  可运维服务的分层



```zhizhan-figure
<svg viewBox="0 0 800 200" width="100%" height="200" role="img" aria-label="可运维服务的分层" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-grn-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">应用逻辑（并发/业务）</text><rect x="60" y="64" width="680" height="50" rx="6" class="sv-cyn-s"></rect><text x="75" y="93.0" class="sv-lbl-hi">通信（IPC/socket 分帧）</text><rect x="60" y="118" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="137.0" class="sv-lbl-hi">服务托管（systemd + 限速）</text><rect x="60" y="152" width="680" height="30" rx="6" class="sv-box"></rect><text x="75" y="171.0" class="sv-lbl-hi">配置/持久化（原子写）</text><rect x="60" y="186" width="680" height="30" rx="6" class="sv-box"></rect><text x="75" y="205.0" class="sv-lbl-hi">升级/回滚（OTA）</text></svg>
```



应用逻辑层 → 通信层（IPC/网络）→ 服务托管层（systemd）→ 配置/持久化层 → 升级层。每层都有失败与恢复的边界。



表 11.1 可运维服务的六个维度



| 维度 | 做法 | 验收 |
| --- | --- | --- |
| 并发 | 线程 \+ 锁/条件变量 | 无竞态、无死锁 |
| 通信 | socket/自定义帧 | 半包/粘包正确 |
| 服务 | systemd 托管 | 崩溃可拉起、限速 |
| 配置 | 默认\+原子写 | 掉电不损坏 |
| 可观测 | 日志/指标/健康检查 | 失败可见 |
| 升级 | OTA/容器 \+ 回滚 | 不变砖 |



arch.txt 节选Text

 

```text
app(多线程/业务)
  ├─ net: socket + 长度前缀分帧（半包累积）
  ├─ cfg: 默认值 + 校验 + 原子写（tmp→rename）
  ├─ obs: journald 日志 + 指标 + /health
  └─ upd: A/B OTA + 签名校验 + 回滚
systemd 托管（Restart=on-failure + StartLimit）
```

一张图看清“可运维服务”的六个维度如何落地



```zhizhan-anchor
m11-evidence
```



```zhizhan-anchor
m11-evidence-t
```



## 11.2 真实证据：三份可运行模型



综合项目用到的核心机制都有主机可运行证据（服务限速、配置原子写、流式分帧）：



````zhizhan-details
{"title":"共用程序 · 按需展开完整代码","body":"host\\_service.cC\n\n \n\n```text\n/* host_service.c —— 服务化：崩溃重启与限速（systemd Restart 语义）模型（主机可运行）。\n * 服务反复失败时不能无限重启：StartLimit 在时间窗内限制重启次数，超过进入 failed。\n * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_service.c -o host_service && ./host_service\n */\n#include <stdio.h>\ntypedef enum { RUNNING, FAILED } st_t;\ntypedef struct { int burst; int limit; st_t st; } svc_t;\nstatic void on_failure(svc_t *s) {\n    if (++s->burst > s->limit) s->st = FAILED;          /* 超过限速进入 failed */\n}\nint main(void) {\n    int ok = 1; svc_t s = {0, 5, RUNNING};\n    for (int i = 0; i < 5; i++) on_failure(&s);\n    printf(\"失败 5 次：burst=%d state=%s（仍 RUNNING）\\n\", s.burst, s.st == RUNNING ? \"RUNNING\" : \"FAILED\");\n    if (!(s.burst == 5 && s.st == RUNNING)) ok = 0;\n    on_failure(&s);\n    printf(\"第 6 次：burst=%d state=%s（期望 FAILED，限速生效）\\n\", s.burst, s.st == RUNNING ? \"RUNNING\" : \"FAILED\");\n    if (!(s.burst == 6 && s.st == FAILED)) ok = 0;\n    printf(\"\\n%s\\n\", ok ? \"RESULT: PASS\" : \"RESULT: FAIL\");\n    return ok ? 0 : 1;\n}\n```\n\n服务限速/失败可见（主机 gcc 真实编译运行）"}
````



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_service.c -o labs/host_service && ./labs/host_service
失败 5 次：burst=5 state=RUNNING（仍 RUNNING）
第 6 次：burst=6 state=FAILED（期望 FAILED，限速生效）
RESULT: PASS
```



服务失败可见且被限速，是“可观测 \+ 可恢复”的最小前提。



表 11.2 三份可运行证据



| 机制 | 证据文件 | 验收 |
| --- | --- | --- |
| 服务限速 | host\_service.c | 第 6 次→FAILED |
| 配置原子写 | host\_cfg.c | 掉电未损坏=1 |
| 流式分帧 | host\_socket.c | 半包 take=0 |



```zhizhan-anchor
m11-ship
```



```zhizhan-anchor
m11-ship-t
```



## 11.3 交付前的三件事



交付前三件事： **① 端到端冒烟与故障注入；② 资源预算与长跑；③ 写清“失败时怎么恢复”** 。



smoke.sh 节选Shell

 

```text
# ① 冒烟 + 故障注入
systemctl start myapp && curl -f http://localhost:8080/health
kill -9 $(pidof app)   # 注入崩溃，验证自动拉起
# ② 长跑与资源
valgrind --leak-check=full ./app --soak 3600
# ③ 恢复策略已写入 runbook（重启/回滚/维护模式）
```

冒烟 \+ 故障注入 \+ 长跑 \+ 恢复手册



表 11.3 交付三件事



| 交付项 | 内容 | 验收 |
| --- | --- | --- |
| 冒烟/故障注入 | 健康检查 \+ 杀进程 | 自动拉起 |
| 长跑 | 内存/CPU 稳定 | 无泄漏/无超预算 |
| 恢复手册 | 重启/回滚/维护 | 现场可执行 |



```zhizhan-anchor
m11-check
```



```zhizhan-anchor
m11-check-t
```



## 11.4 验收清单



按维度逐条判定，缺一项都难以在现场稳定运行：



```zhizhan-anchor
fig-图-11-2
```



**图 11.2**  从开发到可运维的闭环



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="从开发到可运维的闭环" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="88.0" y="66" text-anchor="middle" class="sv-lbl-hi">编码</text><path d="M158,69 H174" class="sv-arrow"></path><rect x="176" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="244.0" y="66" text-anchor="middle" class="sv-lbl-hi">服务化</text><path d="M314,69 H330" class="sv-arrow"></path><rect x="332" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="400.0" y="66" text-anchor="middle" class="sv-lbl-hi">持久化</text><path d="M470,69 H486" class="sv-arrow"></path><rect x="488" y="44" width="136" height="50" rx="7" class="sv-cyn-s"></rect><text x="556.0" y="66" text-anchor="middle" class="sv-lbl-hi">观测</text><path d="M626,69 H642" class="sv-arrow"></path><rect x="644" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="712.0" y="66" text-anchor="middle" class="sv-lbl-hi">升级/恢复</text></svg>
```



编码（并发/通信）→ 服务化 → 配置持久化 → 观测 → 升级回滚 → 现场恢复。



表 11.4 三路线交付形态



| 路线 | 交付形态 | 说明 |
| --- | --- | --- |
| Buildroot | 定制 rootfs \+ 服务 | 轻量边缘 |
| Yocto | 镜像 \+ SDK | 产品线 |
| Debian | 容器/包 \+ systemd | 工具最全 |



```zhizhan-anchor
m11-pitfalls
```



```zhizhan-anchor
m11-pitfalls-t
```



## 11.5 常见误区与排障



失败路径与排障




- **能跑但不可观测** ：现场故障无法定位。

- **无恢复策略** ：一次异常永久停服。

- **升级无回滚** ：坏版本上线即事故。

- **无资源上界** ：突发负载拖垮整机。



◆ 自测 · Module 11（先答再看）




1. “可运维”最少要包含哪几项？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"至少要有日志/指标（可观测）、健康检查与自动恢复、清晰的重启/升级/回滚策略、以及资源上界。缺一项都难以在现场稳定运行。"}
   ```

2. 为什么交付前要做故障注入？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"验证“崩溃能被自动拉起、升级失败能回滚”。只测正常路径会把故障处理留到现场暴露。"}
   ```

3. 长跑测试的目的是什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"暴露内存泄漏、句柄泄漏、长时间漂移与资源缓慢增长等“短测看不出来”的问题。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：按表 11.1 的六个维度为你的服务逐条验收，并补全缺失项（尤其可观测与回滚）。



核对与延伸：[Linux man-pages](https://man7.org/linux/man-pages/) · [Beej 网络编程指南](https://beej.us/guide/bgnet/)

 

动手练习



运行 ` labs/host_service.c `（重启/限速模型）；把你的服务按“并发-通信-服务-配置-升级”列验收清单。



**检查结果：** 服务可托管且第 6 次失败转 FAILED；配置掉电未损坏=1；分帧半包 take=0；升级有回滚。

 

迁移练习：把本章的“能把多线程、网络、配置持久化与服务托管整合为可观测、可恢复、可升级的服务。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 11 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b11-m11","criterion":"服务可托管且第 6 次失败转 FAILED；配置掉电未损坏=1；分帧半包 take=0；升级有回滚。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b11-guide)
