# 驱动调试

```zhizhan-anchor
m10
```



驱动调试有固定顺序： **看日志 → 看 sysfs/debugfs → 动态调试/跟踪 → 现场保留** 。sysfs 属性是对外接口也是调试窗口；dev\_dbg 可运行期动态开启，避免重编。

 

> 前置：Module 02 字符设备接口与 Module 05 probe。 · ◷ 约 42 分钟 · ◈ 三平台驱动对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能用 printk 等级、sysfs/debugfs、dynamic debug 与 ftrace 定位驱动的加载/probe/时序问题。

 

本章速览




- 调试顺序：先确认 probe，再看状态，再 ftrace 抓时序，最后分析 oops。

- dynamic debug 精确开日志；调试节点读不改变状态。

- 崩溃先看 oops 调用栈与地址，再 addr2line 定位。

 

```zhizhan-anchor
m10-tools
```



```zhizhan-anchor
m10-tools-t
```



## 10.1 驱动调试的层次



驱动问题常见三类：加载/probe（看日志与 sysfs 绑定）、数据/接口（看返回值与 sysfs 属性）、时序/性能（用 ftrace/dynamic debug）。按这个顺序，别一上来就翻代码。



```zhizhan-anchor
fig-图-10-1
```



**图 10.1**  驱动调试的推荐顺序



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="驱动调试的推荐顺序" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">dmesg</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">sysfs/debugfs</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">dynamic debug/ftrace</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">pstore</text></svg>
```



dmesg 看加载/probe → sysfs/debugfs 看状态与绑定 → dynamic debug/ftrace 看时序 → 崩溃用 pstore 保留现场。



表 10.1 驱动调试手段



| 手段 | 看什么 | 场景 |
| --- | --- | --- |
| printk/dev\_err | 分级日志 | 加载/probe 失败 |
| sysfs | 对外属性/状态 | 运行时读写与状态 |
| debugfs | 调试专用（不进稳定 ABI） | 内部状态/统计 |
| dynamic debug | 运行期开 dev\_dbg | 免重编的细粒度日志 |
| ftrace | 函数/时序轨迹 | 时序/性能 |



```zhizhan-anchor
m10-evidence
```



```zhizhan-anchor
m10-evidence-t
```



## 10.2 真实证据：sysfs 属性的输入校验



sysfs 的 store 回调必须校验输入：合法则写、非法/越界返回 -EINVAL。下面把三种情况跑出来：



host\_sysfs.cC

 

```text
/* host_sysfs.c —— sysfs 属性的 show/store 模型（主机可运行）。
 *
 * 驱动常通过 sysfs 暴露参数：store 要严格解析与限幅，非法输入返回 -EINVAL；
 * show 要把内部状态格式化给用户。本程序验证往返与边界校验。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_sysfs.c -o host_sysfs && ./host_sysfs
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define EINVAL 22
static int g_threshold = 50;        /* 默认值 */

/* store：解析整数并限幅，越界/非法返回 -EINVAL */
static int attr_store(const char *s) {
    char *end = 0;
    long v = strtol(s, &end, 10);
    if (end == s || *end != '\0') return -EINVAL;      /* 非数字 */
    if (v < 0 || v > 100) return -EINVAL;              /* 越界 */
    g_threshold = (int)v;
    return 0;
}
/* show：把内部状态格式化 */
static int attr_show(char *buf, int n) { return snprintf(buf, n, "%d\n", g_threshold); }

int main(void) {
    int ok = 1;
    char buf[32];

    int r = attr_store("75");
    int len = attr_show(buf, sizeof(buf));
    printf("store(\"75\")=%d  show=\"%s\"（期望 0 与 75）\n", r, buf);
    if (!(r == 0 && g_threshold == 75 && strcmp(buf, "75\n") == 0 && len == 3)) ok = 0;

    printf("store(\"200\")=%d（期望 -%d，越界被拒）\n", attr_store("200"), EINVAL);
    if (attr_store("200") != -EINVAL) ok = 0;
    printf("store(\"abc\")=%d（期望 -%d，非数字被拒）\n", attr_store("abc"), EINVAL);
    if (attr_store("abc") != -EINVAL) ok = 0;

    if (g_threshold != 75) ok = 0;                     /* 非法输入不得改变状态 */

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

sysfs 属性读写与校验模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_sysfs.c -o labs/host_sysfs && ./labs/host_sysfs
store("75")=0  show="75
"（期望 0 与 75）
store("200")=-22（期望 -22，越界被拒）
store("abc")=-22（期望 -22，非数字被拒）
RESULT: PASS
```



sysfs 属性是“用户可写的接口”，越界（200）与非数字（abc）都必须被拒并返回 -EINVAL(-22)。



sysfs\_attr.c 节选C

 

```text
static ssize_t val_store(struct device *dev, struct device_attribute *a,
                         const char *buf, size_t n) {
    long v; if (kstrtol(buf, 10, &v)) return -EINVAL;   // 非数字
    if (v < 0 || v > 100) return -EINVAL;               // 越界
    data->val = v; return n;                            // 返回已消费字节数
}
static DEVICE_ATTR_RW(val);
```

sysfs store：解析→校验范围→写入→返回 n，非法一律 -EINVAL



```zhizhan-anchor
m10-debug
```



```zhizhan-anchor
m10-debug-t
```



## 10.3 dynamic debug 与 debugfs



` dev_dbg ` 默认不打印，可用  **dynamic debug**  在运行期按文件/函数/行开启，无需重编内核或驱动。需要暴露内部状态时用  **debugfs** （明确不是稳定 ABI）。



表 10.2 动态调试与 debugfs



| 用法 | 命令 | 说明 |
| --- | --- | --- |
| 开启某文件 | echo "file mydrv.c \+p" \> /sys/kernel/debug/dynamic\_debug/control | 运行期开 dev\_dbg |
| 开启整个模块 | echo "module mydrv \+p" \> .../dynamic\_debug/control | 模块级 |
| debugfs 挂载 | mount -t debugfs none /sys/kernel/debug | 暴露内部状态 |
| ftrace 函数跟踪 | echo function \> current\_tracer | 时序分析 |



sysfs 与 debugfs 的分工



**sysfs**  是稳定的对外接口（用户/脚本依赖），改动要谨慎； **debugfs**  是调试专用、可随时变动的内部窗口。别把调试状态放 sysfs 当稳定 ABI。



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm10-routes\n```\n\n\n\n```zhizhan-anchor\nm10-routes-t\n```\n\n\n\n## 10.4 三条内核路线对照：调试\n\n\n\n三条路线的调试接口一致（sysfs/debugfs/ftrace），差异在串口设备名与 ftrace 可用性。\n\n\n\n表 10.3 三条路线的调试入口\n\n\n\n| 内核路线 | console | ftrace | 说明 |\n| --- | --- | --- | --- |\n| STM32MP1 | ttySTM0 | 可用 | mainline |\n| i.MX6ULL | ttymxc0 | 可用 | BSP mainline |\n| V3s | ttyS0 | 可用 | sunxi |"}
````



```zhizhan-anchor
m10-trace
```



```zhizhan-anchor
m10-trace-t
```



## 10.5 跟踪与现场保留



时序/偶发问题靠“跟踪 \+ 现场保留”：dynamic debug 看细节，ftrace 看时序，pstore 留住崩溃前的日志。



```zhizhan-anchor
fig-图-10-2
```



**图 10.2**  偶发问题的定位链



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="偶发问题的定位链" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">复现</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">开跟踪</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">pstore 留存</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">复盘</text></svg>
```



复现难 → 打开 dynamic debug/ftrace 收集 → 崩溃留 pstore → 重启后取日志复盘。不要等现场消失才追。



表 10.4 跟踪手段速查



| 问题 | 手段 | 看什么 |
| --- | --- | --- |
| 偶发 probe 失败 | dynamic debug | probe 路径的分支日志 |
| 时序/抖动 | ftrace function\_graph | 函数耗时/调用链 |
| 崩溃 | pstore/ramoops | 上次 panic 日志 |
| 状态异常 | debugfs | 内部计数/状态 |



trace\_on.sh 节选Shell

 

```text
echo "module mydrv +p" > /sys/kernel/debug/dynamic_debug/control
echo function_graph > /sys/kernel/debug/tracing/current_tracer
cat /sys/fs/pstore/console-ramoops-0     # 上次崩溃日志
```

运行期开跟踪、崩溃后取现场



```zhizhan-anchor
m10-pitfalls
```



```zhizhan-anchor
m10-pitfalls-t
```



## 10.6 常见误区与排障



失败路径与排障




- **只看代码不抓日志** ：probe 失败的第一条错误在 dmesg 里。

- **sysfs store 不校验** ：非法输入破坏内部状态。

- **把 debugfs 当稳定接口** ：内核升级即失效。

- **忘记检查注册返回值** ：设备“注册成功”是假象。



◆ 自测 · Module 10（先答再看）




1. 驱动 probe 没进来，第一步看什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"看 ` dmesg ` 与该设备在 ` /sys/bus/.../devices ` 下的绑定状态：有无匹配记录、是否 deferred、是否 unbound。"}
   ```

2. sysfs 的 store 回调为什么必须校验输入？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"它是用户可写接口。越界/非法输入若不拒绝，会破坏驱动内部状态。合法返回 n，非法返回 -EINVAL。"}
   ```

3. sysfs 和 debugfs 有什么区别？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"sysfs 是稳定对外接口（用户依赖）；debugfs 是调试专用、非稳定 ABI，可随意变动。调试状态应放 debugfs。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：给你驱动补一个带范围校验的 sysfs 属性，并用 dynamic debug 打开 dev\_dbg 观察一次读写。



核对与延伸：[Linux 内核文档 · ftrace](https://www.kernel.org/doc/html/latest/trace/ftrace.html) · [LWN · 并发与锁](https://lwn.net/Kernel/Index/#Locking)

 

动手练习



运行 ` labs/host_sysfs.c `：验证 sysfs store 的返回值与越界/非法输入拒绝。



**检查结果：** store("75")=0 且 show 得 75；store("200") 与 store("abc") 均被拒（-EINVAL=-22）。

 

迁移练习：把本章的“能用 printk 等级、sysfs/debugfs、dynamic debug 与 ftrace 定位驱动的加载/probe/时序问题。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 10 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b10-m10","criterion":"store(\"75\")=0 且 show 得 75；store(\"200\") 与 store(\"abc\") 均被拒（-EINVAL=-22）。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b10-guide)
