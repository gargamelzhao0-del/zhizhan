# 标准库与可靠 IO

```zhizhan-anchor
m10
```



使用标准库处理有契约的数据和可靠 IO。



> 前置：本册前面的类型、函数与资源管理 · 阅读约 15–25 分钟；实践约 30–60 分钟（规划估计）

 

```zhizhan-anchor
m10-mechanism
```



## 机制与契约



CSV 每行至少约定 schema、session、seq、time\_s、unit、value。load 先校验完整表头，再校验版本、单位、整数序号、有限数和同会话时序；失败包含行号。with 确保资源释放，但不能替你判断内容正确。Path 管理路径，csv/json 管理格式，struct 管理字节布局；读二进制前先约定字节序、位宽和长度上限。调用外部程序优先传参数列表并声明超时、退出码和文本编码。



关键片段 · 完整可运行项目见下方源码



```text
with path.open(encoding="utf-8", newline="") as stream:
    reader = csv.DictReader(stream)
    # 验证字段、单位、数值和顺序后才保存记录。
```

 

```zhizhan-anchor
m10-boundary
```



## 边界与误用



把非法读数转为 0 会污染统计；平均值在空数据上没有定义。混合会话、单位或时基时先统一契约；不要对错误数据继续算出看似精确的结果。

 

```zhizhan-anchor
m10-run
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



运行数据测试，加入错误单位、NaN、重复序号和空文件；对一个文件错误说明在哪个层发生。



**验收：** 四类错误被拒绝；缺文件错误退出 2；合法 20/30°C 数据平均 25°C；会话与时基保留。

 

先预测，再运行



为什么文件能打开不代表数据可信？



```zhizhan-details
{"title":"查看推理","body":"IO 成功只说明取得了字节；格式、schema、单位、范围、时序与来源仍是独立条件，须在计算前验证。"}
```



核对来源：[Python 3.13 官方标准库文档](https://docs.python.org/3.13/library/)

 





```zhizhan-assessment
{"id":"course-b04a-m10","criterion":"检查路径、编码、日期与临时文件生命；可靠 IO 不吞掉异常。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b04a-guide)
