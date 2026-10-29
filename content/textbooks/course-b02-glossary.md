# 术语与符号对照表

```zhizhan-anchor
glossary
```



本页是 B02 的 **单一事实源** ：` verify/glossary.json ` 与下表逐条比对， 两边漂移（少了/多了/写错）会在构建时 **直接失败** 。改术语/符号时，两处必须同步。

 

```zhizhan-anchor
glossary-terms
```



## 术语

 

| 术语 | 含义 |
| --- | --- |
| **RAII** | Resource Acquisition Is Initialization：构造获取资源、析构释放；任何正常离开作用域都触发析构，替掉易漏的 init/deinit 配对。 |
| **Rule of 0/3/5** | 不直接持有资源就不写（Rule of 0）；持有资源则析构\+拷贝构造\+拷贝赋值三者齐写或齐禁（Rule of 3）；再要移动就加移动构造/赋值（Rule of 5）。 |
| **移动语义** | 转移[所有权](term:ownership)而非复制：源对象交出资源后进入 valid-but-unspecified 状态。对句柄/缓冲只搬指针与长度。 |
| **constexpr** | 函数/变量"可以在编译期求值"（也可运行期）；被运行期引用时才实体化进 ` .rodata `。 |
| **consteval** | **必须** 在编译期求值，否则编译失败；适合强制"查找表绝不在运行时重算"。 |
| **constinit** | 要求变量做常量初始化，从而根本不存在跨 TU 的动态初始化顺序问题（SIOF）；不等于不可修改。 |
| **零开销抽象** | 抽象在运行期不产生额外指令/存储（如可内联的模板、无 vptr 的静态分派）；代价通常转移到代码体积。 |
| **实例化膨胀** | 模板/泛型为每种实参组合生成一份代码；用 ` --gc-sections ` 删未引用的、用 ` extern template ` 控制生成点。 |
| **CRTP** | 奇异递归模板模式：基类以派生类为模板参数，编译期静态分派、无 vptr 的"继承\+覆写"。 |
| **虚表** | 运行期多态的实现：每对象一个 ` vptr `，调用经间接跳转；关异常/RTTI 可减小体积。 |
| **标准布局** | standard-layout：布局与 C 兼容的充分前提（无虚函数、无访问控制混排等）；` offsetof ` 也仅对它有标准保证。 |
| **placement new** | 在给定的已有存储上调用构造函数；它 **不是 RAII** ，析构要显式调用，且同一存储上需先析构旧对象再构造新对象。 |

 

```zhizhan-anchor
glossary-symbols
```



## 符号 / 构件

 

| 符号 / 构件 | 类别 | 说明 |
| --- | --- | --- |
| ` vptr ` | 隐藏成员 | 含虚函数对象里的虚表指针；32 位 Cortex-M 上每对象 \+4 字节。 |
| ` .ARM.exidx ` | 只读段 | 表驱动异常模型的展开表；` -fexceptions ` 时出现，` size ` 计入 text。 |
| ` ldrex/strex ` | ARM 指令 | Cortex-M3\+ 的独占读/写，用于无锁读-改-写（如 atomic ` fetch_add `）。 |
| ` dmb ish ` | ARM 指令 | 数据内存屏障；release 在写 **前** 、acquire 在读 **后** 各一条。 |
| ` __libc_init_array ` | 函数（libc） | 启动期遍历 ` .init_array ` 调用 C\+\+ 全局构造；` -nostartfiles ` 时需在 ` Reset_Handler ` 显式调用。 |
| ` std::is_standard_layout_v ` | 类型特征 | 编译期判定类型是否标准布局，是 ` offsetof `/跨语言传结构体的前提。 |
| ` std::atomic ` | 标准库类型 | 原子类型；M3 上内联 ` ldrex/strex `，M0 上读-改-写走 ` __atomic_* ` 库调用。 |
| ` extern "C" ` | 链接约定 | 关闭名字修饰，生成 C 链接名；用于与 C/汇编互操作。 |
| ` __atomic_fetch_add_4 ` | 外部函数 | M0 上原子读-改-写退化成的库调用（需 ` libatomic `）。 |
| ` unique_ptr ` | 标准库类型 | 独占所有权智能指针；无状态删除器时与裸指针同宽（零开销）。 |
| ` -fno-exceptions ` | 编译选项 | 关闭异常；只作用于自有 C\+\+ 代码，预编译 ` libstdc++ ` 仍带异常。 |

 

维护提示：正文里新增的术语/符号若要进对照表，先登记到 ` verify/glossary.json `，再补本表——两处同步后构建才会通过。


---

[本册导读、实验资料与完整学习规划](doc:course-b02-guide)
