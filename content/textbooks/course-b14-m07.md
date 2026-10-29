# 数据安全与隐私

```zhizhan-anchor
m07
```



数据安全分三层： **传输加密、设备认证、访问控制与最小化** 。设备密钥不能共用、不能硬编码在公开代码里。

 

> 前置：完成 M01（设备身份与注册）。 · ◷ 约 42 分钟 · ◈ 端/边/云三级对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：实现 [TLS](term:tls) 握手要素校验（版本/证书链/主机名/有效期），对合法连接接受、非法连接拒绝。

 

本章速览




- 传输加密 \+ 设备认证 \+ 最小权限。

- 数据最小化采集，密钥可轮换吊销。

- 操作审计可追责。

 

```zhizhan-anchor
m07-layers
```



```zhizhan-anchor
m07-layers-t
```



## 7.1 三层安全与最小化



传输加密（TLS/DTLS）、设备认证（一机一密/证书）、访问控制与最小化。隐私原则是只采必要字段、只留必要时间、只在必要的人可见；密钥用安全存储并支持轮换/吊销。



```zhizhan-anchor
fig-图-7-1
```



**图 7.1**  数据安全的四道防线



```zhizhan-figure
<svg viewBox="0 0 800 160" width="100%" height="160" role="img" aria-label="数据安全的四道防线" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">传输：TLS/DTLS</text><rect x="60" y="64" width="680" height="30" rx="6" class="sv-grn-s"></rect><text x="75" y="83.0" class="sv-lbl-hi">认证：一机一密/证书</text><rect x="60" y="98" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="117.0" class="sv-lbl-hi">访问：最小权限/RBAC</text><rect x="60" y="132" width="680" height="30" rx="6" class="sv-box"></rect><text x="75" y="151.0" class="sv-lbl-hi">隐私：最小化 + 审计</text></svg>
```



传输加密 → 设备认证 → 访问控制（RBAC）→ 隐私最小化 \+ 审计。任一薄弱，整体失守。



表 7.1 安全五层面



| 层面 | 手段 | 风险 |
| --- | --- | --- |
| 传输 | TLS/DTLS | 明文被抓 |
| 认证 | 一机一密/证书 | 伪造设备 |
| 访问 | 最小权限/RBAC | 越权读数据 |
| 隐私 | 脱敏/最小化 | 合规风险 |
| 审计 | 操作日志 | 无法追责 |



tls\_check.c 节选C

 

```text
if (ver < TLS12) return REJECT_VER;
if (!chain_trusted(cert)) return REJECT_CHAIN;
if (!hostname_match(cert,h)) return REJECT_HOST;
if (!valid_now(cert)) return REJECT_EXPIRE;
```

TLS 四校验：版本/证书链/主机名/有效期



```zhizhan-anchor
m07-evidence
```



```zhizhan-anchor
m07-evidence-t
```



## 7.2 真实证据：TLS 握手四校验



下面这段程序校验 TLS 版本、证书链、主机名与有效期：



host\_tls.cC

 

```text
/* host_tls.c —— TLS 握手要素与证书校验流程的最小模型（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_tls.c -o host_tls && ./host_tls
 */
#include <stdio.h>
#include <string.h>
typedef struct {
    const char *ver;            /* 协商版本，如 TLS1.2 / TLS1.3 */
    const char *host;           /* 客户端期望主机名 */
    const char *san;            /* 证书 SAN（此处简化为单个主机名） */
    int chain_ok;               /* 证书链是否可信（1=是） */
    long now;                   /* 当前时刻（秒） */
    long not_before, not_after; /* 证书有效期（秒） */
} tls_t;
/* 返回 0=接受；非 0=拒绝，并给出首个失败项的原因码 */
static int verify(const tls_t *c) {
    if (!(strcmp(c->ver, "TLS1.2") == 0 || strcmp(c->ver, "TLS1.3") == 0)) return 1; /* 版本 ≥1.2 */
    if (!c->chain_ok) return 2;                                                        /* 证书链 */
    if (strcmp(c->host, c->san) != 0) return 3;                                        /* 主机名 */
    if (c->now < c->not_before || c->now > c->not_after) return 4;                     /* 有效期 */
    return 0;
}
int main(void) {
    int ok = 1;
    tls_t good = { "TLS1.3", "api.example.com", "api.example.com", 1, 1000, 900, 2000 };
    tls_t bad_old = { "TLS1.0", "api.example.com", "api.example.com", 1, 1000, 900, 2000 };
    int r1 = verify(&good), r2 = verify(&bad_old);
    printf("合法连接: %s（原因码 %d）\n", r1 == 0 ? "接受" : "拒绝", r1);
    printf("非法连接(TLS1.0): %s（原因码 %d）\n", r2 == 0 ? "接受" : "拒绝", r2);
    if (!(r1 == 0 && r2 == 1)) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

TLS 握手校验模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_tls.c -o labs/host_tls && ./labs/host_tls
合法连接: 接受（原因码 0）
非法连接(TLS1.0): 拒绝（原因码 1）
RESULT: PASS
```



版本≥1.2、证书链可信、主机名匹配、有效期覆盖当前——四项全过才接受；TLS1.0 被拒。



表 7.2 TLS 握手四校验



| 校验项 | 标准 | 失败动作 |
| --- | --- | --- |
| 版本 | ≥ TLS 1.2 | 拒绝 |
| 证书链 | 可信 CA | 拒绝 |
| 主机名 | 与 SAN 匹配 | 拒绝 |
| 有效期 | 覆盖当前时刻 | 拒绝 |



```zhizhan-anchor
m07-key
```



```zhizhan-anchor
m07-key-t
```



## 7.3 密钥与隐私



设备密钥一机一密、存安全存储（SE/TPM/钥匙串），支持轮换与吊销；数据最小化采集与脱敏。



tls\_check.c 节选C

 

```text
if (ver < TLS12)              return REJECT_VER;
if (!chain_trusted(cert))     return REJECT_CHAIN;
if (!hostname_match(cert, h)) return REJECT_HOST;
if (!valid_now(cert))         return REJECT_EXPIRE;
return ACCEPT;   // 四项全过
```

四项全过才接受；任一失败即拒绝（并记原因码）



表 7.3 密钥与隐私要求



| 要求 | 做法 | 原因 |
| --- | --- | --- |
| 一机一密 | 每设备独立凭据 | 限影响面 |
| 安全存储 | SE/TPM/钥匙串 | 防提取 |
| 轮换/吊销 | 生命周期管理 | 泄露可止损 |
| 最小化 | 只采必要字段 | 合规/隐私 |



```zhizhan-anchor
m07-check
```



```zhizhan-anchor
m07-check-t
```



## 7.4 自检与三级对照



安全自检：加密、认证、访问控制、最小化、审计五项齐备。



```zhizhan-anchor
fig-图-7-2
```



**图 7.2**  一次安全接入的校验链



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="一次安全接入的校验链" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">TLS</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">四校验</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">设备认证</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">授权/审计</text></svg>
```



建立 TLS → 校验版本/证书/主机名/有效期 → 认证设备身份 → 按 RBAC 授权 → 记账审计。



表 7.4 三级安全



| 层级 | 安全角色 | 注意 |
| --- | --- | --- |
| 设备端 | 持有凭据/加密 | 安全存储 |
| 边缘网关 | 代理/校验 | 证书/版本 |
| 云平台 | 认证/授权/审计 | RBAC/最小化 |



```zhizhan-anchor
m07-pitfalls
```



```zhizhan-anchor
m07-pitfalls-t
```



## 7.5 常见误区与排障



失败路径与排障




- **明文传输** ：数据被截获。

- **共用密钥** ：一台失守全网风险。

- **过度采集** ：隐私与合规风险。

- **密钥不能吊销** ：泄露后无法止损。



◆ 自测 · Module 07（先答再看）




1. 为什么设备密钥不应“所有设备共用一套”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"一套泄露即全网可伪造；一机一密能把影响限制在单台，且可单独吊销/轮换。"}
   ```

2. TLS 握手要校验哪四项？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"版本（≥1.2）、证书链（可信 CA）、主机名（与 SAN 匹配）、有效期（覆盖当前时刻）。任一失败即拒绝。"}
   ```

3. “数据最小化”指什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"只采集业务必需的字段、只保留必要的时间、只在必要的人可见并可脱敏，以降低隐私与合规风险。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你平台定义认证方式（一机一密/证书）、权限模型（RBAC）与密钥轮换/吊销生命周期。



核对与延伸：[TLS 1.3 (RFC 8446)](https://datatracker.ietf.org/doc/html/rfc8446)

 

动手练习



运行 ` labs/host_tls.c `：校验 TLS 版本、证书链、主机名与有效期。



**检查结果：** TLS 握手四项校验（版本≥1.2/证书链/主机名/有效期）全过则接受，任一失败则拒绝。

 

迁移练习：把本章的“实现 TLS 握手要素校验（版本/证书链/主机名/有效期），对合法连接接受、非法连接拒绝。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 07 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b14-m07","criterion":"TLS 握手四项校验（版本≥1.2/证书链/主机名/有效期）全过则接受，任一失败则拒绝。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b14-guide)
