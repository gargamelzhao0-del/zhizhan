# 环境、包与项目组织

```zhizhan-anchor
m09
```



把脚本整理成有独立环境、明确入口的可安装工具。



> 前置：本册前面的类型、函数与资源管理 · 阅读约 15–25 分钟；实践约 30–60 分钟（规划估计）

 

```zhizhan-anchor
m09-mechanism
```



## 机制与契约



虚拟环境隔离解释器与第三方包，包组织决定 import 路径。datatool 把数据契约、采集流程和 CLI 分开，pyproject 声明 Python\>=3.11 与命令入口。先在项目目录用 python -m datatool.cli，安装后再用 course-data。配置通过命令参数或明确文件传递，不能依赖作者机器的当前目录。示例运行只用标准库；安装构建工具是另一项环境准备。



关键片段 · 完整可运行项目见下方源码



```text
python -m venv .venv
# 激活方法依操作系统；也可直接运行 .venv 内的 python
python -m pip install .
python -m datatool.cli --help
```

 

```zhizhan-anchor
m09-boundary
```



## 边界与误用



同名脚本 json.py/csv.py 会遮蔽标准库；把 sys.path 写死为个人绝对路径不属于可交付安装方式。类型标注帮助检查接口，并不自动在运行时验证输入。

 

```zhizhan-anchor
m09-run
```



## 运行完整示例



在本册目录运行。Windows 的可执行文件可用 ` .\名称.exe `；下方 ` ./名称 ` 适用于 POSIX shell。命令只构建主机实验；目标板项目另行记录。



```text
cd labs/datatool
python -m unittest discover -s tests -v
python -m datatool.cli --help
```



完整源码：[labs/datatool/pyproject.toml](textbook-file:b04a/labs/datatool/pyproject.toml) · [labs/datatool/datatool/data.py](textbook-file:b04a/labs/datatool/datatool/data.py) · [labs/datatool/datatool/pipeline.py](textbook-file:b04a/labs/datatool/datatool/pipeline.py) · [labs/datatool/datatool/cli.py](textbook-file:b04a/labs/datatool/datatool/cli.py) · [labs/datatool/tests/test\_data.py](textbook-file:b04a/labs/datatool/tests/test_data.py)

 

动手与迁移



从新目录复制完整 datatool，建立环境并安装；运行 --help；说明源码执行和已安装命令的区别。



**验收：** 版本、入口和依赖明确；导入不依赖个人目录；未激活环境时也能解释使用的是哪个解释器。

 

先预测，再运行



为什么 python -m 包.模块 比随意执行包内某个文件更可靠？



```zhizhan-details
{"title":"查看推理","body":"它按包上下文解析导入；直接执行内部文件可能丢失包上下文，导致相对导入失败或意外导入错误模块。"}
```



核对来源：[Python · venv 与包装](https://docs.python.org/3.13/library/venv.html)

 





```zhizhan-assessment
{"id":"course-b04a-m09","criterion":"从另一目录安装并调用包，依赖版本和入口点可复现。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b04a-guide)
