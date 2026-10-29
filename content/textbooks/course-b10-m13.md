# 驱动验证与跨版本维护

```zhizhan-anchor
m13
```



驱动写完只是开始：要 **验证** （编译告警、静态检查、回归、真机）并具备 **跨版本维护** 能力（用上游子系统接口、避免私有符号、跟进内核变更）。本章给出一套可执行的验证与维护清单。

 

> 前置：完成 M01–M12，具备模块/字符设备/子系统/PM 基础。 · ◷ 约 42 分钟 · ◈ 三平台驱动对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能对驱动做“编译/静态/回归/真机”多层验证，并识别跨内核版本的高风险 API 用法。

 

本章速览




- 驱动要维护：锁内核版本、把易变 API 封装、建回归测试。

- 把“对外行为”与“内核 API”分离，升级只改适配层。

- 能上游化的尽量上游化，降低长期维护成本。

 

```zhizhan-anchor
m13-verify
```



```zhizhan-anchor
m13-verify-t
```



## 13.1 验证分层：从编译到真机



驱动验证要多层叠加： **编译告警（-Werror）→ 静态检查（sparse/smatch/checkpatch）→ 回归（生命周期/接口）→ 真机（probe/压力/断电）** 。只跑“能编过”远远不够。



```zhizhan-anchor
fig-图-13-1
```



**图 13.1**  驱动验证的层层门禁



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="驱动验证的层层门禁" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">编译 -Werror</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">静态检查</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">回归测试</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">真机压力</text></svg>
```



编译（-Werror）→ 静态检查 → 单元/回归 → 真机压力 → 断电/挂起恢复。任一环失败都不算完成。



表 13.1 验证的分层



| 层 | 手段 | 抓什么 |
| --- | --- | --- |
| 编译 | -Werror -Wall | 类型/未用变量/格式串 |
| 静态 | sparse / smatch / checkpatch | 地址空间标注/风格/隐患 |
| 回归 | 生命周期/接口断言 | init/ref/返回值 |
| 真机 | 压力 \+ 挂起恢复 \+ 断电 | 并发/PM/掉电 |



```zhizhan-anchor
m13-evidence
```



```zhizhan-anchor
m13-evidence-t
```



## 13.2 真实证据：生命周期回归



把模块生命周期做成可复跑的回归（重复加载、拒绝卸载、归零卸载），是驱动验证的最小闭环：



````zhizhan-details
{"title":"共用程序 · 按需展开完整代码","body":"host\\_module.cC\n\n \n\n```text\n/* host_module.c —— 内核模块生命周期与引用计数模型（主机可运行）。\n * 模块只能在内核里存在一份；init 注册、exit 注销；设备被打开时引用计数>0，此时不能卸载。\n * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_module.c -o host_module && ./host_module\n */\n#include <stdio.h>\n#include <string.h>\nstatic int g_loaded = 0, g_ref = 0, g_param = 0;\n/* -EEXIST=17：模块已加载（重复加载）；-EBUSY=16：仍在使用不可卸载；-ENODEV=19：设备未就绪 */\nstatic int mod_init(int param) { if (g_loaded) return -17; g_loaded = 1; g_param = param; return 0; }\nstatic int mod_exit(void) { if (g_ref > 0) return -16; g_loaded = 0; return 0; }\nstatic int dev_open(void) { if (!g_loaded) return -19; g_ref++; return 0; }\nstatic int dev_release(void) { if (g_ref > 0) g_ref--; return 0; }\nint main(void) {\n    int ok = 1;\n    printf(\"首次 init: %d（期望 0）\\n\", mod_init(7));\n    printf(\"重复 init: %d（期望 -17，-EEXIST）\\n\", mod_init(7));\n    printf(\"init=%d param=%d\\n\", g_loaded, g_param);\n    if (!(g_loaded == 1 && g_param == 7)) ok = 0;\n    dev_open(); dev_open();\n    printf(\"两次 open 后 ref=%d\\n\", g_ref);\n    if (g_ref != 2) ok = 0;\n    printf(\"ref>0 时 exit: %d（期望 -16，拒绝卸载）\\n\", mod_exit());\n    if (mod_exit() != -16) ok = 0;\n    dev_release(); dev_release();\n    printf(\"release 后 ref=%d，exit=%d（期望 0）\\n\", g_ref, mod_exit());\n    if (!(g_ref == 0 && mod_exit() == 0 && g_loaded == 0)) ok = 0;\n    printf(\"\\n%s\\n\", ok ? \"RESULT: PASS\" : \"RESULT: FAIL\");\n    return ok ? 0 : 1;\n}\n```\n\n模块生命周期回归模型（主机 gcc 真实编译运行）"}
````



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_module.c -o labs/host_module && ./labs/host_module
首次 init: 0（期望 0）
重复 init: -17（期望 -17，-EEXIST）
init=1 param=7
两次 open 后 ref=2
ref>0 时 exit: -16（期望 -16，拒绝卸载）
release 后 ref=0，exit=0（期望 0）
RESULT: PASS
```



把“重复加载、拒绝卸载、归零卸载”固化成可复跑的断言，回归时一眼看出退化。



表 13.2 生命周期回归用例



| 验证项 | 期望 | 回归价值 |
| --- | --- | --- |
| 首次加载 | 0 | 基本可用 |
| 重复加载 | -EEXIST | 防重复注册 |
| ref\>0 卸载 | -EBUSY | 防悬空释放 |
| 归零卸载 | 0 | 资源可回收 |
| 重载后 | 仍 0 | 无残留状态 |



```zhizhan-anchor
m13-maint
```



```zhizhan-anchor
m13-maint-t
```



## 13.3 跨版本维护：按版本核对上游接口



Linux 不承诺稳定的内核内部 API/ABI。使用上游子系统接口有助于维护，但 regmap、devm 和回调签名仍可能变化；每个支持版本都要构建并验证。厂商树的补丁与配置也属于验证范围。



内核内部 API 不稳定。跨版本维护的关键是： **只用稳定/文档化 API** （子系统框架、regmap、devm\_\*），避免私有符号；跟进 deprecated 替代；把与版本相关的代码局部化。



表 13.3 跨版本高风险用法与替代



| 高风险用法 | 替代 | 原因 |
| --- | --- | --- |
| 直接调用未导出符号 | 用子系统/框架 API | 符号不稳定/不可导出 |
| 自造 ioctl 接口 | 接入子系统 | 接口无生态、难维护 |
| 硬编码寄存器/地址 | 设备树 \+ regmap | 换板即失效 |
| 忽略 deprecated 告警 | 迁移到新 API | 新版将移除 |
| 依赖特定版本宏 | 用能力检测/条件编译 | 版本漂移 |



check.sh 节选Shell

 

```text
make M=$PWD C=1                # 带 W=1 更严格
make C=2 M=$PWD                # sparse 静态检查
scripts/checkpatch.pl --no-tree -f mydrv.c   # 风格与隐患
# 真机：insmod/rmmod 多次、并发访问、挂起恢复、断电重启
```

编译→sparse→checkpatch→真机 的驱动验证四步



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm13-routes\n```\n\n\n\n```zhizhan-anchor\nm13-routes-t\n```\n\n\n\n## 13.4 三条内核路线对照：维护\n\n\n\n三条路线的维护要点一致（上游子系统接口 \\+ 设备树 \\+ regmap），差异在内核版本与厂商补丁。\n\n\n\n表 13.4 三条路线的维护来源\n\n\n\n| 内核路线 | 内核来源 | 维护关注 | 说明 |\n| --- | --- | --- | --- |\n| STM32MP1 | mainline \\+ ST 补丁 | 上游优先 | mainline |\n| i.MX6ULL | NXP BSP | BSP 与上游差异 | BSP mainline |\n| V3s | mainline sunxi | 上游优先 | sunxi |"}
````



```zhizhan-anchor
m13-ci
```



```zhizhan-anchor
m13-ci-t
```



## 13.5 CI 流水线与验收



把验证固化成 CI：每次提交自动跑“编译→静态→回归”，真机项走硬件在环。这样退化能在合并前暴露。



```zhizhan-anchor
fig-图-13-2
```



**图 13.2**  驱动 CI 流水线



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="驱动 CI 流水线" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">提交</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">编译+静态</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">回归</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">真机冒烟</text></svg>
```



提交 → 编译(-Werror) → sparse/checkpatch → 生命周期回归 → 真机冒烟 → 通过/阻断。自动化让“能编过”之外的隐患也被拦住。



ci.sh 节选Shell

 

```text
set -e
make M=$PWD C=1 W=1
make M=$PWD C=2                      # sparse
scripts/checkpatch.pl --no-tree -f *.c
gcc -Wall -Wextra -Werror host_lifecycle.c -o /tmp/reg && /tmp/reg   # 回归
```

一条命令串联“编译\+静态\+回归”，纳入 CI



```zhizhan-anchor
m13-pitfalls
```



```zhizhan-anchor
m13-pitfalls-t
```



## 13.6 常见误区与排障



失败路径与排障




- **只跑“能编过”** ：告警/静态检查里的隐患被放过。

- **用私有符号/未导出 API** ：换内核即编不过。

- **无回归用例** ：改动引入退化无法及时发现。

- **不做真机压力/断电** ：并发与掉电问题留到现场。



◆ 自测 · Module 13（先答再看）




1. 驱动验证为什么不能只跑“能编译过”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"编译只保证语法/类型；“能编过”仍可能有告警隐患、静态可查的错误、并发/PM 问题。需要静态检查、回归、真机多层叠加。"}
   ```

2. 跨内核版本维护，为什么要“只用上游子系统接口”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"内核内部 API 不稳定，私有符号/未导出接口换版本就可能编不过或行为变。用子系统/regmap/devm\\_\\* 等稳定接口，把版本相关代码局部化。"}
   ```

3. 驱动回归用例应至少覆盖什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"生命周期：首次加载、重复加载（-EEXIST）、ref\\>0 卸载（-EBUSY）、归零卸载、重载无残留。这是发现退化最直接的一组断言。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你的驱动加一条 CI：编译(-Werror)\+sparse\+checkpatch\+生命周期回归，并修复所有告警。



核对与延伸：[Linux 内核文档 · Driver API](https://www.kernel.org/doc/html/latest/driver-api/index.html) · [LWN · 并发与锁](https://lwn.net/Kernel/Index/#Locking)

 

动手练习



复跑 ` labs/host_module.c `（生命周期回归），并对驱动跑一遍编译告警与静态检查清单。



**检查结果：** 生命周期回归通过（init=0/重复=-17/ref\>0=-16/归零=0）；能列出跨版本高风险用法与替代。

 

迁移练习：把本章的“能对驱动做“编译/静态/回归/真机”多层验证，并识别跨内核版本的高风险 API 用法。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 13 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b10-m13","criterion":"生命周期回归通过（init=0/重复=-17/ref>0=-16/归零=0）；能列出跨版本高风险用法与替代。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b10-guide)
