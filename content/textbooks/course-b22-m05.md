# 通信安全与证书验证

```zhizhan-anchor
m05
```



通信安全要防 **窃听与中间人** ：用 [TLS](term:tls)/DTLS 建安全通道，并 **严格验证证书链、主机名与时间** 。

 

> 前置：了解 TCP 连通与 TLS 握手、证书/CA 的基本概念。 · ◷ 约 44 分钟 · ◈ 身份/固件/通信对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能开启证书链/有效期/主机名/吊销四项校验，并判断何种情况必须拒绝连接。

 

本章速览




- 通信用 TLS/DTLS 并严格验证证书链/主机名/时间。

- 高安全用 mTLS 双向认证。

- 不验证书=给中间人开门。

 

```zhizhan-anchor
m05-tls
```



```zhizhan-anchor
m05-tls-t
```



## 5.1 证书校验四要素



通信安全要防窃听与中间人：用 TLS/DTLS，并严格验证证书链、主机名与时间；高安全场景用 mTLS 双向认证。



```zhizhan-anchor
fig-图-5-1
```



**图 5.1**  证书校验流程



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="证书校验流程" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">TLS</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">证书链</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">有效期</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">主机名/吊销</text></svg>
```



建 TLS → 验证书链到受信根 → 验有效期 → 验主机名 → 验吊销 → 通过/拒绝。



表 5.1 通信安全五要素



| 要素 | 作用 | 坑 |
| --- | --- | --- |
| TLS/DTLS | 加密\+完整性 | 旧版本/弱套件 |
| 证书链 | 身份认证 | 不验证=可中间人 |
| 主机名 | 绑定身份 | 不校验可冒充 |
| 时间 | 证书有效期 | 时间不对校验失败 |
| mTLS | 双向认证 | 只验服务端不够 |



```zhizhan-anchor
m05-evidence
```



```zhizhan-anchor
m05-evidence-t
```



## 5.2 真实证据：证书校验判定



下面这段程序演示证书校验的判定流程：



host\_cert.cC

 

```text
/* host_cert.c —— 证书校验流程模型：链 / 有效期 / 主机名 / 吊销（主机可运行）。
 * 说明：本程序只演示 TLS 证书校验的**判定流程与顺序**（用固定测试向量），
 *      不做任何密码学运算，也不解析真实 X.509；真实校验请用 mbedTLS/OpenSSL 等成熟库
 *      并**开启全部检查**（链、有效期、主机名、吊销），绝不可在代码里关闭校验。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_cert.c -o host_cert && ./host_cert
 */
#include <stdio.h>
#include <string.h>
typedef struct {
    const char *label;
    const char *cert_host;   /* 证书里的 CN/SAN */
    const char *conn_host;   /* 实际连接的主机名 */
    long now;                /* 设备当前时间（UNIX 秒） */
    int revoked;             /* 是否在吊销列表 */
    int chain_ok;            /* 证书链能否到受信根 */
    int expect_ok;           /* 期望结果 */
} case_t;
static int verify(const case_t *c, long nb, long na) {
    if (!c->chain_ok) return 0;                       /* 1) 链到受信根 */
    if (c->now < nb || c->now > na) return 0;         /* 2) 有效期（依赖正确的设备时间） */
    if (strcmp(c->cert_host, c->conn_host) != 0) return 0; /* 3) 主机名匹配 */
    if (c->revoked) return 0;                         /* 4) 吊销检查 */
    return 1;
}
int main(void) {
    int ok = 1;
    long nb = 1600000000L, na = 1800000000L;
    case_t cs[] = {
        {"正常",       "api.example.com", "api.example.com", 1700000000L, 0, 1, 1},
        {"链不可信",   "api.example.com", "api.example.com", 1700000000L, 0, 0, 0},
        {"已过期",     "api.example.com", "api.example.com", 1900000000L, 0, 1, 0},
        {"主机名不符", "api.example.com", "evil.example.com", 1700000000L, 0, 1, 0},
        {"已吊销",     "api.example.com", "api.example.com", 1700000000L, 1, 1, 0},
    };
    for (unsigned i = 0; i < sizeof(cs)/sizeof(cs[0]); i++) {
        int r = verify(&cs[i], nb, na);
        printf("%-10s → %s（期望 %s）\n", cs[i].label, r ? "接受" : "拒绝", cs[i].expect_ok ? "接受" : "拒绝");
        if (r != cs[i].expect_ok) ok = 0;
    }
    printf("结论：“关闭证书验证”= 给中间人开门；设备时间错也会导致有效期校验失败\n");
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

证书校验流程模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_cert.c -o labs/host_cert && ./labs/host_cert
正常     → 接受（期望 接受）
链不可信 → 拒绝（期望 拒绝）
已过期  → 拒绝（期望 拒绝）
主机名不符 → 拒绝（期望 拒绝）
已吊销  → 拒绝（期望 拒绝）
RESULT: PASS
```



仅“正常”接受；链不可信/已过期/主机名不符/已吊销 4 例拒绝。程序只演示判定流程，不含密码学运算。



表 5.2 校验向量



| 向量 | 判定 | 原因 |
| --- | --- | --- |
| 正常 | 接受 | 全过 |
| 链不可信 | 拒绝 | 无受信根 |
| 已过期 | 拒绝 | 时间超期 |
| 主机名不符 | 拒绝 | 冒充 |
| 已吊销 | 拒绝 | 被撤 |



```zhizhan-anchor
m05-auth
```



```zhizhan-anchor
m05-auth-t
```



## 5.3 凭证校验与身份/权限



“不验证证书”=给中间人开门；设备时间要正确，否则有效期校验出错；高安全场景用 mTLS。



cert.c 节选C

 

```text
if (!chain_trusted(c)) return REJECT_CHAIN;
if (!valid_now(c))     return REJECT_EXPIRE;
if (!hostname_match(c, h)) return REJECT_HOST;
if (revoked(c))        return REJECT_REVOKED;
```

四项校验全过才接受；真实库需开启全部检查



```zhizhan-anchor
m05-check
```



```zhizhan-anchor
m05-check-t
```



## 5.4 自检与成熟度对照



通信自检：证书链/有效期/主机名/吊销全验、时间正确、必要时 mTLS。



```zhizhan-anchor
fig-图-5-2
```



**图 5.2**  证书校验向量（真实值）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="证书校验向量（真实值）" preserveAspectRatio="xMidYMid meet"><text x="12" y="40" class="sv-lbl">正常</text><rect x="150" y="26" width="300" height="14" rx="4" class="sv-grn-s"></rect><text x="458" y="40" class="sv-lbl-hi">1(接受=1)</text><text x="12" y="60" class="sv-lbl">链不可信</text><rect x="150" y="46" width="2" height="14" rx="4" class="sv-red-s"></rect><text x="160" y="60" class="sv-lbl-hi">0(接受=1)</text><text x="12" y="80" class="sv-lbl">过期</text><rect x="150" y="66" width="2" height="14" rx="4" class="sv-red-s"></rect><text x="160" y="80" class="sv-lbl-hi">0(接受=1)</text><text x="12" y="100" class="sv-lbl">主机名</text><rect x="150" y="86" width="2" height="14" rx="4" class="sv-red-s"></rect><text x="160" y="100" class="sv-lbl-hi">0(接受=1)</text><text x="12" y="120" class="sv-lbl">吊销</text><rect x="150" y="106" width="2" height="14" rx="4" class="sv-red-s"></rect><text x="160" y="120" class="sv-lbl-hi">0(接受=1)</text></svg>
```



5 个向量中仅“正常”接受（=1），其余 4 例拒绝（=0）。



表 5.3 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 证书链 | 到受信根 | 跳过 |
| 有效期 | 时间正确 | 设备时间错 |
| 主机名 | 匹配 | 不校验 |
| 吊销 | 黑名单 | 不查 |



```zhizhan-anchor
m05-quick
```



```zhizhan-anchor
m05-quick-t
```



## 速查与常见错误



把本章的易错点与对策集中对照：



cert.c 节选C

 

```text
if (!chain_trusted(c)) return REJECT_CHAIN;
if (!valid_now(c))     return REJECT_EXPIRE;
if (!hostname_match(c,h)) return REJECT_HOST;
```

证书链/有效期/主机名全验



表 5.4 证书校验项



| 要点 | 正确做法 |
| --- | --- |
| 证书链 | 到受信根 |
| 有效期 | 时间正确 |
| 主机名 | 匹配 |
| 吊销状态 | 不在黑名单 |



```zhizhan-anchor
m05-pitfalls
```



```zhizhan-anchor
m05-pitfalls-t
```



## 5.5 常见误区与排障



失败路径与排障




- **跳过证书验证** ：中间人攻击。

- **不校验主机名** ：证书被复用。

- **设备时间错** ：有效期内也失败。

- **弱套件/旧版本** ：可被攻破。



◆ 自测 · Module 05（先答再看）




1. 为什么“关闭证书验证”很危险？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"不验证证书就无法确认对端身份，攻击者可冒充服务器实施中间人攻击，加密通道形同虚设。生产环境绝不可关闭。"}
   ```

2. 为什么设备时间要正确？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"证书有效期基于时间校验。设备时间错（如没同步 NTP）会导致有效期判断错误，正常证书也被拒绝、或过期证书被误信。"}
   ```

3. 什么场景需要 mTLS（双向认证）？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"既要验证服务器、也要服务器验证设备身份时（如高安全 IoT）。只验服务端不足以阻止伪造设备接入。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你设备通信开启证书链/有效期/主机名/吊销四项校验（确保时间正确），高安全场景启用 mTLS。



核对与延伸：[TLS 1.3 (RFC 8446)](https://datatracker.ietf.org/doc/html/rfc8446)

 

动手练习



运行 ` labs/host_cert.c ` 与 ` labs/host_auth.c ` 验证证书校验流程与权限。



**检查结果：** 5 个测试向量仅“正常”接受=1；“链不可信/已过期/主机名不符/已吊销”4 例拒绝=0。

 

迁移练习：把本章的“能开启证书链/有效期/主机名/吊销四项校验，并判断何种情况必须拒绝连接。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 05 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b22-m05","criterion":"5 个测试向量仅“正常”接受=1；“链不可信/已过期/主机名不符/已吊销”4 例拒绝=0。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b22-guide)
