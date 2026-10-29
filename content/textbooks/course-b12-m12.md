# 发布、生产与现场闭环

```zhizhan-anchor
m12
```



发布不是“推完就完”：要有 **发布清单与门禁** 、 **灰度分批** 、 **生产烧录一致性** ，以及把现场反馈 **闭环** 回需求/测试。

 

> 前置：Module 05 版本管理与 Module 11 故障注入回归。 · ◷ 约 44 分钟 · ◈ 三平台工程实践对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能写发布清单与门禁、设灰度分批与量化回滚条件，并让现场反馈闭环回需求/测试。

 

本章速览




- 发布有清单与门禁、灰度分批、可回滚。

- 生产批次可对应固件/配置版本。

- 现场反馈闭环回需求与测试。

 

```zhizhan-anchor
m12-model
```



```zhizhan-anchor
m12-model-t
```



## 12.1 发布清单与门禁



发布前必须“测试/文档/回滚”就绪，门禁全过；灰度小批量先上、指标正常再放量；生产烧录要与版本一致；现场反馈闭环回需求/测试。



```zhizhan-anchor
fig-图-12-1
```



**图 12.1**  从发布到现场闭环



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="从发布到现场闭环" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="88.0" y="66" text-anchor="middle" class="sv-lbl-hi">发布清单</text><path d="M158,69 H174" class="sv-arrow"></path><rect x="176" y="44" width="136" height="50" rx="7" class="sv-cyn-s"></rect><text x="244.0" y="66" text-anchor="middle" class="sv-lbl-hi">门禁</text><path d="M314,69 H330" class="sv-arrow"></path><rect x="332" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="400.0" y="66" text-anchor="middle" class="sv-lbl-hi">灰度</text><path d="M470,69 H486" class="sv-arrow"></path><rect x="488" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="556.0" y="66" text-anchor="middle" class="sv-lbl-hi">放量/监控</text><path d="M626,69 H642" class="sv-arrow"></path><rect x="644" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="712.0" y="66" text-anchor="middle" class="sv-lbl-hi">闭环</text></svg>
```



发布清单 → 门禁 → 灰度 → 放量 → 监控 → 反馈闭环回需求/测试。



表 12.1 发布五环节



| 环节 | 内容 | 要点 |
| --- | --- | --- |
| 发布清单 | 测试/文档/回滚就绪 | 门禁全过 |
| 灰度 | 小批量先上 | 指标正常再放量 |
| 生产 | 烧录固件\+配置 | 与版本一致 |
| 监控 | 线上指标/告警 | 发现异常 |
| 闭环 | 反馈→需求/测试 | 防止复发 |



release.c 节选C

 

```text
if (gate_failed() || !rollback_ready()) return -1;  // 发布门禁
deploy_gray(0.05);  if (metrics_bad()) rollback();  // 灰度+回滚
deploy_gray(1.00);                                   // 正常再放量
```

发布清单\+门禁\+灰度\+量化回滚条件



```zhizhan-anchor
m12-evidence
```



```zhizhan-anchor
m12-evidence-t
```



## 12.2 真实证据：发布准入



发布与版本强绑定：每个批次都要能对应固件/配置版本。下面这段程序给出准入判定证据：



````zhizhan-details
{"title":"共用程序 · 按需展开完整代码","body":"host\\_version.cC\n\n \n\n```text\n/* host_version.c —— 版本与发布策略：语义化版本比较与升级准入（主机可运行）。\n * 语义化版本 major.minor.patch；升级不降级、跨大版本需迁移。本程序比较与准入判定。\n * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_version.c -o host_version && ./host_version\n */\n#include <stdio.h>\nstatic int cmp(int a, int b, int c, int x, int y, int z) {\n    if (a != x) return a < x ? -1 : 1;\n    if (b != y) return b < y ? -1 : 1;\n    if (c != z) return c < z ? -1 : 1;\n    return 0;\n}\n/* 1=允许，0=同版/更旧，-1=需先迁移 */\nstatic int allow(int ca, int cb, int cc, int ia, int ib, int ic, int maj_max) {\n    int c = cmp(ca, cb, cc, ia, ib, ic);\n    if (c >= 0) return 0;\n    if (ia - ca > maj_max) return -1;\n    return 1;\n}\nint main(void) {\n    int ok = 1;\n    printf(\"1.2.3 vs 1.3.0 → %d（期望 -1 更旧）\\n\", cmp(1,2,3,1,3,0));\n    if (cmp(1,2,3,1,3,0) != -1) ok = 0;\n    printf(\"2.0.0 vs 1.9.9 → %d（期望 1 更新）\\n\", cmp(2,0,0,1,9,9));\n    if (cmp(2,0,0,1,9,9) != 1) ok = 0;\n    printf(\"同版准入=%d（期望 0）\\n\", allow(1,2,3,1,2,3,1));\n    if (allow(1,2,3,1,2,3,1) != 0) ok = 0;\n    printf(\"跨 2 个主版本准入=%d（期望 -1 需迁移）\\n\", allow(1,0,0,3,0,0,1));\n    if (allow(1,0,0,3,0,0,1) != -1) ok = 0;\n    printf(\"\\n%s\\n\", ok ? \"RESULT: PASS\" : \"RESULT: FAIL\");\n    return ok ? 0 : 1;\n}\n```\n\n版本替代与准入（主机 gcc 真实编译运行）"}
````



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_version.c -o labs/host_version && ./labs/host_version
同版准入=0（期望 0）
跨 2 个主版本准入=-1（期望 -1 需迁移）
RESULT: PASS
```



同版准入=0；跨 2 主版本准入=-1（先迁移）——发布/升级要过版本准入。



表 12.2 发布/回滚条件



| 发布项 | 通过条件 | 回滚条件 |
| --- | --- | --- |
| 门禁 | 编译/静态/单测全过 | 任一失败即停 |
| 灰度 | 小批量指标正常 | 超阈值回滚 |
| 生产 | 版本可追溯 | 批次可界分 |
| 监控 | 无告警 | 异常即介入 |



```zhizhan-anchor
m12-gray
```



```zhizhan-anchor
m12-gray-t
```



## 12.3 灰度与回滚



灰度是为了在影响面小时发现坏版本； **回滚条件应是可量化的指标阈值** ，避免“犹豫拖延”导致问题扩大到全量。



release\_checklist.md 节选Text

 

```text
- [ ] CI 门禁全过（编译/静态/单测/覆盖率）
- [ ] 版本标签 + 构建号 + 变更日志
- [ ] 回滚镜像/分区就绪
- [ ] 灰度方案：5% → 25% → 100%
- [ ] 回滚阈值：错误率 > 1% 或延迟 P99 > X 即回滚
```

发布清单 \+ 灰度量级 \+ 可量化回滚阈值



表 12.3 发布策略



| 策略 | 做法 | 风险控制 |
| --- | --- | --- |
| 发布清单 | 逐项打勾 | 不漏测/不漏文档 |
| 灰度分批 | 5%→25%→100% | 影响面小 |
| 量化回滚 | 错误率/延迟阈值 | 快速止损 |
| 闭环 | 反馈进需求/测试 | 防复发 |



```zhizhan-anchor
m12-check
```



```zhizhan-anchor
m12-check-t
```



## 12.4 自检与三路线对照



发布自检：清单完整、门禁全过、灰度与回滚可量化、反馈闭环。



```zhizhan-anchor
fig-图-12-2
```



**图 12.2**  现场反馈闭环



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="现场反馈闭环" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">现场反馈</text><rect x="60" y="64" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="83.0" class="sv-lbl-hi">需求/测试更新</text><rect x="60" y="98" width="680" height="30" rx="6" class="sv-grn-s"></rect><text x="75" y="117.0" class="sv-lbl-hi">修正 + 回归</text><rect x="60" y="132" width="680" height="30" rx="6" class="sv-box"></rect><text x="75" y="151.0" class="sv-lbl-hi">再发布（闭环）</text></svg>
```



现场问题 → 需求/测试更新 → 修正 → 回归 → 发布。闭环让同类问题不再复发。



表 12.4 三路线发布



| 路线 | 发布形态 | 说明 |
| --- | --- | --- |
| MCU 工程 | 固件 \+ 产测烧录 | 批次可追溯 |
| Linux 工程 | 镜像/容器 \+ 灰度 | 成熟 |
| CI/自动化 | 流水线发布 \+ 监控 | 统一 |



```zhizhan-anchor
m12-pitfalls
```



```zhizhan-anchor
m12-pitfalls-t
```



## 12.5 常见误区与排障



失败路径与排障




- **无发布清单** ：漏测/漏文档。

- **直接全量** ：坏版本全量事故。

- **生产版本不追溯** ：批次问题无法界定。

- **反馈不闭环** ：同样问题反复出现。



◆ 自测 · Module 12（先答再看）




1. 为什么灰度发布要预设“回滚条件”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"灰度是为了在影响面小时发现坏版本；没有明确回滚条件，团队会犹豫拖延，导致问题扩大到全量。回滚条件应是可量化的指标阈值。"}
   ```

2. 发布前为什么要有“发布清单 \+ 门禁”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"清单保证“测试/文档/回滚”都就绪，门禁保证硬性质量达标，避免漏项和带病发布。"}
   ```

3. “现场反馈闭环”指什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"把现场问题回溯到需求与测试，更新用例并回归，确保同类问题不再复发，而不是只修现场这一台。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你的产品写一张发布清单（含灰度与量化回滚条件），并建立“现场反馈→需求/测试”的闭环。



核对与延伸：[C\+\+ Core / Google 风格（可移植到 C 团队）](https://google.github.io/styleguide/) · [Unity / CMock（嵌入式单测）](https://www.throwtheswitch.org/)

 

动手练习



运行 ` labs/host_version.c `（版本与准入）；为你的产品写一张发布清单并定义灰度与回滚条件。



**检查结果：** 发布前门禁全过、同版准入=0、跨 2 主版本准入=-1（先迁移）；灰度有量化回滚条件。

 

迁移练习：把本章的“能写发布清单与门禁、设灰度分批与量化回滚条件，并让现场反馈闭环回需求/测试。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 12 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-anchor
m12-release-supply-chain
```



```zhizhan-anchor
m12-release-supply-chain-t
```



## 发布的依赖、来源和完整性

 

一个可交接版本至少关联需求/测试、源修订、工具链、配置、依赖锁文件、构建产物和恢复方法。软件物料清单记录组件、版本、来源、许可证及依赖关系；哈希清单不能代替它，也不能证明“没有漏洞”。

 

运行 ` python labs/release_manifest.py test `。[完整性实验](textbook-file:b12/labs/release_manifest.py)实际写文件，验证篡改、文件丢失和路径越界；它输出的是本课程发布清单，不冒称标准 SBOM 或签名证明。

 

```text
python labs/release_manifest.py create --root release --file firmware.bin --file dependencies.lock --revision ACTUAL_COMMIT --manifest inventory.json
python labs/release_manifest.py verify --root release --manifest inventory.json
```

 

将 ACTUAL\_COMMIT 换成真实修订。再用适合 SDK/包管理器的工具生成 SPDX/CycloneDX 清单；人工核对静态链接库、二进制 blob 与许可证遗漏。将清单及依赖锁文件一起绑定到 P03 的签名发布流程，可信公钥在发布包之外管理。

 

迁移验收：另一人从冻结依赖重建版本，能解释每项差异；篡改产物被拒绝，错误签名不能部署。构建来源证明应标识实际构建者、材料和过程；本地写一个 JSON 不等于已达到某个 SLSA 等级。

 

[SLSA 1.2 规范](https://slsa.dev/spec/v1.2/) · [来源证明](https://slsa.dev/spec/v1.2/provenance)。本节验收完整性与交接，不替代产品认证。



```zhizhan-assessment
{"id":"course-b12-m12","criterion":"发布前门禁全过、同版准入=0、跨 2 主版本准入=-1（先迁移）；灰度有量化回滚条件。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b12-guide)
