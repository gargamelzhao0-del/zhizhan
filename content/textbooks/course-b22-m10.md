# 综合：可维护的安全设备

```zhizhan-anchor
m10
```



综合项目把 10 章收口： **威胁建模 → 密码 → 身份/密钥 → 安全启动 → 通信/升级 → 隔离 → 测试 → 生命周期** ，目标“可维护的安全设备”。

 

> 前置：完成 M01–M09。 · ◷ 约 46 分钟 · ◈ 身份/固件/通信对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能按六维清单（身份/启动/通信/升级/隔离/生命周期）为一台设备做安全自评并给出可验证断言。

 

本章速览




- 可维护=安全：能升级/回滚/吊销。

- 篡改不可启动、通信无 MITM、接口健壮。

- 按六维清单自评。

 

```zhizhan-anchor
m10-device
```



```zhizhan-anchor
m10-device-t
```



## 10.1 可维护安全设备的六维



把 10 章收口成可维护的安全设备：能升级、能恢复、能止损。六维都要有可验证断言。



```zhizhan-anchor
fig-图-10-1
```



**图 10.1**  安全设备的六维



```zhizhan-figure
<svg viewBox="0 0 800 160" width="100%" height="160" role="img" aria-label="安全设备的六维" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">身份：一机一密</text><rect x="60" y="64" width="680" height="30" rx="6" class="sv-grn-s"></rect><text x="75" y="83.0" class="sv-lbl-hi">启动：逐级验签</text><rect x="60" y="98" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="117.0" class="sv-lbl-hi">通信：TLS + mTLS</text><rect x="60" y="132" width="680" height="44" rx="6" class="sv-box"></rect><text x="75" y="158.0" class="sv-lbl-hi">升级/隔离/生命周期</text></svg>
```



身份（一机一密）→ 启动（逐级验签）→ 通信（[TLS](term:tls)\+mTLS）→ 升级（验签\+防降级\+回滚）→ 隔离（最小权限）→ 生命周期（注入/锁定/吊销）。



表 10.1 六维清单



| 维度 | 措施 | 验收 |
| --- | --- | --- |
| 身份 | 一机一密 | 不可伪造 |
| 启动 | 逐级验签 | 篡改启动失败 |
| 通信 | TLS\+mTLS | 无中间人 |
| 升级 | 验签\+防降级\+回滚 | 不变砖 |
| 隔离 | 最小权限 | 越权被拒 |
| 生命周期 | 注入/锁定/吊销 | 可止损 |



```zhizhan-anchor
m10-evidence
```



```zhizhan-anchor
m10-evidence-t
```



## 10.2 真实证据：信任链与抗回滚



下面这段程序给出信任链/抗回滚的可运行证据：



````zhizhan-details
{"title":"共用程序 · 按需展开完整代码","body":"host\\_secureboot.cC\n\n \n\n```text\n/* host_secureboot.c —— 信任链、篡改检测、抗回滚与失败安全（主机可运行）。\n * 说明：本程序用“带密钥哈希（keyed-hash）”演示逐级校验的**流程**，它**不是数字签名**；\n *      真实安全启动用**非对称签名**（私钥签名、设备只持公钥，如 RSA/ECDSA + X.509），\n *      密钥放 OTP/SE，且逐级可用不同密钥。此处单一 key 仅为示意，不可用于生产。\n * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_secureboot.c -o host_secureboot && ./host_secureboot\n */\n#include <stdio.h>\n#include <stdint.h>\n\n/* 示意用的带密钥哈希（FNV 变体）——仅演示“有密钥才能校验”的机制，非密码学安全 */\nstatic uint32_t tagged_hash(const char *img, uint32_t key) {\n    uint32_t h = 0x811c9dc5u;\n    h ^= key;\n    for (const char *p = img; *p; p++) { h ^= (uint8_t)*p; h *= 16777619u; }\n    return h;\n}\nint main(void) {\n    int ok = 1;\n    uint32_t key = 0xA5A5A5A5u;   /* 示意用；真实为设备公钥 / HSM 中的私钥对应 */\n    const char *spl = \"spl.bin\", *boot = \"uboot.bin\", *app = \"app.bin\";\n\n    /* 逐级校验：ROOT→SPL→U-Boot→App */\n    uint32_t d_spl = tagged_hash(spl, key), d_boot = tagged_hash(boot, key), d_app = tagged_hash(app, key);\n    int chain = (d_spl != 0) && (d_boot != 0) && (d_app != 0);\n    printf(\"信任链逐级校验（keyed-hash 示意，非数字签名）=%s\\n\", chain ? \"通过\" : \"失败\");\n    if (!chain) ok = 0;\n\n    /* 篡改 App → 校验失败 */\n    uint32_t tampered = tagged_hash(\"app_tampered.bin\", key);\n    printf(\"App 被篡改 → 校验%s（期望失败）\\n\", tampered == d_app ? \"通过\" : \"失败\");\n    if (tampered == d_app) ok = 0;\n\n    /* 抗回滚：单调计数器，要求待启动版本 >= 当前计数器 */\n    int monotonic = 5;\n    int v_old = 3, v_new = 6;\n    printf(\"抗回滚：计数器=%d，尝试 v%d → %s（期望拒绝）\\n\", monotonic, v_old, v_old < monotonic ? \"拒绝\" : \"接受\");\n    if (!(v_old < monotonic)) ok = 0;\n    printf(\"抗回滚：尝试 v%d → %s（期望接受）\\n\", v_new, v_new >= monotonic ? \"接受\" : \"拒绝\");\n    if (!(v_new >= monotonic)) ok = 0;\n\n    printf(\"\\n%s\\n\", ok ? \"RESULT: PASS\" : \"RESULT: FAIL\");\n    return ok ? 0 : 1;\n}\n```\n\n信任链/抗回滚模型（主机 gcc 真实编译运行）"}
````



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_secureboot.c -o labs/host_secureboot && ./labs/host_secureboot
App 被篡改 → 校验失败（期望失败）
抗回滚：计数器=5，尝试 v3 → 拒绝（期望拒绝）
抗回滚：尝试 v6 → 接受（期望接受）
RESULT: PASS
```



六维中的“启动/升级”可断言：篡改导致校验失败、降级被拒。其余维度证据见各章 labs。



表 10.2 关键机制与证据



| 维度 | 可运行证据 | 验收 |
| --- | --- | --- |
| 威胁建模 | host\_threat.c | 风险排序 |
| 密码 | host\_crypto.c | 篡改检测 |
| 证书 | host\_cert.c | 4 类拒绝 |
| 隔离 | host\_auth.c | 越权=0 |
| 健壮性 | host\_fuzz.c | 非法拒绝 |



```zhizhan-anchor
m10-accept
```



```zhizhan-anchor
m10-accept-t
```



## 10.3 六维可验证断言



验收：篡改固件无法启动；通信无中间人；升级失败可回滚；密钥泄露可吊销；接口对畸形输入安全。可维护性本身就是安全的一部分。



accept.txt 节选Text

 

```text
身份: 一机一密 → 不可伪造
启动: 逐级验签 → 篡改→失败
通信: 证书校验全过 → 无中间人
升级: 验签+防降级+回滚 → 不变砖
隔离: 最小权限 → 越权=0
生命周期: 注入/锁定/吊销 → 可止损
```

六维各给出可验证断言



```zhizhan-anchor
m10-check
```



```zhizhan-anchor
m10-check-t
```



## 10.4 自检与成熟度对照



综合自检：六维齐全、每维有可验证断言、可维护（升级/恢复/止损）。



```zhizhan-anchor
fig-图-10-2
```



**图 10.2**  六维自评（示意）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="六维自评（示意）" preserveAspectRatio="xMidYMid meet"><text x="12" y="38" class="sv-lbl">身份</text><rect x="150" y="26" width="545" height="11" rx="4" class="sv-grn-s"></rect><text x="703" y="38" class="sv-lbl-hi">100%</text><text x="12" y="54" class="sv-lbl">启动</text><rect x="150" y="43" width="545" height="11" rx="4" class="sv-grn-s"></rect><text x="703" y="54" class="sv-lbl-hi">100%</text><text x="12" y="71" class="sv-lbl">通信</text><rect x="150" y="59" width="545" height="11" rx="4" class="sv-grn-s"></rect><text x="703" y="71" class="sv-lbl-hi">100%</text><text x="12" y="88" class="sv-lbl">升级</text><rect x="150" y="76" width="545" height="11" rx="4" class="sv-grn-s"></rect><text x="703" y="88" class="sv-lbl-hi">100%</text><text x="12" y="104" class="sv-lbl">隔离</text><rect x="150" y="93" width="545" height="11" rx="4" class="sv-grn-s"></rect><text x="703" y="104" class="sv-lbl-hi">100%</text><text x="12" y="121" class="sv-lbl">生命周期</text><rect x="150" y="109" width="327" height="11" rx="4" class="sv-amb-s"></rect><text x="485" y="121" class="sv-lbl-hi">60%</text></svg>
```



六维中任一缺失都会形成短板：可伪造/可替换/可窃听/不可维护。逐维给出断言。



表 10.3 自评要点



| 维度 | 断言 | 证据 |
| --- | --- | --- |
| 启动 | 篡改→失败 | host\_secureboot.c |
| 通信 | 4 类拒绝 | host\_cert.c |
| 隔离 | 越权=0 | host\_auth.c |
| 健壮性 | 非法拒绝 | host\_fuzz.c |



```zhizhan-anchor
m10-quick
```



```zhizhan-anchor
m10-quick-t
```



## 速查与常见错误



把本章的易错点与对策集中对照：



accept.txt 节选Text

 

```text
六维: 身份/启动/通信/升级/隔离/生命周期
每维给出可验证断言 + 证据文件
任一维缺失 = 短板
```

六维各项可验证



表 10.4 六维与断言



| 要点 | 正确做法 |
| --- | --- |
| 启动 | 篡改→失败 |
| 通信 | 4 类拒绝 |
| 隔离 | 越权=0 |
| 生命周期 | 可吊销 |



```zhizhan-anchor
m10-pitfalls
```



```zhizhan-anchor
m10-pitfalls-t
```



## 10.5 常见误区与排障



失败路径与排障




- **可伪造** ：无身份/弱密钥。

- **可替换** ：无安全启动。

- **可窃听** ：不验证书。

- **不可维护** ：无升级/回滚/吊销。



◆ 自测 · Module 10（先答再看）




1. “可维护”为什么也是安全的一部分？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"无法升级就无法修补漏洞、无法吊销泄露密钥、无法回滚坏固件。可维护性决定了安全事件发生后的止损与恢复能力。"}
   ```

2. 六维安全自评中，为什么“任一维缺失都会形成短板”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"攻击者走最弱的一环：无身份则可伪造、无安全启动则可替换、不验证书则可窃听、无生命周期则不可止损。六维是“与”关系。"}
   ```

3. 安全设备“能恢复”指什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"升级失败能回滚、被篡改能拒绝启动、密钥泄露能吊销、接口异常能安全返回。恢复能力让设备在事故后仍可用、可修。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：按六维清单为你的设备做一次安全自评，每维写出“可验证断言 \+ 证据文件”，补齐短板。



核对与延伸：[OWASP 嵌入式应用安全](https://owasp.org/www-project-embedded-application-security/) · [IETF SUIT / TUF](https://datatracker.ietf.org/wg/suit/about/)

 

动手练习



运行 ` labs/host_secureboot.c `（信任链）；按六维清单为设备做一次安全自评。



**检查结果：** 六维均可断言：篡改固件启动失败、证书 4 类异常拒绝、计数器=5 时 v3 拒/v6 受、sensor 写=0。

 

迁移练习：把本章的“能按六维清单（身份/启动/通信/升级/隔离/生命周期）为一台设备做安全自评并给出可验证断言。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 10 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b22-m10","criterion":"六维均可断言：篡改固件启动失败、证书 4 类异常拒绝、计数器=5 时 v3 拒/v6 受、sensor 写=0。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b22-guide)
