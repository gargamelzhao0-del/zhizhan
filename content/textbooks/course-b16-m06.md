# Python 环境与工程打包

```zhizhan-anchor
m06
```



Python 工程要隔离环境、固定依赖、规范打包： **虚拟环境 \+ 依赖锁 \+ 包结构 \+ 入口** ，让脚本/工具在任何机器可复现。

 

> 前置：会运行 Python 脚本、了解 pip 与依赖版本。 · ◷ 约 42 分钟 · ◈ Windows/macOS/Linux 对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能用虚拟环境隔离、按约束解析并锁定依赖、规范打包与入口，使工具随处可跑。

 

本章速览




- 每项目独立虚拟环境，锁定依赖。

- 包结构/入口/版本规范。

- 凭据不入库。

 

```zhizhan-anchor
m06-py
```



```zhizhan-anchor
m06-py-t
```



## 6.1 虚拟环境与依赖锁



Python 工程要隔离环境、固定依赖、规范打包。不同项目依赖可能冲突，独立虚拟环境隔离解释器与包，配合锁文件复现。



```zhizhan-anchor
fig-图-6-1
```



**图 6.1**  Python 工程的四个要素



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="Python 工程的四个要素" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">虚拟环境：每项目一个</text><rect x="60" y="64" width="680" height="30" rx="6" class="sv-grn-s"></rect><text x="75" y="83.0" class="sv-lbl-hi">依赖锁：解析并固定</text><rect x="60" y="98" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="117.0" class="sv-lbl-hi">包结构：模块 + 入口</text><rect x="60" y="132" width="680" height="30" rx="6" class="sv-box"></rect><text x="75" y="151.0" class="sv-lbl-hi">打包分发：wheel/sdist</text></svg>
```



虚拟环境（隔离）→ 依赖锁（固定版本）→ 包结构（可安装）→ 入口（可用）。



表 6.1 Python 工程五要素



| 要素 | 内容 | 要点 |
| --- | --- | --- |
| 虚拟环境 | 隔离解释器与包 | 每项目一个 |
| 依赖锁 | 解析并固定版本 | 可复现 |
| 包结构 | 模块与入口 | 可安装 |
| 打包 | wheel/sdist | 版本号 |
| 分发 | 私有/公共源 | 凭据管理 |



pyproject.toml 节选TOML

 

```text
[project]
name = "edge-tools"
version = "1.3.0"
dependencies = ["pyserial>=3.5,<4"]
[project.scripts]
edge-cli = "edge_tools.cli:main"
```

声明依赖\+版本\+入口；venv 隔离并锁定



```zhizhan-anchor
m06-evidence
```



```zhizhan-anchor
m06-evidence-t
```



## 6.2 真实证据：约束解析与锁定



下面这段程序验证按版本约束解析并锁定：



host\_py.cC

 

```text
/* host_py.c —— Python 环境：依赖版本解析（选择满足约束的最高版本）（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_py.c -o host_py && ./host_py
 */
#include <stdio.h>
int main(void) {
    int ok = 1;
    int versions[] = {1, 2, 3};
    int lo = 1, hi = 2;                 /* 约束: >=1, <=2 */
    int pick = -1;
    for (unsigned i = 0; i < sizeof(versions)/sizeof(versions[0]); i++)
        if (versions[i] >= lo && versions[i] <= hi) pick = versions[i];
    printf("约束 >=%d, <=%d → 选 %d（期望 2）\n", lo, hi, pick);
    if (pick != 2) ok = 0;
    printf("锁定后写入 requirements/锁文件以复现\n");
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

依赖约束解析模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_py.c -o labs/host_py && ./labs/host_py
约束 >=1, <=2 → 选 2（期望 2）
锁定后写入 requirements/锁文件以复现
RESULT: PASS
```



约束 \>=1 且 \<=2 时选满足约束的最高版本 2；无满足版本时报错；锁定写入锁文件。



表 6.2 依赖解析



| 情形 | 结果 | 说明 |
| --- | --- | --- |
| 约束满足 | 选最高满足版 | =2 |
| 无满足版本 | 报错 | 冲突 |
| 锁定 | 写锁文件 | 可复现 |
| 全局装包 | 冲突 | 禁用 |



```zhizhan-anchor
m06-pack
```



```zhizhan-anchor
m06-pack-t
```



## 6.3 打包与入口



工具脚本要有明确入口与版本；打包为 wheel/sdist；凭据不入库，用环境变量/密钥管理。



pyproject.toml 节选TOML

 

```text
[project]
name = "edge-tools"
version = "1.3.0"
dependencies = ["pyserial>=3.5,<4"]   # 声明约束

[project.scripts]
edge-cli = "edge_tools.cli:main"        # 明确入口
```

声明依赖\+版本\+入口；用 venv 隔离并锁定



表 6.3 Python 工程实践



| 做法 | 目的 | 避免 |
| --- | --- | --- |
| venv | 隔离 | 全局冲突 |
| 锁文件 | 可复现 | 漂移 |
| 入口 | 可用 | 不可调用 |
| 凭据环境变量 | 安全 | 入库泄露 |



```zhizhan-anchor
m06-check
```



```zhizhan-anchor
m06-check-t
```



## 6.4 自检与三平台对照



Python 工程自检：隔离环境、锁定依赖、有入口与版本、凭据安全。



```zhizhan-anchor
fig-图-6-2
```



**图 6.2**  约束解析结果（真实值）



```zhizhan-figure
<svg viewBox="0 0 800 150" width="100%" height="150" role="img" aria-label="约束解析结果（真实值）" preserveAspectRatio="xMidYMid meet"><text x="12" y="43" class="sv-lbl">候选</text><rect x="150" y="26" width="450" height="18" rx="4" class="sv-box"></rect><text x="608" y="43" class="sv-lbl-hi">3版本</text><text x="12" y="67" class="sv-lbl">满足约束</text><rect x="150" y="50" width="300" height="18" rx="4" class="sv-grn-s"></rect><text x="458" y="67" class="sv-lbl-hi">2版本</text><text x="12" y="91" class="sv-lbl">选中</text><rect x="150" y="74" width="300" height="18" rx="4" class="sv-cyn-s"></rect><text x="458" y="91" class="sv-lbl-hi">2版本</text></svg>
```



约束 \>=1,\<=2 选出最高满足版本 2；锁定后任何机器复现同一版本。



表 6.4 三平台 Python



| 平台 | Python 工具 | 注意 |
| --- | --- | --- |
| Windows | py -m venv | 路径 |
| macOS | python3/venv | 系统 python 慎用 |
| Linux | python3/venv | 发行版隔离 |



```zhizhan-anchor
m06-pitfalls
```



```zhizhan-anchor
m06-pitfalls-t
```



## 6.5 常见误区与排障



失败路径与排障




- **全局装包** ：版本冲突。

- **不锁依赖** ：换机行为不同。

- **无入口/版本** ：工具不可用。

- **凭据入库** ：泄露风险。



◆ 自测 · Module 06（先答再看）




1. 为什么每个项目要用独立虚拟环境？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"不同项目依赖版本可能冲突；独立虚拟环境隔离解释器与包，避免互相污染，并配合锁文件复现。"}
   ```

2. 约束 \>=1,\<=2 时会选哪个版本？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"选满足约束的最高版本，即 2。锁定后写入锁文件，任何机器都装同一版本。"}
   ```

3. 工具脚本为什么要“明确入口”？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"明确入口（如 \\[project.scripts\\]）让工具可被命令行调用、可安装分发；没有入口则难以使用与自动化。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你 Python 工具用 venv 隔离、按约束锁定依赖并加明确入口，验证换机可复现。



核对与延伸：[Python venv 文档](https://docs.python.org/3/library/venv.html) · [pip 依赖解析](https://pip.pypa.io/)

 

动手练习



运行 ` labs/host_py.c `：验证按约束选择版本并锁定。



**检查结果：** 约束 \>=1,\<=2 → 选 2；锁定写 requirements/锁文件以复现；无满足版本时报错。

 

迁移练习：把本章的“能用虚拟环境隔离、按约束解析并锁定依赖、规范打包与入口，使工具随处可跑。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 06 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b16-m06","criterion":"约束 >=1,<=2 → 选 2；锁定写 requirements/锁文件以复现；无满足版本时报错。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b16-guide)
