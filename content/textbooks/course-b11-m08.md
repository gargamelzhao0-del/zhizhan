# 容器与应用 OTA

```zhizhan-anchor
m08
```



应用交付两种： **容器化** （隔离依赖、便于部署）与 **整机 [OTA](term:ota)** （换 rootfs/固件）。两者都要“可失败、可回滚”。

 

> 前置：Module 06 服务化与 Module 07 资源约束。 · ◷ 约 44 分钟 · ◈ 三条构建/部署路线对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能设计“写备用区→校验→切换→确认→失败回滚”的 OTA/容器升级路径。

 

本章速览




- 容器/OTA 都要可失败可回滚。

- 镜像只读、数据放卷/独立目录。

- 灰度先小批量，指标正常再放量。

 

````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm08-routes\n```\n\n\n\n```zhizhan-anchor\nm08-routes-t\n```\n\n\n\n## 8.1 容器 vs 整机 OTA\n\n\n\n容器隔离依赖、便于部署；整机 OTA 换 rootfs/固件、彻底可回滚。两者都要可失败可回滚；容器把可写数据放卷，镜像保持只读。\n\n\n\n```zhizhan-anchor\nfig-图-8-1\n```\n\n\n\n**图 8.1**  容器：只读镜像 \\+ 可写卷\n\n\n\n```zhizhan-figure\n<svg viewBox=\"0 0 800 160\" width=\"100%\" height=\"160\" role=\"img\" aria-label=\"容器：只读镜像 + 可写卷\" preserveAspectRatio=\"xMidYMid meet\"><rect x=\"60\" y=\"30\" width=\"680\" height=\"30\" rx=\"6\" class=\"sv-cyn-s\"></rect><text x=\"75\" y=\"49.0\" class=\"sv-lbl-hi\">只读镜像（可替换/回滚）</text><rect x=\"60\" y=\"64\" width=\"680\" height=\"44\" rx=\"6\" class=\"sv-grn-s\"></rect><text x=\"75\" y=\"90.0\" class=\"sv-lbl-hi\">可写卷（数据，升级不动）</text><rect x=\"60\" y=\"112\" width=\"680\" height=\"30\" rx=\"6\" class=\"sv-amb-s\"></rect><text x=\"75\" y=\"131.0\" class=\"sv-lbl-hi\">运行时（容器）</text><rect x=\"60\" y=\"146\" width=\"680\" height=\"30\" rx=\"6\" class=\"sv-box\"></rect><text x=\"75\" y=\"165.0\" class=\"sv-lbl-hi\">宿主/内核</text></svg>\n```\n\n\n\n镜像只读、可替换；可写数据放卷（或外部存储），升级只换镜像，数据不丢且可回滚。\n\n\n\n表 8.1 交付方式对比\n\n\n\n| 方式 | 优点 | 代价 |\n| --- | --- | --- |\n| 容器 | 依赖隔离、可移植 | 运行时开销、存储 |\n| 只读容器 \\+ 卷 | 可恢复、升级简单 | 需处理持久化 |\n| 应用 OTA | 只更应用 | 需版本兼容 |\n| 整机 A/B OTA | 彻底、可回滚 | 镜像大、需双分区 |\n\n\n\nrollback.sh 节选Shell\n\n \n\n```text\nrauc install app.raucb          # A/B 安装到备用槽\n# 成功后 mark-good；启动自检失败 → 自动回滚旧槽\nrauc status                     # 查询当前槽与状态\n```\n\nA/B 安装 \\+ mark-good \\+ 失败自动回滚"}
````



```zhizhan-anchor
m08-evidence
```



```zhizhan-anchor
m08-evidence-t
```



## 8.2 真实证据：失败可见与回滚



升级的“失败可见”与服务的“重启限速”同源：失败要被限速并暴露，才能触发回滚。下面这段服务模型给出可运行证据：



````zhizhan-details
{"title":"共用程序 · 按需展开完整代码","body":"host\\_service.cC\n\n \n\n```text\n/* host_service.c —— 服务化：崩溃重启与限速（systemd Restart 语义）模型（主机可运行）。\n * 服务反复失败时不能无限重启：StartLimit 在时间窗内限制重启次数，超过进入 failed。\n * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_service.c -o host_service && ./host_service\n */\n#include <stdio.h>\ntypedef enum { RUNNING, FAILED } st_t;\ntypedef struct { int burst; int limit; st_t st; } svc_t;\nstatic void on_failure(svc_t *s) {\n    if (++s->burst > s->limit) s->st = FAILED;          /* 超过限速进入 failed */\n}\nint main(void) {\n    int ok = 1; svc_t s = {0, 5, RUNNING};\n    for (int i = 0; i < 5; i++) on_failure(&s);\n    printf(\"失败 5 次：burst=%d state=%s（仍 RUNNING）\\n\", s.burst, s.st == RUNNING ? \"RUNNING\" : \"FAILED\");\n    if (!(s.burst == 5 && s.st == RUNNING)) ok = 0;\n    on_failure(&s);\n    printf(\"第 6 次：burst=%d state=%s（期望 FAILED，限速生效）\\n\", s.burst, s.st == RUNNING ? \"RUNNING\" : \"FAILED\");\n    if (!(s.burst == 6 && s.st == FAILED)) ok = 0;\n    printf(\"\\n%s\\n\", ok ? \"RESULT: PASS\" : \"RESULT: FAIL\");\n    return ok ? 0 : 1;\n}\n```\n\n失败可见/限速模型（主机 gcc 真实编译运行）"}
````



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_service.c -o labs/host_service && ./labs/host_service
失败 5 次：burst=5 state=RUNNING（仍 RUNNING）
第 6 次：burst=6 state=FAILED（期望 FAILED，限速生效）
RESULT: PASS
```



新版本连续失败被限速并进入 FAILED，是触发“自动回滚”的信号；否则会陷入重启风暴。



表 8.2 OTA 的四个不变式



| OTA 步骤 | 断电后 | 保证 |
| --- | --- | --- |
| 写备用区 | 旧版完好 | 仍可启动 |
| 校验（签名） | 未切换 | 不启半包 |
| 切换\+确认 | 落持久区 | [幂等](term:idempotency) |
| 失败回滚 | 回旧版 | 不变砖 |



```zhizhan-anchor
m08-rollback
```



```zhizhan-anchor
m08-rollback-t
```



## 8.3 回滚与灰度



OTA 要点： **写备用区 → 校验（签名）→ 切换 → 确认 → 失败回滚** 。灰度先小批量、指标正常再放量；容器场景把可写数据放卷，镜像只读。



ota\_boot.c 节选C

 

```text
if (verify_signature(new_img, sig) != OK) { rollback(); return; }
set_boot_slot(SLOT_B);         // 切换启动分区
/* 新固件自检失败 → set_boot_slot(SLOT_A) 回滚
 * 灰度：先 <5% 设备，指标正常再放量 */
```

校验签名 \+ 切换 \+ 自检失败回滚 \+ 灰度放量



表 8.3 升级的四个策略



| 策略 | 做法 | 风险控制 |
| --- | --- | --- |
| A/B 切换 | 写另一侧再切 | 始终有可启动固件 |
| 签名校验 | 验签通过才切 | 防篡改/半包 |
| 灰度 | 小批量先推 | 坏版本影响面小 |
| 回滚 | 启动自检失败回退 | 不变砖 |



```zhizhan-anchor
m08-check
```



```zhizhan-anchor
m08-check-t
```



## 8.4 自检与三路线对照



交付自检：升级可回滚、数据与镜像分离、失败可见、可灰度。



```zhizhan-anchor
fig-图-8-2
```



**图 8.2**  容器/OTA 交付的检查路径



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="容器/OTA 交付的检查路径" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">打包</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">校验</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">部署</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">健康/回滚</text></svg>
```



打包（只读镜像/双分区）→ 校验 → 部署 → 健康检查 → 失败回滚 → 灰度放量。



表 8.4 三路线交付支持



| 路线 | 容器/OTA 支持 | 说明 |
| --- | --- | --- |
| Buildroot | docker/rauc/swupdate | 需集成 |
| Yocto | rauc/OTA 配方 | 标准化 |
| Debian | docker/apt/rauc | 工具最全 |



```zhizhan-anchor
m08-pitfalls
```



```zhizhan-anchor
m08-pitfalls-t
```



## 8.5 常见误区与排障



失败路径与排障




- **无回滚** ：升级失败即事故。

- **只读镜像但数据也放镜像** ：升级丢数据。

- **不做灰度** ：坏版本全量推。

- **不校验签名** ：可被推恶意镜像。



◆ 自测 · Module 08（先答再看）




1. 容器化应用为什么要把可写数据放到“卷”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"镜像应保持只读、可替换；可写数据放卷（或外部存储），升级只换镜像，数据不丢且可回滚。"}
   ```

2. 整机 A/B OTA 为什么需要双分区？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"升级写“另一侧”，当前分区保持可启动；失败时能回滚，保证任意时刻都有可启动的完整固件。"}
   ```

3. 为什么要灰度放量？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"坏版本若全量推送会造成大面积故障。灰度先小批量验证指标，正常再放量，把风险限制在小范围。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你应用设计容器或 OTA 的可回滚交付路径，并做一次“升级中断电 \+ 回滚”演练。



核对与延伸：[systemd 官方文档](https://www.freedesktop.org/software/systemd/man/)

 

动手练习



运行 ` labs/host_service.c `（重启/失败可见模型）；为你的应用设计容器或 OTA 的回滚路径。



**检查结果：** 升级有校验与回滚、失败可见（第 6 次失败转 FAILED）、可写数据与镜像分离。

 

迁移练习：把本章的“能设计“写备用区→校验→切换→确认→失败回滚”的 OTA/容器升级路径。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 08 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b11-m08","criterion":"升级有校验与回滚、失败可见（第 6 次失败转 FAILED）、可写数据与镜像分离。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b11-guide)
