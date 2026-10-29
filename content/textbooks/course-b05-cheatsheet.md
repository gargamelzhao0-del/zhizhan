# 外设驱动易错点速查

```zhizhan-anchor
cheatsheet
```



把“寄存器写了不动 / 中断丢 / [DMA](term:dma) 旧数据 / 总线 NAK”的点集中在一张表里，遇到问题先对照。

 

把最容易“代码对却不出结果”的点集中在一张表里。遇到问题先在这里对照。



| 易错点 | STM32F103 | ESP32 | STM32H7 | 典型后果 |
| --- | --- | --- | --- | --- |
| 外设时钟 | RCC\_APBxENR 逐外设开 | 多数默认开 / DPORT | 按域 AHBx/APBxENR | 外设完全不动 |
| GPIO 位宽 | 4 位 nibble (CRL/CRH) | IO\_MUX \+ Matrix | 2 位/引脚 (MODER) | 方向/复用配错 |
| 电平翻转 | BSRR 单次写 | OUT\_W1TS/W1TC | BSRR 单次写 | 读改写与中断打架 |
| 中断清标志 | 写 1 清 (EXTI\_PR) | 用 IDF API | 写 1 清 | 中断只进一次 |
| 串口寄存器 | SR / DR | FIFO / STATUS | ISR·ICR / RDR·TDR | 读错寄存器、丢数据 |
| [I²C](term:i2c) 模型 | CR1/SR1/SR2 轮询 | command link | TIMINGR \+ ISR | 状态机卡死 |
| DMA 一致性 | 无 cache | 无 cache(S2/S3 有) | 必须 clean/invalidate | 读到旧数据 |
| 复位原因 | RCC\_CSR \+ RMVF | esp\_reset\_reason() | RCC\_RSR | 复位原因误判 |
| 波特率 | BRR=时钟/波特率 | CLKDIV=APB/波特率 | BRR（同 F1 格式） | 误差大、错位 |
| Flash 提交 | 只清位(1→0) | [NVS](term:nvs) 封装 | 只清位(1→0) | 掉电得到半条记录 |


---

[本册导读、实验资料与完整学习规划](doc:course-b05-guide)
