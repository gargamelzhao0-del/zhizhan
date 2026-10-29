# 测试、CLI 与综合项目

```zhizhan-anchor
m12
```



交付具有稳定退出码与边界测试的数据 CLI。



> 前置：本册前面的类型、函数与资源管理 · 阅读约 15–25 分钟；实践约 30–60 分钟（规划估计）

 

```zhizhan-anchor
m12-mechanism
```



## 机制与契约



CLI 是可被人和自动化系统调用的接口：成功信息写 stdout，错误诊断写 stderr，失败返回非零退出码。argparse 负责参数形式，核心 load 独立处理数据语义；这样测试不必每次模拟终端。临时文件测试正常、非法、空和缺失输入，异步测试验证取消清理。mock 验证调用与恢复机制，不能替代真实设备兼容性。



关键片段 · 完整可运行项目见下方源码



```text
try:
    records = load(args.input)
except (OSError, ValueError) as error:
    print(error, file=sys.stderr)
    return 2
```

 

```zhizhan-anchor
m12-boundary
```



## 边界与误用



不应捕获所有异常然后打印“成功”；测试只重复实现公式也不足。选择外部可观察契约：输出、退出码、文件、资源关闭和错误输入。

 

```zhizhan-anchor
m12-run
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



运行 unittest；新增超长数值、乱序时间、坏表头和独立进程 CLI 测试；交付一份固定 CSV 与结果说明。



**验收：** 正常和失败路径可复跑；输出单位明确；任务资源被释放；新环境按命令能启动工具。

 

先预测，再运行



为什么数据层不直接调用 sys.exit？



```zhizhan-details
{"title":"查看推理","body":"库应向调用者返回或抛出可处理错误；只有 CLI 边界负责进程退出，这样同一核心能被界面、测试和其他服务复用。"}
```



核对来源：[Python 3.13 官方标准库文档](https://docs.python.org/3.13/library/)

 





```zhizhan-assessment
{"id":"course-b04a-m12","criterion":"CLI 的 stdout/stderr/退出码有契约；手算数据、坏输入及取消场景均有测试。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b04a-guide)
