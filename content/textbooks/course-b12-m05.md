# 版本与固件管理

```zhizhan-anchor
m05
```



版本管理要回答“ **这块板子上到底是哪个固件** ”。用 **语义化版本** （major.minor.patch）加构建号/提交哈希，能精确追溯并支持回滚。

 

> 前置：Module 01 提交规范与 Module 03/04 的测试门禁。 · ◷ 约 42 分钟 · ◈ 三平台工程实践对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能用语义化版本\+构建号/哈希做版本比较与升级准入判断。

 

本章速览




- 语义化版本 \+ 构建号/哈希，精确追溯。

- 发布要可复现，附变更日志。

- 升级准入：不降级、跨版本先迁移。

 

```zhizhan-anchor
m05-model
```



```zhizhan-anchor
m05-model-t
```



## 5.1 语义化版本 \+ 构建号



语义化版本约定兼容性：major 不兼容、minor 向后兼容新增、patch 兼容修复。再加 **构建号/提交哈希** 区分“同版本不同构建”，才能精确追溯到源码。



```zhizhan-anchor
fig-图-5-1
```



**图 5.1**  版本与构建号



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="版本与构建号" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">major 不兼容</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">minor 兼容新增</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">patch 修复</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">构建号/哈希</text></svg>
```



major.minor.patch 表达兼容性；构建号/提交哈希定位到具体源码与工具链版本。



表 5.1 语义化版本



| 版本 | 含义 | 变更 |
| --- | --- | --- |
| major | 不兼容变更 | 跨大版本需迁移 |
| minor | 向后兼容新增 | 可升级 |
| patch | 兼容修复 | 可升级 |
| 构建号 | 同版本不同构建 | 含提交哈希 |



semver.c 节选C

 

```text
int ver_cmp(int a[3], int b[3]) {
  for (int i=0;i<3;i++) if (a[i]!=b[i]) return a[i]<b[i]?-1:1;
  return 0;   // 1.2.3 vs 1.3.0 -> -1
}
```

按 major/minor/patch 逐段比较，判断新旧与准入



```zhizhan-anchor
m05-evidence
```



```zhizhan-anchor
m05-evidence-t
```



## 5.2 真实证据：比较与准入



下面这段主机程序实现语义化版本比较与升级准入判定：



host\_version.cC

 

```text
/* host_version.c —— 版本与发布策略：语义化版本比较与升级准入（主机可运行）。
 * 语义化版本 major.minor.patch；升级不降级、跨大版本需迁移。本程序比较与准入判定。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_version.c -o host_version && ./host_version
 */
#include <stdio.h>
static int cmp(int a, int b, int c, int x, int y, int z) {
    if (a != x) return a < x ? -1 : 1;
    if (b != y) return b < y ? -1 : 1;
    if (c != z) return c < z ? -1 : 1;
    return 0;
}
/* 1=允许，0=同版/更旧，-1=需先迁移 */
static int allow(int ca, int cb, int cc, int ia, int ib, int ic, int maj_max) {
    int c = cmp(ca, cb, cc, ia, ib, ic);
    if (c >= 0) return 0;
    if (ia - ca > maj_max) return -1;
    return 1;
}
int main(void) {
    int ok = 1;
    printf("1.2.3 vs 1.3.0 → %d（期望 -1 更旧）\n", cmp(1,2,3,1,3,0));
    if (cmp(1,2,3,1,3,0) != -1) ok = 0;
    printf("2.0.0 vs 1.9.9 → %d（期望 1 更新）\n", cmp(2,0,0,1,9,9));
    if (cmp(2,0,0,1,9,9) != 1) ok = 0;
    printf("同版准入=%d（期望 0）\n", allow(1,2,3,1,2,3,1));
    if (allow(1,2,3,1,2,3,1) != 0) ok = 0;
    printf("跨 2 个主版本准入=%d（期望 -1 需迁移）\n", allow(1,0,0,3,0,0,1));
    if (allow(1,0,0,3,0,0,1) != -1) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

版本比较与准入模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_version.c -o labs/host_version && ./labs/host_version
1.2.3 vs 1.3.0 → -1（期望 -1 更旧）
2.0.0 vs 1.9.9 → 1（期望 1 更新）
同版准入=0（期望 0）
跨 2 个主版本准入=-1（期望 -1 需迁移）
RESULT: PASS
```



比较返回 -1/0/1；跨 2 个主版本准入=-1（需先迁移），同版准入=0。



表 5.2 比较与准入



| 比较 | 结果 | 准入 |
| --- | --- | --- |
| 1.2.3 vs 1.3.0 | -1 | 可升级 |
| 2.0.0 vs 1.9.9 | 1 | 可升级 |
| 同版 | 0 | 准入=0 |
| 跨 2 主版本 | — | -1 需迁移 |



```zhizhan-anchor
m05-release
```



```zhizhan-anchor
m05-release-t
```



## 5.3 可复现发布



发布要可复现：用标签记录源码与工具链版本、生成变更日志；升级准入按策略判断（不降级、跨版本先迁移）。



release.sh 节选Shell

 

```text
git tag -a v1.3.0 -m "release 1.3.0"
make BUILD_ID=$(git rev-parse --short HEAD)   # 构建号=提交哈希
# 生成变更日志；打包固件并记录工具链版本
git log --oneline v1.2.3..v1.3.0 > CHANGELOG
```

标签 \+ 提交哈希构建号 \+ 变更日志 = 可复现、可追溯



表 5.3 发布要求



| 要求 | 做法 | 收益 |
| --- | --- | --- |
| 可复现 | 标签 \+ 锁定工具链 | 换机器同一产物 |
| 可追溯 | 构建号=提交哈希 | 定位源码 |
| 可解释 | 自动变更日志 | 升级说清改了什么 |
| 安全升级 | 准入策略（不降级/迁移） | 避免旧读新 |



```zhizhan-anchor
m05-check
```



```zhizhan-anchor
m05-check-t
```



## 5.4 自检与三路线对照



版本自检：能否精确回答“现场是哪个固件”、能否安全升级/回滚。



```zhizhan-anchor
fig-图-5-2
```



**图 5.2**  版本与构建号的分层



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="版本与构建号的分层" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="33" rx="6" class="sv-cyn-s"></rect><text x="75" y="50.7" class="sv-lbl-hi">major.minor.patch（兼容性）</text><rect x="60" y="67" width="680" height="33" rx="6" class="sv-amb-s"></rect><text x="75" y="88.0" class="sv-lbl-hi">build/hash（构建定位）</text><rect x="60" y="105" width="680" height="33" rx="6" class="sv-grn-s"></rect><text x="75" y="125.3" class="sv-lbl-hi">现场可查的唯一标识</text></svg>
```



语义版本表达兼容性；构建号定位构建；两者共同构成“这台上到底是哪个固件”的唯一标识。



表 5.4 三路线版本管理



| 路线 | 版本管理 | 说明 |
| --- | --- | --- |
| MCU 工程 | 固件\+参数区版本 | 设备自报 |
| Linux 工程 | 包/镜像版本 \+ git | 成熟 |
| CI/自动化 | 标签 \+ 自动构建 | 统一流水线 |



```zhizhan-anchor
m05-pitfalls
```



```zhizhan-anchor
m05-pitfalls-t
```



## 5.5 常见误区与排障



失败路径与排障




- **版本随意递增** ：无法判断兼容性。

- **无构建号/哈希** ：同版本不同产物无法区分。

- **不生成变更日志** ：升级说不清改了什么。

- **允许无差别降级** ：旧固件读不懂新参数。



◆ 自测 · Module 05（先答再看）




1. 为什么固件版本要带“构建号/提交哈希”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"同一语义版本可能有多个构建（修复/配置不同）。构建号或提交哈希能精确对应到源码，便于复现与定位。"}
   ```

2. 为什么“允许无差别降级”有风险？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"旧固件可能读不懂新固件写下的参数结构，导致行为异常。降级应受准入策略约束（先迁移/清参数）。"}
   ```

3. 语义化版本里 major/minor/patch 各表示什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"major 不兼容变更、minor 向后兼容新增、patch 兼容修复。据此判断升级/回滚的兼容性。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：给你固件引入语义化版本 \+ 提交哈希构建号，并在设备启动/查询里可读出“当前版本”。



核对与延伸：[C\+\+ Core / Google 风格（可移植到 C 团队）](https://google.github.io/styleguide/) · [Unity / CMock（嵌入式单测）](https://www.throwtheswitch.org/)

 

动手练习



运行 ` labs/host_version.c `：验证语义化版本比较与升级准入规则。



**检查结果：** 1.2.3\<1.3.0 返回 -1；2.0.0\>1.9.9 返回 1；同版准入=0；跨 2 主版本准入=-1。

 

迁移练习：把本章的“能用语义化版本\+构建号/哈希做版本比较与升级准入判断。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 05 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b12-m05","criterion":"1.2.31.9.9 返回 1；同版准入=0；跨 2 主版本准入=-1。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b12-guide)
