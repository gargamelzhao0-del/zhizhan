# 安全启动与硬件信任根

```zhizhan-anchor
m02
```



安全启动从 **不可变的信任根** 开始，逐级验证下一级镜像的签名，任一级失败进入安全态。核心是 **密钥保护** 与 **抗回滚** 。

 

> 前置：了解对称/非对称密码学基本概念；熟悉启动流程与固件镜像结构。 · ◷ 约 44 分钟 · ◈ 成熟度/适配对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能设计信任根到逐级验签的启动链并用 HMAC 验证镜像完整性。

 

本章速览




- 安全启动从不可变信任根开始，逐级验签。

- 密钥放 OTP/SE，单调计数器抗回滚。

- 校验失败进入安全态，不跳过。

 

```zhizhan-anchor
m02-root
```



```zhizhan-anchor
m02-root-t
```



## 2.1 信任根与逐级验签



安全启动从不可变的信任根（ROM/OTP/SE）开始，逐级验证下一级镜像的签名；任一级失败进入安全态。CRC 只防误码，安全启动必须 **验签** 。



```zhizhan-anchor
fig-图-2-1
```



**图 2.1**  信任链逐级验签



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="信任链逐级验签" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">信任根 ROM</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">验 Boot</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">验 App</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">安全态/跳过</text></svg>
```



ROM(信任根) → 验 Bootloader 签名 → 验内核/App 签名 → 任一级失败进安全态。



表 2.1 安全启动五环节



| 环节 | 手段 | 风险 |
| --- | --- | --- |
| 信任根 | ROM/OTP/SE | 被篡改 |
| 验签 | 公钥验签 | 跳过校验 |
| 密钥 | OTP/SE 存储 | 泄露 |
| 抗回滚 | 单调计数器 | 降级攻击 |
| 失败 | 安全态 | 继续跑坏固件 |



secureboot.c 节选C

 

```text
if (verify_sig(stage, pubkey) != OK) enter_safe_state();  // 失败→安全态
if (version < min_version) reject();                       // 抗回滚
/* 密钥存 OTP/SE；CRC 只防误码，安全启动必须验签 */
```

逐级验签 \+ 抗回滚 \+ 失败进安全态



```zhizhan-anchor
m02-evidence
```



```zhizhan-anchor
m02-evidence-t
```



## 2.2 真实证据：MAC 可复现与篡改检测



下面这段程序验证 HMAC 可复现、篡改/错密钥导致校验失败：



host\_crypto.cC

 

```text
/* host_crypto.c —— 密码学工程使用：哈希 + HMAC 链与校验（主机可运行）。
 * 用简化哈希演示：HMAC 用于完整性/认证，哈希链用于防篡改序列。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_crypto.c -o host_crypto && ./host_crypto
 */
#include <stdio.h>
#include <stdint.h>
static uint32_t h(const uint8_t *p, int n, uint32_t seed) { uint32_t x = seed ^ 0x811c9dc5u; for (int i = 0; i < n; i++) { x ^= p[i]; x *= 16777619u; } return x; }
static uint32_t hmachain(uint32_t key, const uint8_t *msg, int n) { uint32_t inner = h(msg, n, key); uint8_t b[4] = { (uint8_t)inner, (uint8_t)(inner>>8), (uint8_t)(inner>>16), (uint8_t)(inner>>24) }; return h(b, 4, key); }
int main(void) {
    int ok = 1;
    uint32_t key = 0xA5A5A5A5u;
    const uint8_t m1[] = "firmware";
    uint32_t mac1 = hmachain(key, m1, 8), mac2 = hmachain(key, m1, 8);
    printf("HMAC 可复现=%d\n", mac1 == mac2);
    if (mac1 != mac2) ok = 0;
    uint8_t bad[] = "firmwarE";   /* 改一个字节 */
    uint32_t mac3 = hmachain(key, bad, 8);
    printf("篡改后 MAC 变化=%d（期望 1）\n", mac1 != mac3);
    if (mac1 == mac3) ok = 0;
    uint32_t wrongkey = hmachain(0x5A5A5A5Au, m1, 8);
    printf("错误密钥 MAC 不同=%d（期望 1）\n", mac1 != wrongkey);
    if (mac1 == wrongkey) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

HMAC 完整性模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_crypto.c -o labs/host_crypto && ./labs/host_crypto
HMAC 可复现=1
篡改后 MAC 变化=1（期望 1）
错误密钥 MAC 不同=1（期望 1）
RESULT: PASS
```



相同输入 MAC 可复现；改一个字节 MAC 就变；密钥错 MAC 不同——完整性 \+ 认证。



表 2.2 完整性手段对比



| 校验方式 | 防误码 | 防篡改 | 说明 |
| --- | --- | --- | --- |
| CRC/校验和 | 是 | 否 | 公开算法可重算 |
| HMAC | 是 | 是 | 需密钥 |
| 签名验签 | 是 | 是 | 需私钥，防伪造 |
| 单调计数器 | — | 防降级 | 配合版本 |



```zhizhan-anchor
m02-key
```



```zhizhan-anchor
m02-key-t
```



## 2.3 密钥保护与抗回滚



密钥放 OTP/SE，一次泄露全废；用单调计数器防降级到有漏洞的旧版本；验证失败的默认动作是进入安全态而不是跳过。



secureboot.c 节选C

 

```text
if (verify_sig(stage, pubkey) != OK) enter_safe_state();  // 失败→安全态
if (version < min_version) reject();                       // 抗回滚
/* 密钥存 OTP/SE；私钥不出安全域 */
```

验签失败进安全态；单调计数器抗回滚



表 2.3 密钥与抗回滚



| 风险 | 对策 | 避免 |
| --- | --- | --- |
| 用 CRC 当安全 | 改用签名 | 可伪造 |
| 密钥硬编码 | OTP/SE | 一次泄露全废 |
| 可降级 | 单调计数器 | 旧漏洞复活 |
| 校验失败跳过 | 进安全态 | 形同虚设 |



```zhizhan-anchor
m02-check
```



```zhizhan-anchor
m02-check-t
```



## 2.4 自检与成熟度对照



安全启动自检：信任根不可变、逐级验签、密钥保护、抗回滚、失败安全。



```zhizhan-anchor
fig-图-2-2
```



**图 2.2**  失败路径



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="失败路径" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">验签/版本</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">失败?</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">安全态</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">记录</text></svg>
```



任一级验签/版本检查失败 → 不启动该级 → 进入安全态（或回滚到可信版本）。



表 2.4 成熟度对照



| 成熟度 | 含义 | 策略 |
| --- | --- | --- |
| 当下可用 | 芯片带 ROM 验签 | 直接启用 |
| 成长期 | 需外挂 SE | 集成 SE |
| 观察期 | 能力缺失 | 不用于安全产品 |



```zhizhan-anchor
m02-pitfalls
```



```zhizhan-anchor
m02-pitfalls-t
```



## 2.5 常见误区与排障



失败路径与排障




- **用 CRC 当安全** ：可伪造。

- **密钥硬编码** ：一次泄露全废。

- **无抗回滚** ：可降级到有漏洞版本。

- **校验失败跳过** ：安全启动形同虚设。



◆ 自测 · Module 02（先答再看）




1. 为什么安全启动必须“验签”而不是“校验和”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"校验和/CRC 是公开算法，攻击者可改数据同时改校验值；只有用私钥签名、公钥验签，攻击者没有私钥就无法伪造。"}
   ```

2. “抗回滚”靠什么实现？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"单调计数器（配合版本号）。它记录已接受的最低版本，阻止降级到有漏洞的旧固件。"}
   ```

3. 验签失败的默认动作应该是什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"进入安全态（不启动该级/回滚到可信版本）并记录。跳过校验等于安全启动形同虚设。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你设备的启动链设计信任根→逐级验签，并加单调计数器抗回滚与失败安全态。



核对与延伸：[MCUboot 设计](https://docs.mcuboot.com/design.html)

 

动手练习



运行 ` labs/host_crypto.c `：验证 MAC 可复现、篡改/错密钥导致校验失败。



**检查结果：** 相同输入 MAC 可复现=1；篡改后变化=1、错误密钥不同=1，校验失败。

 

迁移练习：把本章的“能设计信任根到逐级验签的启动链并用 HMAC 验证镜像完整性。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 02 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b15-m02","criterion":"相同输入 MAC 可复现=1；篡改后变化=1、错误密钥不同=1，校验失败。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b15-guide)
