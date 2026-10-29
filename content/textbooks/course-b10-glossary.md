# 术语表

```zhizhan-anchor
glossary
```



按“先定义、再结论”的方式收口；不同内核路线的叫法差异也一并标注。

 

按“先定义、再结论”的方式收口；不同内核路线的叫法差异也一并标注。



内核模块



可动态加载进内核的代码单元；有 init/exit、参数与引用计数。



file\_operations



字符设备操作集：open/read/write/ioctl 等回调。



主/次设备号



主设备号标识驱动，次设备号标识实例。



copy\_to/from\_user



内核与用户态之间安全拷贝数据的接口，可处理缺页。



原子上下文



不能睡眠的上下文（硬中断、软中断、持自旋锁时）。



自旋锁 / 互斥锁



自旋锁忙等且不可睡眠；互斥锁可睡眠。



死锁



多把锁获取顺序不一致形成等待环。



上半部 / 下半部



中断的紧急部分与延后处理部分。



tasklet / workqueue



两种下半部：前者不可睡眠，后者在内核线程可睡眠。



platform 总线



不可枚举的 SoC 外设的虚拟总线，靠设备树描述。



of\_match\_table



驱动的设备树匹配表，按 compatible 匹配。



EPROBE\_DEFER



依赖未就绪时返回，提示内核稍后重试 probe。



devm\_\*



设备资源管理，绑定设备生命周期自动释放。



regmap



统一的寄存器读写抽象，支持缓存与总线无关。



[DMA](term:dma) 一致性



带 cache 的 CPU 上，按传输方向 clean/invalidate cache。



runtime PM



运行时电源管理：引用计数决定设备 active/suspended。



子系统



同类设备的标准框架（IIO/input/hwmon/netdev/watchdog 等）。



DT binding



设备树的绑定文档，描述 compatible 与属性含义。



oops / panic



内核异常日志与致命错误；oops 含调用栈与出错地址。



dynamic debug



按文件/函数动态开关的调试日志机制。


---

[本册导读、实验资料与完整学习规划](doc:course-b10-guide)
