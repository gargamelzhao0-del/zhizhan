# 跟着做：一个迷你驱动库 minidrv

```zhizhan-anchor
minidrv
```



全册不是十个孤立的知识点。从 Module 02 起，我们用一个 **可编译、可测量** 的迷你驱动库 ` minidrv `， 把每节的新特性"接"进去；读完你手里是一套真正能用的 C\+\+ 驱动代码，而不是一堆片段。

 

◆ 怎么用这条主线

 

每进入一个模块，先花一分钟看它对应的"第 N 步"：这一步给 ` minidrv ` 加了什么、对应本节哪个代码块、以及一个 **你能自己动手验证的验收标准** 。 所有增量都能用与 ` b02/verify/compile.js ` 相同的参数编过： ` arm-none-eabi-g++ -mcpu=cortex-m3 -mthumb -Os -std=c++20 -fno-exceptions -fno-rtti `。

 

| 步 | 模块 | 给 minidrv 加什么（对应代码块） | 动手验收（自己量/测） |
| --- | --- | --- | --- |
| 0 | M01 | 基线：同一 UART\+CRC 的 C 版与 C\+\+ 版（` drv_c.c `/` drv_cpp.cpp `） | ` size ` 比对两者； **解释** 差的字节来自哪（发射口径，非"内联更好"） |
| 1 | M02 | 把 ` init/deinit ` 换成 RAII 类、禁拷贝（` gpio_raii.hpp `） | 删掉手写 ` deinit `，行为不变；看析构是否被内联 |
| 2 | M03 | CRC 表改 ` consteval ` 生成、落 ` .rodata `（` crc_table.cpp `） | ` size ` 确认 ` .bss=0 `、表在 Flash；对比运行期建表版 |
| 3 | M04 | UART 后端（阻塞/[DMA](term:dma)）做成策略模板（` uart_policy.cpp `） | 换后端不改上层；` nm --size-sort ` 看两份实例 |
| 4 | M05 | 报文固定块池 \+ ` unique_ptr ` 句柄（` fixed_pool.cpp `） | ` sizeof(句柄) ` 是否为 8；离开作用域是否自动归还 |
| 5 | M06 | ISR↔主循环用 release/acquire 交接（` double_buffer.cpp `） | 反汇编确认 ` dmb ` 在写 **前** ；M0 也编一次 |
| — | M07 | 横切：给单位/句柄加类型护栏（` unit.cpp `、` irq_flags.cpp `） | 故意传错单位，确认 **编译失败** 而非运行期出错 |
| 6 | M08 | 无锁环形缓冲：中断写、主循环读（` ring_spsc.cpp `） | 确认只用了单次 load/store；M0 上同样可用 |
| 7 | M09 | ` extern "C" ` 门面 \+ 混合链接 Makefile | 用 C 编译器编调用方，链接成功、符号落地 |
| 8 | M10 | 重构：concept 泛型 \+ 边界类型擦除（` display_erase.cpp `） | 热路径无反汇编 ` blx `；整镜像 ` size ` 不涨 |

 

✔ 为什么配"验收标准"

 

每一步都要求你 **自己量一次** ，因为它们能把你从"我以为懂了"推到"我量出来了"。 读懂原理只完成一半； **能预测、能测量、能排障** ，才算真的掌握。


---

[本册导读、实验资料与完整学习规划](doc:course-b02-guide)
