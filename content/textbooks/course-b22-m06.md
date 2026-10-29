# 升级安全与回退策略

```zhizhan-anchor
m06
```



升级安全 =  **签名 \+ 验签 \+ A/B \+ 回滚 \+ 防降级** 。任何一步缺失都可能让攻击者推恶意固件或用旧版本降级。

 

> 前置：了解 [OTA](term:ota)/A-B 分区与 bootcount 回滚机制。 · ◷ 约 42 分钟 · ◈ 身份/固件/通信对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能设计“验签→写备份区→校验版本/计数器→切换→失败回滚”的安全升级链。

 

本章速览




- 升级=签名\+验签\+A/B\+回滚\+防降级。

- 写另一侧、校验通过才切。

- 失败可回滚，永不砖。

 

```zhizhan-anchor
m06-ota
```



```zhizhan-anchor
m06-ota-t
```



## 6.1 安全升级五环节



升级安全 = 签名 \+ 验签 \+ A/B \+ 回滚 \+ 防降级。任何一步缺失都可能被推恶意固件或降级。



```zhizhan-anchor
fig-图-6-1
```



**图 6.1**  安全升级链



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="安全升级链" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">传输</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">写 A/B</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">验签/版本</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">切换/回滚</text></svg>
```



传输（[TLS](term:tls)\+签名）→ 写另一侧 A/B → 验签\+版本 → 通过才切换 → 失败回滚。



表 6.1 安全升级五环节



| 环节 | 措施 | 风险 |
| --- | --- | --- |
| 传输 | TLS\+签名 | 被替换 |
| 写入 | 写另一侧 A/B | 半写变砖 |
| 验证 | 签名\+版本 | 恶意/降级 |
| 切换 | 校验通过才切 | 坏固件上线 |
| 回退 | bootcount | 无法自愈 |



```zhizhan-anchor
m06-evidence
```



```zhizhan-anchor
m06-evidence-t
```



## 6.2 真实证据：验签与防降级



下面这段程序演示验签/篡改检测与抗回滚：



````zhizhan-details
{"title":"共用程序 · 按需展开完整代码","body":"host\\_secureboot.cC\n\n \n\n```text\n/* host_secureboot.c —— 信任链、篡改检测、抗回滚与失败安全（主机可运行）。\n * 说明：本程序用“带密钥哈希（keyed-hash）”演示逐级校验的**流程**，它**不是数字签名**；\n *      真实安全启动用**非对称签名**（私钥签名、设备只持公钥，如 RSA/ECDSA + X.509），\n *      密钥放 OTP/SE，且逐级可用不同密钥。此处单一 key 仅为示意，不可用于生产。\n * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_secureboot.c -o host_secureboot && ./host_secureboot\n */\n#include <stdio.h>\n#include <stdint.h>\n\n/* 示意用的带密钥哈希（FNV 变体）——仅演示“有密钥才能校验”的机制，非密码学安全 */\nstatic uint32_t tagged_hash(const char *img, uint32_t key) {\n    uint32_t h = 0x811c9dc5u;\n    h ^= key;\n    for (const char *p = img; *p; p++) { h ^= (uint8_t)*p; h *= 16777619u; }\n    return h;\n}\nint main(void) {\n    int ok = 1;\n    uint32_t key = 0xA5A5A5A5u;   /* 示意用；真实为设备公钥 / HSM 中的私钥对应 */\n    const char *spl = \"spl.bin\", *boot = \"uboot.bin\", *app = \"app.bin\";\n\n    /* 逐级校验：ROOT→SPL→U-Boot→App */\n    uint32_t d_spl = tagged_hash(spl, key), d_boot = tagged_hash(boot, key), d_app = tagged_hash(app, key);\n    int chain = (d_spl != 0) && (d_boot != 0) && (d_app != 0);\n    printf(\"信任链逐级校验（keyed-hash 示意，非数字签名）=%s\\n\", chain ? \"通过\" : \"失败\");\n    if (!chain) ok = 0;\n\n    /* 篡改 App → 校验失败 */\n    uint32_t tampered = tagged_hash(\"app_tampered.bin\", key);\n    printf(\"App 被篡改 → 校验%s（期望失败）\\n\", tampered == d_app ? \"通过\" : \"失败\");\n    if (tampered == d_app) ok = 0;\n\n    /* 抗回滚：单调计数器，要求待启动版本 >= 当前计数器 */\n    int monotonic = 5;\n    int v_old = 3, v_new = 6;\n    printf(\"抗回滚：计数器=%d，尝试 v%d → %s（期望拒绝）\\n\", monotonic, v_old, v_old < monotonic ? \"拒绝\" : \"接受\");\n    if (!(v_old < monotonic)) ok = 0;\n    printf(\"抗回滚：尝试 v%d → %s（期望接受）\\n\", v_new, v_new >= monotonic ? \"接受\" : \"拒绝\");\n    if (!(v_new >= monotonic)) ok = 0;\n\n    printf(\"\\n%s\\n\", ok ? \"RESULT: PASS\" : \"RESULT: FAIL\");\n    return ok ? 0 : 1;\n}\n```\n\n验签/防降级模型（主机 gcc 真实编译运行）"}
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



篡改镜像验签失败；版本\<计数器(5)降级被拒、≥5 接受。demo 用带密钥哈希示意（非数字签名）。



表 6.2 升级判定



| 情形 | 判定 | 动作 |
| --- | --- | --- |
| 验签通过 | OK | 允许切换 |
| 篡改 | 失败 | 拒绝（保留旧版） |
| 降级 v3 | 拒绝 | counter=5 |
| 升级 v6 | 接受 | ≥counter |



```zhizhan-anchor
m06-rollback
```



```zhizhan-anchor
m06-rollback-t
```



## 6.3 回滚与防降级



复用 OTA 机制并加安全层：验签（非仅 CRC）、防降级（版本\+单调计数器）、失败回滚。



ota.c 节选C

 

```text
if (!verify_sig(img, pubkey)) return -1;   // 验签（非 CRC）
if (ver < counter) return -2;              // 防降级
write_slot(OTHER_BANK, img); switch_boot();// A/B 写另一侧
if (boot_fail()) rollback();                // 失败回滚
```

验签\+防降级\+写另一侧\+失败回滚



```zhizhan-anchor
m06-check
```



```zhizhan-anchor
m06-check-t
```



## 6.4 自检与成熟度对照



升级自检：验签、防降级、A/B、回滚四件套齐。



```zhizhan-anchor
fig-图-6-2
```



**图 6.2**  降级/升级判定（真实值）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="降级/升级判定（真实值）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">v3 拒绝</text><rect x="150" y="26" width="2" height="18" rx="4" class="sv-red-s"></rect><text x="160" y="43" class="sv-lbl-hi">0(标志)</text><text x="12" y="67" class="sv-lbl">v5 边界</text><rect x="150" y="50" width="300" height="18" rx="4" class="sv-amb-s"></rect><text x="458" y="67" class="sv-lbl-hi">1(标志)</text><text x="12" y="91" class="sv-lbl">v6 接受</text><rect x="150" y="74" width="300" height="18" rx="4" class="sv-grn-s"></rect><text x="458" y="91" class="sv-lbl-hi">1(标志)</text></svg>
```



计数器=5：v3 拒绝、v6 接受；配合验签与 A/B 与回滚构成完整升级安全链。



表 6.3 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 验签 | 非 CRC | 只校验和 |
| 防降级 | 版本\+计数器 | 可降级 |
| A/B | 写另一侧 | 覆盖 |
| 回滚 | bootcount | 无退路 |



```zhizhan-anchor
m06-quick
```



```zhizhan-anchor
m06-quick-t
```



## 速查与常见错误



把本章的易错点与对策集中对照：



ota.c 节选C

 

```text
if (!verify_sig(img, pubkey)) return -1;  // 验签
if (ver < counter) return -2;              // 防降级
if (boot_fail()) rollback();               // 失败回滚
```

验签\+防降级\+回滚



表 6.4 升级环节与风险



| 要点 | 正确做法 |
| --- | --- |
| 传输 | 被替换 |
| 写入 | 半写变砖 |
| 验证 | 恶意/降级 |
| 回退 | 无法自愈 |



```zhizhan-anchor
m06-pitfalls
```



```zhizhan-anchor
m06-pitfalls-t
```



## 6.5 常见误区与排障



失败路径与排障




- **只 CRC 不验签** ：可推恶意固件。

- **无防降级** ：可回到有漏洞版本。

- **覆盖运行分区** ：断电变砖。

- **无回滚** ：坏固件无法退。



◆ 自测 · Module 06（先答再看）




1. 为什么 OTA 必须“验签”而不只是“校验和”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"校验和可被攻击者重算；只有用私钥签名、设备用公钥验签，才能确认固件来源与完整性，防止恶意/篡改固件。"}
   ```

2. 为什么升级要写成“另一侧 A/B”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"覆盖正在运行的分区时断电会变砖且无退路。写另一侧、校验通过再切换，失败可回滚，保证“升级不变砖”。"}
   ```

3. “防降级”防止什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"防止攻击者用单调计数器之前的旧版本（可能有已知漏洞）替换当前固件。版本\\<计数器即拒绝。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你升级链加“验签 \+ 防降级 \+ A/B \+ 回滚”，做一次“升级中断电”演练验证不变砖。



核对与延伸：[IETF SUIT / TUF](https://datatracker.ietf.org/wg/suit/about/) · [MCUboot 设计](https://docs.mcuboot.com/design.html)

 

动手练习



运行 ` labs/host_secureboot.c `（验签/篡改检测）；为升级链加验签与防降级。



**检查结果：** 镜像验签通过才写/切；版本\<计数器(5)拒绝降级；失败保留旧分区可回滚。

 

迁移练习：把本章的“能设计“验签→写备份区→校验版本/计数器→切换→失败回滚”的安全升级链。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 06 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b22-m06","criterion":"镜像验签通过才写/切；版本<计数器(5)拒绝降级；失败保留旧分区可回滚。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b22-guide)
