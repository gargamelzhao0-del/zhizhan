# 数据契约、回放与实验复现

```zhizhan-anchor
m08
```



让 MCU 与 Python 用同一数据契约回放并按容差对拍。



> 前置：本册前面的类型、函数与资源管理 · 阅读约 15–25 分钟；实践约 30–60 分钟（规划估计）



同一输入、同一舍入政策，才能比较实现



```zhizhan-figure
<svg viewBox="0 0 800 190" role="img" aria-label="同一输入、同一舍入政策，才能比较实现"><title>同一输入、同一舍入政策，才能比较实现</title><defs><marker id="mastery-arrow-data-replay" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10" fill="currentColor"></path></marker></defs><rect x="10" y="20" width="245" height="145" rx="8" fill="none" stroke="currentColor" opacity=".6"></rect><text x="132.5" y="49" text-anchor="middle" fill="currentColor" font-size="14">固定原始输入</text><text x="132.5" y="79" text-anchor="middle" fill="currentColor" font-size="14">Q15: -1 × 16384</text><text x="132.5" y="109" text-anchor="middle" fill="currentColor" font-size="14">保存单位/版本/质量</text><text x="132.5" y="139" text-anchor="middle" fill="currentColor" font-size="14">不分别重新采样</text><path d="M257 92H272" stroke="currentColor" marker-end="url(#mastery-arrow-data-replay)"></path><rect x="275" y="20" width="245" height="145" rx="8" fill="none" stroke="currentColor" opacity=".6"></rect><text x="397.5" y="49" text-anchor="middle" fill="currentColor" font-size="14">两端独立计算</text><text x="397.5" y="79" text-anchor="middle" fill="currentColor" font-size="14">C整数除法向零：0</text><text x="397.5" y="109" text-anchor="middle" fill="currentColor" font-size="14">Python显式匹配：0</text><text x="397.5" y="139" text-anchor="middle" fill="currentColor" font-size="14">直接用 // 会得 -1</text><path d="M522 92H537" stroke="currentColor" marker-end="url(#mastery-arrow-data-replay)"></path><rect x="540" y="20" width="245" height="145" rx="8" fill="none" stroke="currentColor" opacity=".6"></rect><text x="662.5" y="49" text-anchor="middle" fill="currentColor" font-size="14">对拍与诊断</text><text x="662.5" y="79" text-anchor="middle" fill="currentColor" font-size="14">整数结果精确一致</text><text x="662.5" y="109" text-anchor="middle" fill="currentColor" font-size="14">浮点用声明容差</text><text x="662.5" y="139" text-anchor="middle" fill="currentColor" font-size="14">区分算法与输入差异</text></svg>
```



replay.py 对拍端点、向零截断与饱和。原始输入一致才能把差异归因到实现或参数。

 

```zhizhan-anchor
m08-mechanism
```



## 机制与契约



数据契约至少包含版本、会话、时刻、序号、单位、原始值、质量与参数版本。保留原始输入，再保存处理结果；修订参数后可以用同一输入解释差异。定点对拍必须约定缩放、饱和和舍入：Python // 对负数向下取整，而 C11 整数除法向零截断，本例先取绝对值再恢复符号来匹配 C。比较整数算法应精确一致，浮点算法用声明的绝对/相对容差。



关键片段 · 完整可运行项目见下方源码



```text
product=a*b
value=abs(product)//32768
if product<0: value=-value
value=max(-32768,min(32767,value))
```

 

```zhizhan-anchor
m08-boundary
```



## 边界与误用



直接用 Python 的负数 // 或任意 round 会制造两端差异。把丢样补成正常零值会使回放掩盖故障。时间排序、重复和单位校验可复用 B04a datatool；长期日志还需加入标定与固件版本。

 

```zhizhan-anchor
m08-run
```



## 运行完整示例



在本册目录运行。Windows 的可执行文件可用 ` .\名称.exe `；下方 ` ./名称 ` 适用于 POSIX shell。命令只构建主机实验；目标板项目另行记录。



```text
python labs/replay.py
```



完整源码：[labs/replay.py](textbook-file:b04/labs/replay.py)

 

动手与迁移



运行 replay.py；用 B23 的 C Q15 实现处理同样四组端点，并核对每个结果。增加错误范围和传感器无效记录。



**验收：** 端点与向零截断一致；非法 Q15 输入被拒；会话、单位、时基与参数版本可追溯；异常记录不会伪装成正常采样。

 

先预测，再运行



为什么对拍需要同一份原始数据，而不是两次分别采集？



```zhizhan-details
{"title":"查看推理","body":"两次采集的噪声、时刻和物理条件不同，会把输入差异误判成实现差异。同一输入才能隔离算法与参数的影响。"}
```



核对来源：[Python 3.13 官方标准库文档](https://docs.python.org/3.13/library/)

 





```zhizhan-assessment
{"id":"course-b04-m08","criterion":"同一原始文件和版本参数可复现结果；数据缺失、重排与时钟回绕被显式处理。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b04-guide)
