# 服务化与部署

```zhizhan-anchor
m06
```



把应用做成 **服务** ：由 init 系统托管，崩溃能自动重启、开机自启、依赖就绪后再启动、日志可查。价值在于“失败可见、可自愈、可运维”。

 

> 前置：Module 01 系统编程与 Module 05 的多线程/并发。 · ◷ 约 44 分钟 · ◈ 三条构建/部署路线对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能写 systemd unit（After/Restart/StartLimit）让服务自启、崩溃重启且失败可见。

 

本章速览




- 应用应由 init 托管：开机自启、崩溃拉起、日志可查。

- 重启要限速，避免重启风暴。

- 依赖顺序写对，网络就绪后再启动。

 

```zhizhan-anchor
m06-model
```



```zhizhan-anchor
m06-model-t
```



## 6.1 systemd unit：依赖、重启、限速



托管解决“崩溃无人拉起、开机不自启、依赖未就绪就启动”。关键配置：` After/Wants `（顺序依赖）、` Restart `（崩溃重启）、` StartLimit `（重启限速，避免风暴）。



```zhizhan-anchor
fig-图-6-1
```



**图 6.1**  服务的生命周期与重启限速



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="服务的生命周期与重启限速" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">启动</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">运行</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">崩溃重启</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">限速→failed</text></svg>
```



启动 → 运行 → 崩溃 → 重启（受 RestartSec 间隔）→ 连续失败达限速阈值 → 进入 failed（暴露问题）。



表 6.1 systemd unit 关键配置



| 配置 | 作用 | 要点 |
| --- | --- | --- |
| After/Wants | 启动顺序与依赖 | 别写成硬依赖循环 |
| Restart | 崩溃重启 | on-failure 常用 |
| RestartSec | 重启间隔 | 避免瞬间风暴 |
| StartLimit | 重启限速 | 超过进入 failed |
| journald | 日志集中 | 结构化、可检索 |



journalctl.sh 节选Shell

 

```text
systemctl status myapp          # 状态/最近日志
journalctl -u myapp -b -p err    # 本次启动的错误
systemctl is-failed myapp        # 是否进入 failed
```

从 journald/systemd 查服务状态与失败原因



```zhizhan-anchor
m06-evidence
```



```zhizhan-anchor
m06-evidence-t
```



## 6.2 真实证据：重启限速



下面这段主机程序模型化“连续失败 → 达到限速 → 进入 failed”：



host\_service.cC

 

```text
/* host_service.c —— 服务化：崩溃重启与限速（systemd Restart 语义）模型（主机可运行）。
 * 服务反复失败时不能无限重启：StartLimit 在时间窗内限制重启次数，超过进入 failed。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_service.c -o host_service && ./host_service
 */
#include <stdio.h>
typedef enum { RUNNING, FAILED } st_t;
typedef struct { int burst; int limit; st_t st; } svc_t;
static void on_failure(svc_t *s) {
    if (++s->burst > s->limit) s->st = FAILED;          /* 超过限速进入 failed */
}
int main(void) {
    int ok = 1; svc_t s = {0, 5, RUNNING};
    for (int i = 0; i < 5; i++) on_failure(&s);
    printf("失败 5 次：burst=%d state=%s（仍 RUNNING）\n", s.burst, s.st == RUNNING ? "RUNNING" : "FAILED");
    if (!(s.burst == 5 && s.st == RUNNING)) ok = 0;
    on_failure(&s);
    printf("第 6 次：burst=%d state=%s（期望 FAILED，限速生效）\n", s.burst, s.st == RUNNING ? "RUNNING" : "FAILED");
    if (!(s.burst == 6 && s.st == FAILED)) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

服务重启限速模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_service.c -o labs/host_service && ./labs/host_service
失败 5 次：burst=5 state=RUNNING（仍 RUNNING）
第 6 次：burst=6 state=FAILED（期望 FAILED，限速生效）
RESULT: PASS
```



连续失败 ≤5 次仍 RUNNING；第 6 次达限速进入 FAILED——重启风暴被约束，问题被暴露。



表 6.2 服务状态



| 状态 | 含义 | 运维动作 |
| --- | --- | --- |
| RUNNING | 运行/自动重启中 | 观察 |
| FAILED | 多次失败被限速 | 查日志/介入 |
| inactive | 未运行 | 按需启动 |
| activating | 启动中 | 等待/超时 |



```zhizhan-anchor
m06-unit
```



```zhizhan-anchor
m06-unit-t
```



## 6.3 写一个 unit



unit 文件要明确：依赖、重启策略与限速、日志去向、运行用户与工作目录（最小权限，见 B09 M08）。



myapp.service 节选systemd

 

```text
[Unit]
Description=edge service
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=/opt/myapp/bin/app --config /etc/myapp.conf
Restart=on-failure
RestartSec=2
StartLimitIntervalSec=30
StartLimitBurst=5
User=myapp

[Install]
WantedBy=multi-user.target
```

托管 \+ 重启限速 \+ 最小权限用户



表 6.3 unit 的正确姿势



| 要点 | 正确做法 | 常见错误 |
| --- | --- | --- |
| 依赖 | After=network-online | 写硬依赖成环 |
| 重启 | on-failure \+ 限速 | 无限重启风暴 |
| 权限 | User= 非 root | root 跑应用 |
| 日志 | journald | 日志不落地 |



```zhizhan-anchor
m06-check
```



```zhizhan-anchor
m06-check-t
```



## 6.4 自检与三路线对照



服务化自检：能否自启、崩溃能否拉起、失败是否可见、日志能否检索。



```zhizhan-anchor
fig-图-6-2
```



**图 6.2**  服务启动阶段耗时（示意）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="服务启动阶段耗时（示意）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">依赖等待</text><rect x="150" y="26" width="180" height="18" rx="4" class="sv-amb-s"></rect><text x="338" y="43" class="sv-lbl-hi">30%</text><text x="12" y="67" class="sv-lbl">进程拉起</text><rect x="150" y="50" width="240" height="18" rx="4" class="sv-cyn-s"></rect><text x="398" y="67" class="sv-lbl-hi">40%</text><text x="12" y="91" class="sv-lbl">健康就绪</text><rect x="150" y="74" width="180" height="18" rx="4" class="sv-grn-s"></rect><text x="338" y="91" class="sv-lbl-hi">30%</text></svg>
```



依赖就绪、进程拉起、健康检查。优化启动要看清哪一段占大头，而不是盲目并发。



表 6.4 三路线托管



| 路线 | init 系统 | 说明 |
| --- | --- | --- |
| Buildroot | busybox init/systemd | 可裁剪 |
| Yocto | systemd | 常用 |
| Debian | systemd | 工具最全 |



```zhizhan-anchor
m06-pitfalls
```



```zhizhan-anchor
m06-pitfalls-t
```



## 6.5 常见误区与排障



失败路径与排障




- **无托管裸跑** ：崩溃无人拉起。

- **无限重启** ：重启风暴耗尽资源。

- **依赖写错** ：网络未就绪就启动后失败。

- **日志不落地** ：现场问题无据可查。



◆ 自测 · Module 06（先答再看）




1. 为什么 Restart 要配 StartLimit？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"否则永久性故障会无限重启，既耗资源又掩盖根因。限速在多次失败后把服务置为 failed，暴露问题。"}
   ```

2. 服务应该用什么用户运行？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"非 root 的最小权限用户（User=）。需要设备访问用 udev 赋权或能力位，而不是整机 root。"}
   ```

3. After=network-online 与 Wants 的区别是什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"After 只定顺序（在网络就绪之后启动），Wants 表示弱依赖（希望网络服务被拉起但不硬失败）。两者常一起用，避免硬依赖成环。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：把你项目的应用写成 systemd unit（依赖/重启限速/非 root/日志），并做一次崩溃自愈验证。



核对与延伸：[Beej 网络编程指南](https://beej.us/guide/bgnet/)

 

动手练习



运行 ` labs/host_service.c `：验证重启限速——连续失败超过阈值进入 failed。



**检查结果：** 连续失败 5 次 burst=5 仍 RUNNING；第 6 次 burst=6 转 FAILED（限速生效）。

 

迁移练习：把本章的“能写 systemd unit（After/Restart/StartLimit）让服务自启、崩溃重启且失败可见。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 06 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b11-m06","criterion":"连续失败 5 次 burst=5 仍 RUNNING；第 6 次 burst=6 转 FAILED（限速生效）。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b11-guide)
