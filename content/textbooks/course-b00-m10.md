# 标准库、输入解析与错误处理

```zhizhan-anchor
m10
```



把文本转换成经过校验的数值，失败时不污染调用者数据。



> 前置：本册前面的类型、函数与资源管理 · 阅读约 15–25 分钟；实践约 30–60 分钟（规划估计）

 

```zhizhan-anchor
m10-mechanism
```



## 机制与契约



输入解析的关键是知道函数到底消费了什么。strtol 同时返回数值并通过 end 返回停止位置；只看返回的 0 无法区分合法零与解析失败。先清 errno，再检查没有消费字符、残留字符、ERANGE 和 int 的上下界。只有全部通过才更新输出。示例接受前导空白和符号，拒绝尾部空白与小数；这是接口政策，而不是所有解析器的统一要求。文件 IO 则要分别检查打开、读取和关闭结果，保留错误发生的位置。



关键片段 · 完整可运行项目见下方源码



```text
errno = 0;
long v = strtol(text, &end, 10);
if (end == text || *end || errno == ERANGE || v < INT_MIN || v > INT_MAX) return 0;
*result = (int)v;
```

 

```zhizhan-anchor
m10-boundary
```



## 边界与误用



atoi 没有可靠的失败通道；scanf 的成功次数不等于整个输入满足你的格式。不要在失败时把结果改成 0，以免把错误伪装成正常读数。日志应写输入位置和失败类别，避免直接输出不受控的超长输入。

 

```zhizhan-anchor
m10-run
```



## 运行完整示例



在本册目录运行。Windows 的可执行文件可用 ` .\名称.exe `；下方 ` ./名称 ` 适用于 POSIX shell。命令只构建主机实验；目标板项目另行记录。



```text
gcc -std=c11 -Wall -Wextra -Werror -O2 labs/sampler.c labs/sampler_test.c -o sampler_test
./sampler_test
gcc -std=c11 -Wall -Wextra -Werror -O2 labs/sampler.c labs/sampler_cli.c -o sampler_cli
./sampler_cli 10 20 30
```



完整源码：[labs/sampler.h](textbook-file:b00/labs/sampler.h) · [labs/sampler.c](textbook-file:b00/labs/sampler.c) · [labs/sampler\_test.c](textbook-file:b00/labs/sampler_test.c) · [labs/sampler\_cli.c](textbook-file:b00/labs/sampler_cli.c)

 

动手与迁移



运行解析测试；再给 CLI 输入 0、-12、12x、空字符串和一个超出 long 的数字。先预测退出码，后看输出。



**验收：** 合法输入给正确值；非法输入返回失败且保留旧输出；CLI 正常退出 0、失败退出 2。

 

先预测，再运行



为什么需要同时检查 end==text、\*end 和 errno？



```zhizhan-details
{"title":"查看推理","body":"它们分别识别没有数字、只消费前缀和数值范围溢出。再检查 int 范围，才能安全缩窄类型。缺少任一项都会接受某类非法输入。"}
```



核对来源：[C11 委员会草案 N1570 · 7.22/7.21](https://www.open-std.org/jtc1/sc22/wg14/www/docs/n1570.pdf)

 





```zhizhan-assessment
{"id":"course-b00-m10","criterion":"用 strtol/范围检查解析输入；区分空输入、尾随垃圾、溢出与合法零。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b00-guide)
