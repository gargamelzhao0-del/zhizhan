# 隔离与最小权限

```zhizhan-anchor
m07
```



隔离把“出错/被攻破”的影响限制在局部： **MPU/MMU 分区、安全域、能力最小化** ；并用 **纵深防御** 多层保护。

 

> 前置：了解内核/任务与内存保护（MPU/MMU、安全域）的基本概念。 · ◷ 约 42 分钟 · ◈ 身份/固件/通信对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能按“最小权限 \+ 默认拒绝”为各角色分配能力，并验证越权请求被拒。

 

本章速览




- 隔离：MPU/MMU/安全域；最小权限、默认拒绝。

- 收敛攻击面（关无用服务/调试口）。

- 纵深防御不依赖单层。

 

```zhizhan-anchor
m07-iso
```



```zhizhan-anchor
m07-iso-t
```



## 7.1 隔离与最小权限



隔离把影响限制在局部：MPU/MMU 分区、安全域、能力最小化；用纵深防御多层保护。原则是最小权限 \+ 默认拒绝。



```zhizhan-anchor
fig-图-7-1
```



**图 7.1**  纵深防御与最小权限



```zhizhan-figure
<svg viewBox="0 0 800 160" width="100%" height="160" role="img" aria-label="纵深防御与最小权限" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">MPU/MMU：内存隔离（越权故障）</text><rect x="60" y="64" width="680" height="30" rx="6" class="sv-grn-s"></rect><text x="75" y="83.0" class="sv-lbl-hi">安全域：可信/非可信（TEE）</text><rect x="60" y="98" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="117.0" class="sv-lbl-hi">最小权限：只给必要能力</text><rect x="60" y="132" width="680" height="30" rx="6" class="sv-box"></rect><text x="75" y="151.0" class="sv-lbl-hi">纵深防御：多层、默认拒绝</text></svg>
```



MPU/MMU 内存隔离 → 安全域（可信/非可信）→ 能力最小化 → 攻击面收敛；不依赖单层。



表 7.1 隔离五手段



| 手段 | 作用 | 要点 |
| --- | --- | --- |
| MPU/MMU | 内存隔离 | 越权故障 |
| 安全域 | 可信/非可信 | TrustZone/TEE |
| 最小权限 | 只给必要能力 | capability |
| 攻击面收敛 | 关无用服务 | 减少入口 |
| 纵深防御 | 多层 | 不依赖单点 |



```zhizhan-anchor
m07-evidence
```



```zhizhan-anchor
m07-evidence-t
```



## 7.2 真实证据：能力位与越权拒绝



下面这段程序验证不同角色能力不同：



host\_auth.cC

 

```text
/* host_auth.c —— 证书/身份验证与最小权限（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_auth.c -o host_auth && ./host_auth
 */
#include <stdio.h>
#include <string.h>
typedef struct { const char *dev; const char *role; unsigned caps; } id_t;
#define CAP_READ 1u
#define CAP_WRITE 2u
#define CAP_OTA 4u
static int allowed(const id_t *d, unsigned need) { return (d->caps & need) == need; }
int main(void) {
    int ok = 1;
    id_t sensor = {"dev-01","sensor", CAP_READ};
    id_t admin = {"dev-99","admin", CAP_READ|CAP_WRITE|CAP_OTA};
    printf("sensor 写=%d（期望 0）\n", allowed(&sensor, CAP_WRITE)); if(allowed(&sensor,CAP_WRITE)) ok=0;
    printf("sensor 读=%d（期望 1）\n", allowed(&sensor, CAP_READ)); if(!allowed(&sensor,CAP_READ)) ok=0;
    printf("admin OTA=%d（期望 1）\n", allowed(&admin, CAP_OTA)); if(!allowed(&admin,CAP_OTA)) ok=0;
    printf("结论：最小权限——不同角色不同能力\n");
    printf("\n%s\n", ok?"RESULT: PASS":"RESULT: FAIL");
    return ok?0:1;
}
```

能力/权限模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_auth.c -o labs/host_auth && ./labs/host_auth
sensor 写=0（期望 0）
sensor 读=1（期望 1）
admin OTA=1（期望 1）
RESULT: PASS
```



能力位 READ=1/WRITE=2/[OTA](term:ota)=4；判定=(caps&need)==need。sensor 仅持 READ，故写=0、读=1；admin OTA=1。



表 7.2 角色能力



| 角色 | 能力位 | 允许操作 |
| --- | --- | --- |
| sensor | READ=1 | 读 |
| admin | READ\|WRITE\|OTA | 全部 |
| 越权请求 | need 不在 caps | 拒绝(0) |



```zhizhan-anchor
m07-default
```



```zhizhan-anchor
m07-default-t
```



## 7.3 默认拒绝与收敛攻击面



最小权限 \+ 默认拒绝；关掉不用的服务/端口/调试口；不把安全寄托在一层上。



auth.c 节选C

 

```text
if ((caps & need) != need) return 0;       // 默认拒绝
/* 能力位：READ=1 WRITE=2 OTA=4；只给必要能力 */
/* 关无用服务/端口/调试口，收敛攻击面 */
```

能力判定默认拒绝；收敛攻击面



```zhizhan-anchor
m07-check
```



```zhizhan-anchor
m07-check-t
```



## 7.4 自检与成熟度对照



隔离自检：分区隔离、最小权限、默认拒绝、纵深防御。



```zhizhan-anchor
fig-图-7-2
```



**图 7.2**  角色能力（真实值）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="角色能力（真实值）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">sensor 写</text><rect x="150" y="26" width="2" height="18" rx="4" class="sv-red-s"></rect><text x="160" y="43" class="sv-lbl-hi">0(允许=1)</text><text x="12" y="67" class="sv-lbl">sensor 读</text><rect x="150" y="50" width="300" height="18" rx="4" class="sv-grn-s"></rect><text x="458" y="67" class="sv-lbl-hi">1(允许=1)</text><text x="12" y="91" class="sv-lbl">admin OTA</text><rect x="150" y="74" width="300" height="18" rx="4" class="sv-grn-s"></rect><text x="458" y="91" class="sv-lbl-hi">1(允许=1)</text></svg>
```



sensor 只读（写=0/读=1）；admin 具备 OTA（=1）。越权按默认拒绝。



表 7.3 自检四步



| 步骤 | 做法 | 避免 |
| --- | --- | --- |
| 隔离 | MPU/MMU/安全域 | 全 root |
| 权限 | 能力最小 | 多余权限 |
| 默认 | 拒绝 | 默认允许 |
| 纵深 | 多层 | 单点 |



```zhizhan-anchor
m07-quick
```



```zhizhan-anchor
m07-quick-t
```



## 速查与常见错误



把本章的易错点与对策集中对照：



auth.c 节选C

 

```text
if ((caps & need) != need) return 0;      // 默认拒绝
/* 能力位 READ=1 WRITE=2 OTA=4 */
```

能力判定默认拒绝



表 7.4 隔离手段与作用



| 要点 | 正确做法 |
| --- | --- |
| MPU/MMU | 内存隔离 |
| 安全域 | 可信/非可信 |
| 最小权限 | 限影响面 |
| 纵深防御 | 不依赖单点 |



```zhizhan-anchor
m07-pitfalls
```



```zhizhan-anchor
m07-pitfalls-t
```



## 7.5 常见误区与排障



失败路径与排障




- **全部 root/全权限** ：一处失守全沦陷。

- **保留调试口/多余服务** ：攻击面大。

- **无隔离** ：错误扩散。

- **单层防御** ：被绕过即失守。



◆ 自测 · Module 07（先答再看）




1. 什么是“最小权限原则”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"每个组件只拥有完成其功能所必需的最小权限；默认拒绝。这样即使某组件被攻破，能造成的破坏也有限。"}
   ```

2. 为什么“默认拒绝”很重要？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"默认允许会让未预期的操作被放行。默认拒绝（白名单）保证只有明确授权的操作才被允许，是安全兜底。"}
   ```

3. 为什么“纵深防御”优于单层防护？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"任何单层都可能被绕过/存在漏洞。多层（隔离 \\+ 权限 \\+ 认证 \\+ 审计）叠加，单点失效不致整体沦陷。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：按“最小权限 \+ 默认拒绝”为你各角色分配能力，关闭无用服务/调试口并验证越权被拒。



核对与延伸：[Arm TrustZone](https://developer.arm.com/ip-products/security-ip/trustzone)

 

动手练习



运行 ` labs/host_auth.c `：验证不同角色能力不同（最小权限）。



**检查结果：** sensor 写=0、sensor 读=1、admin OTA=1（能力位 READ=1/WRITE=2/OTA=4）。

 

迁移练习：把本章的“能按“最小权限 \+ 默认拒绝”为各角色分配能力，并验证越权请求被拒。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 07 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b22-m07","criterion":"sensor 写=0、sensor 读=1、admin OTA=1（能力位 READ=1/WRITE=2/OTA=4）。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b22-guide)
