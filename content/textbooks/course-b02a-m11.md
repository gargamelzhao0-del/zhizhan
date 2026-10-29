# 泛型、接口与现代 C++

```zhizhan-anchor
m11
```



用约束表达接口要求，并维护 span/string\_view 的生命周期。



> 前置：本册前面的类型、函数与资源管理 · 阅读约 15–25 分钟；实践约 30–60 分钟（规划估计）



视图不拥有数据，也不延长存储生命



```zhizhan-figure
<svg viewBox="0 0 800 190" role="img" aria-label="视图不拥有数据，也不延长存储生命"><title>视图不拥有数据，也不延长存储生命</title><defs><marker id="mastery-arrow-cpp-view" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10" fill="currentColor"></path></marker></defs><rect x="10" y="20" width="245" height="145" rx="8" fill="none" stroke="currentColor" opacity=".6"></rect><text x="132.5" y="49" text-anchor="middle" fill="currentColor" font-size="14">拥有者</text><text x="132.5" y="79" text-anchor="middle" fill="currentColor" font-size="14">Buffer / vector / string</text><text x="132.5" y="109" text-anchor="middle" fill="currentColor" font-size="14">负责分配与释放</text><text x="132.5" y="139" text-anchor="middle" fill="currentColor" font-size="14">决定存储是否迁移</text><path d="M257 92H272" stroke="currentColor" marker-end="url(#mastery-arrow-cpp-view)"></path><rect x="275" y="20" width="245" height="145" rx="8" fill="none" stroke="currentColor" opacity=".6"></rect><text x="397.5" y="49" text-anchor="middle" fill="currentColor" font-size="14">非拥有视图</text><text x="397.5" y="79" text-anchor="middle" fill="currentColor" font-size="14">span / string_view</text><text x="397.5" y="109" text-anchor="middle" fill="currentColor" font-size="14">地址与长度</text><text x="397.5" y="139" text-anchor="middle" fill="currentColor" font-size="14">只读也依赖生命</text><path d="M522 92H537" stroke="currentColor" marker-end="url(#mastery-arrow-cpp-view)"></path><rect x="540" y="20" width="245" height="145" rx="8" fill="none" stroke="currentColor" opacity=".6"></rect><text x="662.5" y="49" text-anchor="middle" fill="currentColor" font-size="14">使用条件</text><text x="662.5" y="79" text-anchor="middle" fill="currentColor" font-size="14">拥有者仍存活</text><text x="662.5" y="109" text-anchor="middle" fill="currentColor" font-size="14">存储位置保持稳定</text><text x="662.5" y="139" text-anchor="middle" fill="currentColor" font-size="14">释放/重分配后禁用</text></svg>
```



只读与[所有权](term:ownership)是不同维度。不是每次移动都会迁移底层数据；按对象的具体契约判断视图是否仍有效。

 

```zhizhan-anchor
m11-mechanism
```



## 机制与契约



模板使接口复用类型，concepts 使可接受类型直接写在声明中。本例 mean 只接受浮点元素，空输入通过异常通道报告。span 是指针与长度组成的非拥有视图，不复制元素也不延长原对象生命；容器销毁或重新分配会使视图失效。string\_view 同样不能拥有临时字符串。接口文档要写清谁拥有数据、调用期间能否修改、错误怎样返回。



关键片段 · 完整可运行项目见下方源码



```text
template<std::floating_point T>
T mean(std::span<const T> values);
// 视图使用期间，拥有者必须仍存活且存储位置稳定。
```

 

```zhizhan-anchor
m11-boundary
```



## 边界与误用



return span(local\_vector) 会留下悬空视图；只读视图也会悬空。本章用 C\+\+20；旧工具链需选相应替代接口。异常关闭的嵌入式项目应另设计显式错误结果，不能直接复制 throw。

 

```zhizhan-anchor
m11-run
```



## 运行完整示例



在本册目录运行。Windows 的可执行文件可用 ` .\名称.exe `；下方 ` ./名称 ` 适用于 POSIX shell。命令只构建主机实验；目标板项目另行记录。



```text
g++ -std=c++20 -Wall -Wextra -Werror -O2 labs/values.cpp -o values
./values
```



完整源码：[labs/values.cpp](textbook-file:b02a/labs/values.cpp)

 

动手与迁移



运行 mean 正常与空输入测试；尝试 mean\<int\>，确认约束在编译期拒绝。把接口改成显式错误结果，写出收益与成本。



**验收：** 非法类型不能实例化；空输入有错误通道；视图不越过拥有者生命周期；标准与异常政策明确。

 

先预测，再运行



span\<const T\> 是否保证数据永久有效？



```zhizhan-details
{"title":"查看推理","body":"const 限制经视图修改元素，不管理存储生命。拥有者仍可能销毁、移动或重新分配，调用者必须维护生命和稳定性。"}
```



核对来源：[C\+\+ 工作草案 · 生命周期、容器与视图（按 C\+\+20 示例核对）](https://eel.is/c++draft/)

 





```zhizhan-assessment
{"id":"course-b02a-m11","criterion":"用约束清楚的模板替换后端；错误类型在调用边界可诊断。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b02a-guide)
