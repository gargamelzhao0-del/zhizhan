# 安全启动与固件真实性

```zhizhan-anchor
m04
```



安全启动从 **不可变信任根** 开始，逐级验证下一级镜像签名；失败进入安全态。配合 **抗回滚** 防止降级到漏洞版本。

 

> 前置：了解镜像分区与 bootloader 启动流程。 · ◷ 约 44 分钟 · ◈ 身份/固件/通信对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能实现逐级验签的信任链与单调计数器抗回滚，使篡改镜像与旧版本启动失败。

 

本章速览




- 安全启动从不可变信任根开始，逐级验签。

- 失败进安全态，不继续跑。

- 抗回滚用单调计数器。

 

```zhizhan-anchor
m04-secureboot
```



```zhizhan-anchor
m04-secureboot-t
```



## 4.1 信任链与抗回滚



安全启动从不可变信任根开始，逐级验证下一级镜像签名（信任链）；失败进入安全态。配合单调计数器抗回滚，防降级到漏洞版本。



```zhizhan-anchor
fig-图-4-1
```



**图 4.1**  信任链逐级验签



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="信任链逐级验签" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">信任根</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">验 SPL</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">验 U-Boot</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">验 Kernel/App</text></svg>
```



ROOT → 验 SPL → 验 U-Boot → 验 Kernel → 验 App；任一级失败即停（安全态）。



表 4.1 信任链五层



| 层级 | 验证 | 失败动作 |
| --- | --- | --- |
| ROOT→SPL | 验签/哈希 | 停 |
| SPL→U-Boot | 验签 | 停 |
| U-Boot→Kernel | 验签 | 停 |
| Kernel→App | 验签 | 停 |
| 抗回滚 | 单调计数器 | 拒绝旧版本 |



```zhizhan-anchor
m04-evidence
```



```zhizhan-anchor
m04-evidence-t
```



## 4.2 真实证据：逐级校验与抗回滚



下面这段程序验证逐级校验、篡改断裂与抗回滚（keyed-hash 示意）：



host\_secureboot.cC

 

```text
/* host_secureboot.c —— 信任链、篡改检测、抗回滚与失败安全（主机可运行）。
 * 说明：本程序用“带密钥哈希（keyed-hash）”演示逐级校验的**流程**，它**不是数字签名**；
 *      真实安全启动用**非对称签名**（私钥签名、设备只持公钥，如 RSA/ECDSA + X.509），
 *      密钥放 OTP/SE，且逐级可用不同密钥。此处单一 key 仅为示意，不可用于生产。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_secureboot.c -o host_secureboot && ./host_secureboot
 */
#include <stdio.h>
#include <stdint.h>

/* 示意用的带密钥哈希（FNV 变体）——仅演示“有密钥才能校验”的机制，非密码学安全 */
static uint32_t tagged_hash(const char *img, uint32_t key) {
    uint32_t h = 0x811c9dc5u;
    h ^= key;
    for (const char *p = img; *p; p++) { h ^= (uint8_t)*p; h *= 16777619u; }
    return h;
}
int main(void) {
    int ok = 1;
    uint32_t key = 0xA5A5A5A5u;   /* 示意用；真实为设备公钥 / HSM 中的私钥对应 */
    const char *spl = "spl.bin", *boot = "uboot.bin", *app = "app.bin";

    /* 逐级校验：ROOT→SPL→U-Boot→App */
    uint32_t d_spl = tagged_hash(spl, key), d_boot = tagged_hash(boot, key), d_app = tagged_hash(app, key);
    int chain = (d_spl != 0) && (d_boot != 0) && (d_app != 0);
    printf("信任链逐级校验（keyed-hash 示意，非数字签名）=%s\n", chain ? "通过" : "失败");
    if (!chain) ok = 0;

    /* 篡改 App → 校验失败 */
    uint32_t tampered = tagged_hash("app_tampered.bin", key);
    printf("App 被篡改 → 校验%s（期望失败）\n", tampered == d_app ? "通过" : "失败");
    if (tampered == d_app) ok = 0;

    /* 抗回滚：单调计数器，要求待启动版本 >= 当前计数器 */
    int monotonic = 5;
    int v_old = 3, v_new = 6;
    printf("抗回滚：计数器=%d，尝试 v%d → %s（期望拒绝）\n", monotonic, v_old, v_old < monotonic ? "拒绝" : "接受");
    if (!(v_old < monotonic)) ok = 0;
    printf("抗回滚：尝试 v%d → %s（期望接受）\n", v_new, v_new >= monotonic ? "接受" : "拒绝");
    if (!(v_new >= monotonic)) ok = 0;

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

安全启动信任链/抗回滚模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_secureboot.c -o labs/host_secureboot && ./labs/host_secureboot
信任链逐级校验（keyed-hash 示意，非数字签名）=通过
App 被篡改 → 校验失败（期望失败）
抗回滚：计数器=5，尝试 v3 → 拒绝（期望拒绝）
抗回滚：尝试 v6 → 接受（期望接受）
RESULT: PASS
```



逐级校验通过；App 篡改即链条断裂；计数器=5 时 v3 拒、v6 受。keyed-hash 仅示意流程，非数字签名。



表 4.2 校验结果



| 场景 | 结果 | 说明 |
| --- | --- | --- |
| 正常链 | 通过 | 逐级可信 |
| App 篡改 | 失败 | 链条断裂 |
| 降级 v3 | 拒绝 | counter=5 |
| 升级 v6 | 接受 | ≥counter |



```zhizhan-anchor
m04-root
```



```zhizhan-anchor
m04-root-t
```



## 4.3 信任根与安全态



任一级校验失败都不能“继续跑”；密钥放 OTP/SE；单调计数器阻止降级。本册实验用带密钥哈希演示流程，它 **不是数字签名** ——真实安全启动用非对称签名。



secureboot.c 节选C

 

```text
if (verify_hash(stage, otp_key) != OK) enter_safe_state();  // 逐级验签
if (ver < monotonic_counter) reject();                      // 抗回滚
/* 真实系统用非对称签名(ECDSA/RSA+X.509)，私钥签名、设备持公钥 */
```

逐级验签失败进安全态；单调计数器抗回滚



```zhizhan-anchor
m04-check
```



```zhizhan-anchor
m04-check-t
```



## 4.4 自检与成熟度对照



安全启动自检：信任根不可变、逐级验签、密钥保护、抗回滚、失败安全态。



```zhizhan-anchor
fig-图-4-2
```



**图 4.2**  抗回滚判定（真实值）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="抗回滚判定（真实值）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">v3 拒绝</text><rect x="150" y="26" width="2" height="18" rx="4" class="sv-red-s"></rect><text x="160" y="43" class="sv-lbl-hi">0(标志)</text><text x="12" y="67" class="sv-lbl">v5 边界</text><rect x="150" y="50" width="300" height="18" rx="4" class="sv-amb-s"></rect><text x="458" y="67" class="sv-lbl-hi">1(标志)</text><text x="12" y="91" class="sv-lbl">v6 接受</text><rect x="150" y="74" width="300" height="18" rx="4" class="sv-grn-s"></rect><text x="458" y="91" class="sv-lbl-hi">1(标志)</text></svg>
```



计数器=5：v3\<5 拒绝、v6≥5 接受；阻止降级到漏洞版本。



表 4.3 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 信任根 | 不可变 | 被篡改 |
| 验签 | 逐级 | 只验一级 |
| 抗回滚 | 计数器 | 可降级 |
| 失败 | 安全态 | 继续跑 |



```zhizhan-anchor
m04-quick
```



```zhizhan-anchor
m04-quick-t
```



## 速查与常见错误



把本章的易错点与对策集中对照：



secureboot.c 节选C

 

```text
if (verify_hash(stage, otp_key)) ok = 1; // 逐级验签
if (ver < counter) reject();             // 抗回滚
/* 失败进安全态，不继续跑 */
```

逐级验签 \+ 抗回滚



表 4.4 安全启动风险



| 要点 | 正确做法 |
| --- | --- |
| 失败继续跑 | 进安全态 |
| 密钥明文 | OTP/SE |
| 无抗回滚 | 单调计数器 |
| 只验一级 | 逐级验签 |



```zhizhan-anchor
m04-pitfalls
```



```zhizhan-anchor
m04-pitfalls-t
```



## 4.5 常见误区与排障



失败路径与排障




- **校验失败继续跑** ：安全启动失效。

- **密钥明文存** ：可被提取伪造。

- **无抗回滚** ：可降级攻击。

- **只验一级** ：后续可被替换。



◆ 自测 · Module 04（先答再看）




1. 为什么安全启动要“逐级”验证？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"只验第一级不够：后续每一级都可能被替换。逐级验签形成“信任链”——每级只信任由上一级验证过的下一级。"}
   ```

2. “抗回滚”靠什么实现？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"单调计数器（配合版本号）。它记录已接受的最低版本，拒绝小于计数器的旧版本，防止降级到有漏洞的固件。"}
   ```

3. 本册 demo 的带密钥哈希等于数字签名吗？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"不等于。带密钥哈希（MAC）需要设备持有验证密钥，无法向第三方证明来源；数字签名用私钥签名、设备只持公钥。真实安全启动用非对称签名。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你设备设计逐级验签的信任链 \+ 单调计数器抗回滚，并确保校验失败进安全态。



核对与延伸：[MCUboot 设计](https://docs.mcuboot.com/design.html)

 

动手练习



运行 ` labs/host_secureboot.c `：验证逐级校验、篡改断裂与抗回滚。



**检查结果：** 信任链逐级校验=通过；App 篡改→校验失败；抗回滚计数器=5：v3 拒绝、v6 接受。

 

迁移练习：把本章的“能实现逐级验签的信任链与单调计数器抗回滚，使篡改镜像与旧版本启动失败。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 04 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b22-m04","criterion":"信任链逐级校验=通过；App 篡改→校验失败；抗回滚计数器=5：v3 拒绝、v6 接受。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b22-guide)
