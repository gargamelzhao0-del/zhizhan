# 单元测试与仿真

```zhizhan-anchor
m03
```



嵌入式也能做单元测试：把与硬件解耦的 **纯逻辑** 放到主机上编译运行，用 mock/桩替代外设，快速迭代并测边界。覆盖率是手段不是目的。

 

> 前置：Module 02 的门禁与 CI 接入。 · ◷ 约 44 分钟 · ◈ 三平台工程实践对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能用断言框架在主机上测纯逻辑，含故意失败用例并统计 pass/fail。



```zhizhan-anchor
m03-knowledge-boundary
```



### 用独立判据提高测试价值



不要在测试里重复实现的同一错误公式。CRC 使用标准校验串，密码算法使用标准向量，热模型用解析解对拍离散迭代，数据链用端到端输出和失败政策验收。测试应能识别一个有代表性的错误实现，而不只覆盖执行行数。

 

本章速览




- 主机仿真单测性价比最高：逻辑与硬件解耦后快而全。

- 覆盖率看关键分支与错误路径，不只看数字。

- 用例要隔离，mock 行为要接近真实。

 

```zhizhan-anchor
m03-model
```



```zhizhan-anchor
m03-model-t
```



## 3.1 主机仿真：嵌入式最高性价比的测试



主机编译运行快、可自动化、便于构造边界与错误注入。把与硬件解耦的纯逻辑放主机测，只在 HIL/板上测“与硬件强相关”的部分。



```zhizhan-anchor
fig-图-3-1
```



**图 3.1**  测试金字塔



```zhizhan-figure
<svg viewBox="0 0 800 160" width="100%" height="160" role="img" aria-label="测试金字塔" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-red-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">端到端（少）</text><rect x="60" y="64" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="83.0" class="sv-lbl-hi">集成/HIL（中）</text><rect x="60" y="98" width="680" height="55" rx="6" class="sv-grn-s"></rect><text x="75" y="129.5" class="sv-lbl-hi">主机单元测试（多、快）</text></svg>
```



底层大量主机单测（快、便宜）；中层集成/HIL（与硬件相关）；顶层少量端到端。倒金字塔会让成本失控。



表 3.1 单元测试要素



| 概念 | 作用 | 注意 |
| --- | --- | --- |
| 断言框架 | 自动判定 | 失败可定位 |
| mock/桩 | 替代硬件 | 行为要接近真实 |
| 隔离 | 用例互不影响 | 重置状态 |
| 覆盖率 | 测了多少 | 分支/MC-DC 比语句更有意义 |
| 回归 | 防止倒退 | CI 自动跑 |



assert.h 节选C

 

```text
#define ASSERT_EQ(a,b) do { if ((a)!=(b)) { fails++; } else passes++; } while (0)
ASSERT_EQ(add(1,2), 3);              // 正常
ASSERT_EQ(add(INT_MAX,1), INT_MAX);  // 边界
```

轻量断言框架：自动判定并计数，失败可定位



```zhizhan-anchor
m03-evidence
```



```zhizhan-anchor
m03-evidence-t
```



## 3.2 真实证据：断言与计数



下面这段主机程序用断言框架跑用例并统计 pass/fail：



host\_unittest.cC

 

```text
/* host_unittest.c —— 最小单元测试框架与运行结果（主机可运行）。
 * 测试要能自动判定通过/失败并给出计数；失败要能定位到用例。本程序实现最小断言框架并运行用例。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_unittest.c -o host_unittest && ./host_unittest
 */
#include <stdio.h>
#include <string.h>
static int g_pass = 0, g_fail = 0, g_case_fail = 0;
static void CHECK(const char *name, int cond) { if (cond) g_pass++; else { g_fail++; g_case_fail = 1; printf("  FAIL: %s\n", name); } }
static void run(const char *case_name) { g_case_fail = 0; printf("用例: %s\n", case_name); }
static void end_case(void) { (void)g_case_fail; }
int add(int a, int b) { return a + b; }
int main(void) {
    int ok = 1;
    run("add");
    CHECK("1+2==3", add(1, 2) == 3);
    CHECK("0+0==0", add(0, 0) == 0);
    end_case();
    run("fail-demo");
    CHECK("1+1==3(故意失败)", add(1, 1) == 3);
    end_case();
    printf("通过=%d 失败=%d\n", g_pass, g_fail);
    if (!(g_pass == 2 && g_fail == 1)) ok = 0;   /* 应能捕获故意失败 */
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

断言框架模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_unittest.c -o labs/host_unittest && ./labs/host_unittest
用例: add
用例: fail-demo
  FAIL: 1+1==3(故意失败)
通过=2 失败=1
RESULT: PASS
```



故意失败用例被捕获并计数；通过=2、失败=1——失败用例须能定位到具体断言。



表 3.2 测试结果与动作



| 结果 | 含义 | 动作 |
| --- | --- | --- |
| PASS | 断言成立 | 继续 |
| FAIL | 断言不成立 | 定位到具体用例 |
| 总计 | 通过/失败数 | 门禁判定 |
| 覆盖率 | 分支覆盖 | 关键分支必须覆盖 |



```zhizhan-anchor
m03-mock
```



```zhizhan-anchor
m03-mock-t
```



## 3.3 mock 与可测试性



把硬件访问抽象成可注入的接口（B10 M11 的函数指针注入），就能用 mock 在主机测器件逻辑；mock 行为要接近真实，否则“测试通过但板子失败”。



unittest.c 节选C

 

```text
TEST(add_works) { ASSERT_EQ(add(1,2), 3); }
TEST(overflow_clamps) { ASSERT_EQ(add(INT_MAX,1), INT_MAX); }  // 边界
/* mock 总线：注入可控返回值，测器件层的错误路径 */
bus_t mock = { .read = mock_read_err };
ASSERT_EQ(dev_init(&(dev_t){mock,0}), -2);   // 总线错误
```

断言 \+ 边界用例 \+ mock 注入错误路径



表 3.3 测什么、怎么测



| 目标 | 手段 | 价值 |
| --- | --- | --- |
| 纯逻辑 | 主机单测 | 快、可自动化 |
| 器件逻辑 | mock 总线 | 可测错误路径 |
| 边界 | min/max/越界 | 抓临界 bug |
| 错误路径 | 注入失败 | 覆盖异常分支 |



```zhizhan-anchor
m03-check
```



```zhizhan-anchor
m03-check-t
```



## 3.4 覆盖率与三路线对照



覆盖率是手段不是目的：关键分支与错误路径被覆盖比数字更重要。



```zhizhan-anchor
fig-图-3-2
```



**图 3.2**  覆盖率的分层（示意）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="覆盖率的分层（示意）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">语句</text><rect x="150" y="26" width="540" height="18" rx="4" class="sv-box"></rect><text x="698" y="43" class="sv-lbl-hi">90%</text><text x="12" y="67" class="sv-lbl">分支</text><rect x="150" y="50" width="450" height="18" rx="4" class="sv-cyn-s"></rect><text x="608" y="67" class="sv-lbl-hi">75%</text><text x="12" y="91" class="sv-lbl">MC/DC</text><rect x="150" y="74" width="360" height="18" rx="4" class="sv-grn-s"></rect><text x="518" y="91" class="sv-lbl-hi">60%</text></svg>
```



语句覆盖是下限，分支/MC-DC 才能反映“关键路径是否被测”。追求语句覆盖数字意义有限。



表 3.4 三路线单测



| 路线 | 单测方式 | 说明 |
| --- | --- | --- |
| MCU 工程 | 主机仿真 \+ mock | 常用 |
| Linux 工程 | GoogleTest/pytest | 成熟 |
| CI/自动化 | CI 跑单测 \+ 覆盖率 | 统一门禁 |



```zhizhan-anchor
m03-pitfalls
```



```zhizhan-anchor
m03-pitfalls-t
```



## 3.5 常见误区与排障



失败路径与排障




- **只测正常路径** ：错误分支没覆盖，现场才爆。

- **用例互相依赖** ：顺序一变就失败。

- **mock 与真实行为不符** ：测试通过但板子失败。

- **追高覆盖率数字** ：关键分支没测。



◆ 自测 · Module 03（先答再看）




1. 为什么嵌入式要重视主机仿真测试？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"主机编译运行快、可自动化、便于构造边界与错误注入；把纯逻辑与硬件解耦后可覆盖大量场景，只在 HIL/板上测与硬件强相关的部分。"}
   ```

2. 为什么“覆盖率数字高”不等于测试好？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"语句覆盖高不代表关键分支与错误路径被测。要关注分支/MC-DC 与异常路径覆盖。"}
   ```

3. mock 行为与真实不一致会怎样？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"测试通过但板子失败——mock 掩盖了真实时序/返回值差异。mock 应尽量贴近真实行为。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：把你项目里一段纯逻辑抽出来在主机写单测，覆盖正常、边界与至少一条错误路径。



核对与延伸：[cppcheck 文档](https://cppcheck.sourceforge.io/)

 

动手练习



运行 ` labs/host_unittest.c `：验证断言框架能正确判定通过/失败并计数。



**检查结果：** 故意失败 1\+1==3 被捕获；通过=2、失败=1、总数=3。

 

迁移练习：把本章的“能用断言框架在主机上测纯逻辑，含故意失败用例并统计 pass/fail。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 03 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b12-m03","criterion":"故意失败 1+1==3 被捕获；通过=2、失败=1、总数=3。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b12-guide)
