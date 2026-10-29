# 生产、维护与退役

```zhizhan-anchor
m09
```



设备生命周期要覆盖 **生产、维护、退役** ：产线安全注入 \+ 量产锁定 \+ 可审计维护 \+ 退役吊销，否则“出厂就松、报废不销”。

 

> 前置：了解产线烧录/密钥注入与设备维护、退役流程。 · ◷ 约 42 分钟 · ◈ 身份/固件/通信对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能列出“产线注入→量产锁定→维护审计→退役吊销”清单，并说明不可逆步骤的确认要求。

 

本章速览




- 产线安全注入\+量产锁定\+可审计维护\+退役吊销。

- 锁定前确认固件/密钥正确。

- 退役吊销身份并清除数据。

 

```zhizhan-anchor
m09-lifecycle
```



```zhizhan-anchor
m09-lifecycle-t
```



## 9.1 生产/维护/退役



生命周期要覆盖生产（安全注入\+量产锁定）、维护（可审计）、退役（吊销密钥\+清数据），否则“出厂就松、报废不销”。



```zhizhan-anchor
fig-图-9-1
```



**图 9.1**  设备生命周期



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="设备生命周期" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">生产</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">量产锁定</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">维护审计</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">退役吊销</text></svg>
```



生产（注入/注册）→ 量产锁定 → 维护（升级/诊断审计）→ 退役（吊销/清除）→ 合规记录。



表 9.1 生命周期五阶段



| 阶段 | 动作 | 要点 |
| --- | --- | --- |
| 生产 | 密钥注入/注册 | 安全、不落日志 |
| 量产锁定 | 锁调试口/开启安全启动 | 不可逆前确认 |
| 维护 | 远程升级/诊断审计 | 鉴权\+审计 |
| 退役 | 吊销密钥/清除数据 | 防残留 |
| 合规 | 记录与证据 | 可追溯 |



```zhizhan-anchor
m09-evidence
```



```zhizhan-anchor
m09-evidence-t
```



## 9.2 真实证据：生命周期状态



下面这段程序验证生命周期状态转移（含吊销）：



````zhizhan-details
{"title":"共用程序 · 按需展开完整代码","body":"host\\_keylife.cC\n\n \n\n```text\n/* host_keylife.c —— 密钥生命周期状态机（主机可运行）。\n * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_keylife.c -o host_keylife && ./host_keylife\n */\n#include <stdio.h>\ntypedef enum { NONE, PROVISIONED, ACTIVE, REVOKED } ks_t;\nstatic ks_t step(ks_t s, int ev) {   /* ev: 0=provision 1=activate 2=rotate 3=revoke */\n    if (ev==0 && s==NONE) return PROVISIONED;\n    if (ev==1 && s==PROVISIONED) return ACTIVE;\n    if (ev==2 && s==ACTIVE) return PROVISIONED;   /* 轮换：换新密钥后再激活 */\n    if (ev==3 && (s==ACTIVE||s==PROVISIONED)) return REVOKED;\n    return s;\n}\nint main(void) {\n    int ok = 1; ks_t s = NONE;\n    s = step(s,0); printf(\"provision → %d（期望 1）\\n\", s); if(s!=PROVISIONED) ok=0;\n    s = step(s,1); printf(\"activate  → %d（期望 2）\\n\", s); if(s!=ACTIVE) ok=0;\n    s = step(s,2); printf(\"rotate    → %d（期望 1）\\n\", s); if(s!=PROVISIONED) ok=0;\n    s = step(s,3); printf(\"revoke    → %d（期望 3）\\n\", s); if(s!=REVOKED) ok=0;\n    ks_t s2 = step(s,1); printf(\"撤销后 activate → %d（仍 3，非法转移被拒）\\n\", s2); if(s2!=REVOKED) ok=0;\n    printf(\"\\n%s\\n\", ok?\"RESULT: PASS\":\"RESULT: FAIL\");\n    return ok?0:1;\n}\n```\n\n密钥生命周期模型（主机 gcc 真实编译运行）"}
````



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



注入(1)→激活(2)→轮换(1)→吊销(3)；吊销后状态=3 不可再激活（退役止损）。



表 9.2 生命周期状态



| 阶段 | 状态 | 说明 |
| --- | --- | --- |
| 注入 | 1 | 产线 |
| 激活 | 2 | 使用 |
| 轮换 | 1 | 更新 |
| 吊销 | 3 | 退役止损 |



```zhizhan-anchor
m09-lock
```



```zhizhan-anchor
m09-lock-t
```



## 9.3 量产锁定与退役



量产锁定（锁调试口）一旦执行通常不可逆，必须在确认固件/密钥正确后进行；退役要吊销身份并清除敏感数据。



lifecycle.txt 节选Text

 

```text
生产: 安全注入密钥 + 注册身份（不落日志）
量产锁定: 锁调试口 + 开启安全启动（不可逆前确认）
维护: 升级/诊断须鉴权 + 审计记录
退役: 吊销密钥 + 清除敏感数据（防残留）
```

注入→锁定→维护审计→退役吊销，不可逆步骤先确认



```zhizhan-anchor
m09-check
```



```zhizhan-anchor
m09-check-t
```



## 9.4 自检与成熟度对照



生命周期自检：注入安全、锁定确认、维护审计、退役吊销。



```zhizhan-anchor
fig-图-9-2
```



**图 9.2**  生命周期状态（真实值）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="生命周期状态（真实值）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">注入</text><rect x="150" y="26" width="150" height="18" rx="4" class="sv-cyn-s"></rect><text x="308" y="43" class="sv-lbl-hi">1状态码</text><text x="12" y="67" class="sv-lbl">激活</text><rect x="150" y="50" width="300" height="18" rx="4" class="sv-grn-s"></rect><text x="458" y="67" class="sv-lbl-hi">2状态码</text><text x="12" y="91" class="sv-lbl">吊销</text><rect x="150" y="74" width="450" height="18" rx="4" class="sv-red-s"></rect><text x="608" y="91" class="sv-lbl-hi">3状态码</text></svg>
```



注入(1)→激活(2)→轮换(1)→吊销(3)；吊销后不可再激活。



表 9.3 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 生产 | 安全注入 | 落日志 |
| 锁定 | 确认后 | 贸然 |
| 维护 | 鉴权\+审计 | 无审计 |
| 退役 | 吊销\+清除 | 残留 |



```zhizhan-anchor
m09-quick
```



```zhizhan-anchor
m09-quick-t
```



## 速查与常见错误



把本章的易错点与对策集中对照：



lifecycle.txt 节选Text

 

```text
生产: 安全注入（不落日志）
量产锁定: 锁调试口（不可逆前确认）
退役: 吊销密钥 + 清除数据
```

注入→锁定→维护→退役吊销



表 9.4 阶段与风险



| 要点 | 正确做法 |
| --- | --- |
| 生产 | 注入泄露 |
| 量产锁定 | 贸然锁死 |
| 维护 | 无审计 |
| 退役 | 身份残留 |



```zhizhan-anchor
m09-pitfalls
```



```zhizhan-anchor
m09-pitfalls-t
```



## 9.5 常见误区与排障



失败路径与排障




- **出厂不锁调试口** ：可被完全控制。

- **密钥注入落日志** ：泄露。

- **维护无审计** ：无法追责。

- **退役不吊销** ：旧身份可被复用。



◆ 自测 · Module 09（先答再看）




1. 为什么“量产锁定调试口”要在确认后才做？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"锁定通常不可逆；若固件/密钥有误，锁死后无法再调试/修复。应先在样机验证，再对量产批次执行。"}
   ```

2. 退役时为什么要“吊销密钥并清除数据”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"防止旧设备身份被复用、敏感数据残留被提取。退役是生命周期的最后一环，处理不当会留下长期风险。"}
   ```

3. 维护为什么必须“鉴权 \+ 审计”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"维护通道是特权入口。鉴权防止未授权访问，审计让每次维护可追溯，异常操作可被发现与追责。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你产品写一张“生产-维护-退役”清单，标出不可逆步骤的确认要求与退役吊销流程。



核对与延伸：[NIST SP 800-57 密钥管理](https://csrc.nist.gov/publications/detail/sp/800-57-part-1/rev-5/final) · [Arm TrustZone](https://developer.arm.com/ip-products/security-ip/trustzone)

 

动手练习



运行 ` labs/host_keylife.c `（生命周期）；为产品写一张“生产-维护-退役”清单。



**检查结果：** 密钥按 注入(1)→激活(2)→轮换(1)→吊销(3) 转移；退役吊销后状态=3 不可再激活；锁定步骤须确认。

 

迁移练习：把本章的“能列出“产线注入→量产锁定→维护审计→退役吊销”清单，并说明不可逆步骤的确认要求。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 09 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b22-m09","criterion":"密钥按 注入(1)→激活(2)→轮换(1)→吊销(3) 转移；退役吊销后状态=3 不可再激活；锁定步骤须确认。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b22-guide)
