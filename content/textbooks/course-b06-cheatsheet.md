# RTOS 易错点速查

```zhizhan-anchor
cheatsheet
```



把“任务不响应 / 优先级反转 / ISR 死锁 / 时间漂移”的点集中在一张表里。

 

把“换一个内核就写错”的点集中在一张表里。遇到问题先在这里对照。



| 概念 | [FreeRTOS](term:rtos) | RT-Thread | Zephyr | 易错点 |
| --- | --- | --- | --- | --- |
| 创建任务 | xTaskCreate / Static | rt\_thread\_create/startup | k\_thread\_create / K\_THREAD\_DEFINE | 栈给太小 → 溢出 |
| 优先级方向 | 数值越大越高 | 数值越小越高 | 数值越小越高 | 语义相反，移植必改 |
| 互斥锁 | xSemaphoreCreateMutex | rt\_mutex\_create | k\_mutex\_init | 用二值信号量代替 → 反转 |
| 中断中同步 | \*FromISR \+ 唤醒标志 | rt\_interrupt\_enter/leave | k\_sem\_give / k\_sem\_take | ISR 调非 FromISR API |
| 临界区 | taskENTER\_CRITICAL(BASEPRI) | rt\_enter\_critical | irq\_lock | 临界区过长 → 响应抖动 |
| 周期延时 | vTaskDelayUntil | rt\_thread\_delay\_until | k\_timer / k\_msleep | 用 delay 做周期 → 漂移 |
| 系统节拍 | configTICK\_RATE\_HZ | RT\_TICK\_PER\_SECOND | CONFIG\_SYS\_CLOCK\_TICKS\_PER\_SEC | 精度与功耗权衡 |
| 内存 | heap\_1..5 / static | 内存池 / 堆 | 静态对象 \+ K\_HEAP | 动态分配碎片与不确定性 |
| 看门狗 | IWDG \+ 任务 wdt | WDT 设备 | wdt 驱动 | 在别处统一喂狗形同虚设 |
| 调试 | High Water Mark / trace | msh / list\_thread | shell / thread analyzer | 没有可观测性 → 靠猜 |


---

[本册导读、实验资料与完整学习规划](doc:course-b06-guide)
