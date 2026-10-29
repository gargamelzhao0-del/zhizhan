# 并发、异步与后台任务

```zhizhan-anchor
m11
```



建立有[背压](term:backpressure)且可以取消的采集任务。



> 前置：本册前面的类型、函数与资源管理 · 阅读约 15–25 分钟；实践约 30–60 分钟（规划估计）



有界采集：取消后等待清理完成



```zhizhan-figure
<svg viewBox="0 0 800 190" role="img" aria-label="有界采集：取消后等待清理完成"><title>有界采集：取消后等待清理完成</title><defs><marker id="mastery-arrow-python-cancel" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10" fill="currentColor"></path></marker></defs><rect x="10" y="20" width="245" height="145" rx="8" fill="none" stroke="currentColor" opacity=".6"></rect><text x="132.5" y="49" text-anchor="middle" fill="currentColor" font-size="14">生产者读取</text><text x="132.5" y="79" text-anchor="middle" fill="currentColor" font-size="14">await port.read()</text><text x="132.5" y="109" text-anchor="middle" fill="currentColor" font-size="14">queue容量=1</text><text x="132.5" y="139" text-anchor="middle" fill="currentColor" font-size="14">满时put等待</text><path d="M257 92H272" stroke="currentColor" marker-end="url(#mastery-arrow-python-cancel)"></path><rect x="275" y="20" width="245" height="145" rx="8" fill="none" stroke="currentColor" opacity=".6"></rect><text x="397.5" y="49" text-anchor="middle" fill="currentColor" font-size="14">调用者取消</text><text x="397.5" y="79" text-anchor="middle" fill="currentColor" font-size="14">task.cancel()</text><text x="397.5" y="109" text-anchor="middle" fill="currentColor" font-size="14">任务进入finally</text><text x="397.5" y="139" text-anchor="middle" fill="currentColor" font-size="14">await port.close()</text><path d="M522 92H537" stroke="currentColor" marker-end="url(#mastery-arrow-python-cancel)"></path><rect x="540" y="20" width="245" height="145" rx="8" fill="none" stroke="currentColor" opacity=".6"></rect><text x="662.5" y="49" text-anchor="middle" fill="currentColor" font-size="14">等待任务结束</text><text x="662.5" y="79" text-anchor="middle" fill="currentColor" font-size="14">await task</text><text x="662.5" y="109" text-anchor="middle" fill="currentColor" font-size="14">观察取消与清理</text><text x="662.5" y="139" text-anchor="middle" fill="currentColor" font-size="14">再释放其他依赖</text></svg>
```



测试在队列满时发起一次取消，确认 mock 端口关闭。真实串口、中途再次取消与关闭超时需按库和设备验证。

 

```zhizhan-anchor
m11-mechanism
```



## 机制与契约



采集—处理—存储的速度可能不同，队列把阶段解耦，但无界队列会把速度差变成不断增长的内存。有界 asyncio.Queue 满时 put 等待，生产者因此让出执行；需要预先选择等待、丢弃、降载的策略。collect 用 try/finally 关闭端口。取消调用必须等待任务结束，才知道清理已完成；只调用 cancel 后立即退出无法提供这个保障。



关键片段 · 完整可运行项目见下方源码



```text
task.cancel()
try:
    await task
except asyncio.CancelledError:
    pass  # collect 的 finally 已被执行
```

 

```zhizhan-anchor
m11-boundary
```



## 边界与误用



不能吞掉取消异常后无限循环；同步串口读或 CPU 大计算仍会阻塞事件循环。线程/进程适用条件不同，Python 不提供 MCU 硬实时保证。真实端口 close 是否可中断正在进行的 IO，要按库文档和实测确认。

 

```zhizhan-anchor
m11-run
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



运行队列满时取消测试；增加消费者故障场景，使生产者能被停止；统计队列最高水位与丢样策略。



**验收：** 队列容量有界；取消后 mock 端口关闭且任务结束；真实串口需要另验关闭与重连。

 

先预测，再运行



为什么 cancel 后还必须 await？



```zhizhan-details
{"title":"查看推理","body":"取消请求在后续调度点才生效；等待任务可以观察异常并确认 finally 清理完成，从而安全释放其依赖或退出进程。"}
```



核对来源：[Python · Task cancellation](https://docs.python.org/3.13/library/asyncio-task.html#task-cancellation)

 





```zhizhan-assessment
{"id":"course-b04a-m11","criterion":"后台采集取消后任务结束、端口关闭，阻塞队列不导致退出挂起。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b04a-guide)
