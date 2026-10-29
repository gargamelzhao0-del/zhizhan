# 设备身份与密钥生命周期

```zhizhan-anchor
m03
```



设备身份是安全的基础： **一机一密/证书** ，密钥 **生成、注入、存储、轮换、吊销** 要有完整生命周期；私钥绝不外泄。

 

> 前置：了解公私钥/证书概念与设备烧录、产线注入流程。 · ◷ 约 44 分钟 · ◈ 身份/固件/通信对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能设计密钥生命周期状态机（生成→注入→存储→轮换→吊销）并拒绝非法状态转移。

 

本章速览




- 设备一机一密/证书，支持轮换与吊销。

- 私钥放 OTP/SE/TPM，不硬编码不落日志。

- 生命周期状态机禁止非法转移。

 

```zhizhan-anchor
m03-key
```



```zhizhan-anchor
m03-key-t
```



## 3.1 密钥生命周期



设备身份是安全基础：一机一密/证书。密钥要覆盖生成、注入、存储、轮换、吊销的完整生命周期；私钥绝不可读、不可硬编码、不可共用。



```zhizhan-anchor
fig-图-3-1
```



**图 3.1**  密钥生命周期状态机



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="密钥生命周期状态机" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">0 未注入</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">1 已注入</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">2 激活</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">3 吊销</text></svg>
```



未注入(0) → 注入(1) → 激活(2) → 轮换(1) → 吊销(3)。吊销后不可再激活。



表 3.1 密钥生命周期五阶段



| 阶段 | 做法 | 要点 |
| --- | --- | --- |
| 生成 | CSPRNG/HSM | 真随机 |
| 注入 | 产线安全注入 | 不落日志 |
| 存储 | OTP/SE/TPM | 私钥不可读 |
| 轮换 | 到期/疑似泄露 | 可迁移 |
| 吊销 | CRL/黑名单 | 可止损 |



```zhizhan-anchor
m03-evidence
```



```zhizhan-anchor
m03-evidence-t
```



## 3.2 真实证据：状态机与非法转移



下面这段程序验证生命周期状态机与非法转移被拒：



host\_keylife.cC

 

```text
/* host_keylife.c —— 密钥生命周期状态机（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_keylife.c -o host_keylife && ./host_keylife
 */
#include <stdio.h>
typedef enum { NONE, PROVISIONED, ACTIVE, REVOKED } ks_t;
static ks_t step(ks_t s, int ev) {   /* ev: 0=provision 1=activate 2=rotate 3=revoke */
    if (ev==0 && s==NONE) return PROVISIONED;
    if (ev==1 && s==PROVISIONED) return ACTIVE;
    if (ev==2 && s==ACTIVE) return PROVISIONED;   /* 轮换：换新密钥后再激活 */
    if (ev==3 && (s==ACTIVE||s==PROVISIONED)) return REVOKED;
    return s;
}
int main(void) {
    int ok = 1; ks_t s = NONE;
    s = step(s,0); printf("provision → %d（期望 1）\n", s); if(s!=PROVISIONED) ok=0;
    s = step(s,1); printf("activate  → %d（期望 2）\n", s); if(s!=ACTIVE) ok=0;
    s = step(s,2); printf("rotate    → %d（期望 1）\n", s); if(s!=PROVISIONED) ok=0;
    s = step(s,3); printf("revoke    → %d（期望 3）\n", s); if(s!=REVOKED) ok=0;
    ks_t s2 = step(s,1); printf("撤销后 activate → %d（仍 3，非法转移被拒）\n", s2); if(s2!=REVOKED) ok=0;
    printf("\n%s\n", ok?"RESULT: PASS":"RESULT: FAIL");
    return ok?0:1;
}
```

密钥生命周期状态机模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_keylife.c -o labs/host_keylife && ./labs/host_keylife
provision → 1（期望 1）
activate  → 2（期望 2）
rotate    → 1（期望 1）
revoke    → 3（期望 3）
撤销后 activate → 3（仍 3，非法转移被拒）
RESULT: PASS
```



状态 0→1→2→1(轮换)→3；吊销后任何激活返回 3（非法转移被拒）。



表 3.2 状态与转移



| 状态 | 编码 | 允许转移 |
| --- | --- | --- |
| 未注入 | 0 | →1 |
| 已注入 | 1 | →2（或 →3） |
| 激活 | 2 | →1（轮换） |
| 吊销 | 3 | 不可再激活 |



```zhizhan-anchor
m03-supply
```



```zhizhan-anchor
m03-supply-t
```



## 3.3 供应链与止损



密钥不能硬编码在多台共用；支持吊销才能在泄露后止损。生命周期状态机要禁止非法转移。



keylife.c 节选C

 

```text
if (state == REVOKED) return REVOKED;      // 吊销后拒绝激活
if (state == PROVISIONED) state = ACTIVE;  // 1→2
if (rotate) state = PROVISIONED;           // 轮换回到 1
```

状态机禁止吊销后再激活；支持轮换与吊销



```zhizhan-anchor
m03-check
```



```zhizhan-anchor
m03-check-t
```



## 3.4 自检与成熟度对照



密钥自检：状态机合法、可轮换、可吊销、注入不落日志。



```zhizhan-anchor
fig-图-3-2
```



**图 3.2**  生命周期状态（真实值）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="生命周期状态（真实值）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">注入</text><rect x="150" y="26" width="150" height="18" rx="4" class="sv-cyn-s"></rect><text x="308" y="43" class="sv-lbl-hi">1状态码</text><text x="12" y="67" class="sv-lbl">激活</text><rect x="150" y="50" width="300" height="18" rx="4" class="sv-grn-s"></rect><text x="458" y="67" class="sv-lbl-hi">2状态码</text><text x="12" y="91" class="sv-lbl">吊销</text><rect x="150" y="74" width="450" height="18" rx="4" class="sv-red-s"></rect><text x="608" y="91" class="sv-lbl-hi">3状态码</text></svg>
```



注入(1)→激活(2)→轮换(1)→吊销(3)；吊销后激活仍 3（拒绝）。



表 3.3 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 生成 | CSPRNG/HSM | 弱随机 |
| 注入 | 安全通道 | 落日志 |
| 存储 | OTP/SE | 明文 |
| 吊销 | 黑名单 | 不可撤 |



```zhizhan-anchor
m03-quick
```



```zhizhan-anchor
m03-quick-t
```



## 速查与常见错误



把本章的易错点与对策集中对照：



keylife.c 节选C

 

```text
if (state == REVOKED) return REVOKED;   // 吊销后拒绝
if (state == PROVISIONED) state = ACTIVE;
/* 注入不落日志；支持轮换/吊销 */
```

状态机禁止非法转移



表 3.4 密钥风险与对策



| 要点 | 正确做法 |
| --- | --- |
| 硬编码/共用 | 一机一密 |
| 不可吊销 | 黑名单/CRL |
| 注入落日志 | 安全通道 |
| 无轮换 | 定期轮换 |



```zhizhan-anchor
m03-pitfalls
```



```zhizhan-anchor
m03-pitfalls-t
```



## 3.5 常见误区与排障



失败路径与排障




- **密钥硬编码/共用** ：泄露即全网。

- **不可吊销** ：泄露无法止损。

- **注入落日志** ：密钥外泄。

- **无轮换** ：长期暴露。



◆ 自测 · Module 03（先答再看）




1. 为什么设备要“一机一密”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"一套共用密钥泄露则全部设备受影响；一机一密把影响限制在单台，且可单独轮换/吊销。"}
   ```

2. 密钥为什么要“可吊销”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"设备丢失/密钥泄露时，吊销让该身份立即失效、无法再接入，从而止损。没有吊销则泄露无法补救。"}
   ```

3. 密钥注入为什么“不能落日志”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"日志常被收集/传输/留存，密钥一旦落日志就等于明文外泄。注入应在安全通道内进行且不打印密钥。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你设备设计密钥生命周期状态机（生成→注入→存储→轮换→吊销）并实现非法转移拒绝。



核对与延伸：[NIST SP 800-57 密钥管理](https://csrc.nist.gov/publications/detail/sp/800-57-part-1/rev-5/final)

 

动手练习



运行 ` labs/host_keylife.c `：验证密钥生命周期状态机与非法转移被拒。



**检查结果：** provision→1、activate→2、rotate→1、revoke→3；吊销后 activate 仍=3（非法转移被拒）。

 

迁移练习：把本章的“能设计密钥生命周期状态机（生成→注入→存储→轮换→吊销）并拒绝非法状态转移。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 03 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b22-m03","criterion":"provision→1、activate→2、rotate→1、revoke→3；吊销后 activate 仍=3（非法转移被拒）。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b22-guide)
