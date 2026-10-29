# 内核模块基础

```zhizhan-anchor
m01
```



内核模块是一段可动态加载进内核的代码：` module_init ` 注册、` module_exit ` 注销。它受  **vermagic**  与依赖约束，被  **引用计数** 保护。读懂这三点，就理解了所有驱动的共同底座。

 

> 前置：C 语言与 Linux 命令行；能编译并运行主机 C 程序（labs/host\_\*.c）。 · ◷ 约 42 分钟 · ◈ 三平台驱动对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能写出带 module\_init/exit、module\_param 与引用计数检查的可加载/卸载模块骨架。

 

本章速览




- 模块有 init/exit 与引用计数；ref\>0 不能卸载，重复 init 返回 -EBUSY。

- 用 module\_param 暴露配置，用 vermagic 校验内核版本。

- init 失败要把已注册资源回滚，成功路径与失败路径对称。

 

```zhizhan-anchor
m01-life
```



```zhizhan-anchor
m01-life-t
```



## 1.1 模块生命周期：init / exit / 引用计数



模块加载时内核调用 ` module_init ` 注册的资源，卸载时用 ` module_exit ` 一一注销。两者必须 **对称** ：init 里做了一半失败，要把已做的回滚；否则下次加载冲突。而“能不能卸载”由 **引用计数** 决定——还有使用者（ref\>0）时强行卸载会留下悬空指针。



```zhizhan-anchor
fig-图-1-1
```



**图 1.1**  模块的一生



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="模块的一生" preserveAspectRatio="xMidYMid meet"><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="var(--grn)"></path></marker><marker id="aha" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="var(--amb)"></path></marker></defs><rect x="20" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="88.0" y="66" text-anchor="middle" class="sv-lbl-hi">insmod</text><path d="M158,69 H174" class="sv-arrow"></path><rect x="176" y="44" width="136" height="50" rx="7" class="sv-cyn-s"></rect><text x="244.0" y="66" text-anchor="middle" class="sv-lbl-hi">init 注册</text><path d="M314,69 H330" class="sv-arrow"></path><rect x="332" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="400.0" y="66" text-anchor="middle" class="sv-lbl-hi">open/ref++</text><path d="M470,69 H486" class="sv-arrow"></path><rect x="488" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="556.0" y="66" text-anchor="middle" class="sv-lbl-hi">ref 归零</text><path d="M626,69 H642" class="sv-arrow"></path><rect x="644" y="44" width="136" height="50" rx="7" class="sv-box"></rect><text x="712.0" y="66" text-anchor="middle" class="sv-lbl-hi">rmmod/exit</text></svg>
```



insmod → init（注册资源）→ 可被打开（ref\+\+/ref--）→ 只有 ref 归零才允许 rmmod → exit 注销。任一环不自洽都会表现为“加载失败/卸载崩溃”。



```zhizhan-anchor
fig-图-1-2
```



**图 1.2**  模块状态与引用计数



```zhizhan-figure
<svg viewBox="0 0 800 160" width="100%" height="160" role="img" aria-label="模块状态与引用计数" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-box"></rect><text x="75" y="49.0" class="sv-lbl-hi">未加载 (0)</text><rect x="60" y="64" width="680" height="44" rx="6" class="sv-grn-s"></rect><text x="75" y="90.0" class="sv-lbl-hi">已加载 (1)，ref=N</text><rect x="60" y="112" width="680" height="30" rx="6" class="sv-red-s"></rect><text x="75" y="131.0" class="sv-lbl-hi">ref&gt;0：拒绝卸载 (-16)</text><rect x="60" y="146" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="165.0" class="sv-lbl-hi">ref=0：允许卸载</text></svg>
```



状态 0=未加载、1=已加载；ref=0 才允许卸载。重复加载返回 -EEXIST(-17)，ref\>0 卸载返回 -EBUSY(-16)。



表 1.1 模块的五要素



| 要素 | 作用 | 常见错误 |
| --- | --- | --- |
| init/exit | 注册/注销资源 | 注册失败却不回滚 |
| 引用计数 | open/close 增减 | ref\>0 时强行卸载 |
| module\_param | 启动期可配 | 类型/权限写错 |
| vermagic | 内核版本校验 | 跨版本直接 insmod |
| printk | 分级日志 | 在原子上下文里打印过多 |



```zhizhan-anchor
m01-evidence
```



```zhizhan-anchor
m01-evidence-t
```



## 1.2 真实证据：状态机与引用计数



下面这段主机程序把模块的状态与引用计数“跑一遍”，验证重复加载、拒绝卸载、归零卸载三种情形：



host\_module.cC

 

```text
/* host_module.c —— 内核模块生命周期与引用计数模型（主机可运行）。
 * 模块只能在内核里存在一份；init 注册、exit 注销；设备被打开时引用计数>0，此时不能卸载。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_module.c -o host_module && ./host_module
 */
#include <stdio.h>
#include <string.h>
static int g_loaded = 0, g_ref = 0, g_param = 0;
/* -EEXIST=17：模块已加载（重复加载）；-EBUSY=16：仍在使用不可卸载；-ENODEV=19：设备未就绪 */
static int mod_init(int param) { if (g_loaded) return -17; g_loaded = 1; g_param = param; return 0; }
static int mod_exit(void) { if (g_ref > 0) return -16; g_loaded = 0; return 0; }
static int dev_open(void) { if (!g_loaded) return -19; g_ref++; return 0; }
static int dev_release(void) { if (g_ref > 0) g_ref--; return 0; }
int main(void) {
    int ok = 1;
    printf("首次 init: %d（期望 0）\n", mod_init(7));
    printf("重复 init: %d（期望 -17，-EEXIST）\n", mod_init(7));
    printf("init=%d param=%d\n", g_loaded, g_param);
    if (!(g_loaded == 1 && g_param == 7)) ok = 0;
    dev_open(); dev_open();
    printf("两次 open 后 ref=%d\n", g_ref);
    if (g_ref != 2) ok = 0;
    printf("ref>0 时 exit: %d（期望 -16，拒绝卸载）\n", mod_exit());
    if (mod_exit() != -16) ok = 0;
    dev_release(); dev_release();
    printf("release 后 ref=%d，exit=%d（期望 0）\n", g_ref, mod_exit());
    if (!(g_ref == 0 && mod_exit() == 0 && g_loaded == 0)) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

模块生命周期与引用计数模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_module.c -o labs/host_module && ./labs/host_module
首次 init: 0（期望 0）
重复 init: -17（期望 -17，-EEXIST）
init=1 param=7
两次 open 后 ref=2
ref>0 时 exit: -16（期望 -16，拒绝卸载）
release 后 ref=0，exit=0（期望 0）
RESULT: PASS
```



重复加载返回 -EEXIST(-17)、ref\>0 卸载返回 -EBUSY(-16)——这两个负值就是内核给你的“拒绝”信号。



mymod.c 节选C

 

```text
static int __init mymod_init(void) { int r;
    r = register_device();          // 可能失败
    if (r) return r;                // 失败即返回，别继续注册
    r = register_irq();
    if (r) { unregister_device(); return r; }  // 回滚已做的
    pr_info("mymod: loaded\n");
    return 0;
}
module_init(mymod_init);
module_exit(mymod_exit);
```

init 里“失败即回滚”是模块稳定的第一纪律（负值即错误码）



```zhizhan-anchor
m01-param
```



```zhizhan-anchor
m01-param-t
```



## 1.3 参数、vermagic 与依赖



模块参数用 ` module_param ` 暴露给加载期；模块还带  **vermagic** （编译环境指纹）与依赖信息，版本不匹配会被内核直接拒绝——这正是“能编译但加载失败”的常见原因。



表 1.2 参数与版本约束



| 要素 | 作用 | 写法/命令 |
| --- | --- | --- |
| module\_param | 加载期可配参数 | module\_param(var, int, 0644) |
| vermagic | 内核版本校验 | modinfo mymod.ko 查看 |
| 依赖 | 符号依赖模块 | modprobe 自动加载 |
| 日志 | 分级打印 | pr\_info/pr\_err |



modinfo.txt 节选Text

 

```text
$ modinfo mymod.ko
filename:       /lib/modules/.../mymod.ko
vermagic:       6.1.0 SMP mod_unload ARMv7 p2v8
parm:           count:int
# 若 vermagic 与运行内核不符 → insmod: invalid module format
```

vermagic 是“编译环境指纹”，不匹配即拒绝加载



表 1.3 三条内核路线的模块加载



| 内核路线 | 模块格式 | 加载命令 | 说明 |
| --- | --- | --- | --- |
| STM32MP1 | .ko \+ modules.dep | modprobe / insmod | mainline 内核 |
| i.MX6ULL | .ko（厂商 BSP） | modprobe | 内核版本随 BSP |
| V3s | .ko（mainline sunxi） | modprobe | mainline 内核 |



```zhizhan-anchor
m01-err
```



```zhizhan-anchor
m01-err-t
```



## 1.4 错误码与加载自检



模块相关的返回值都有明确含义。记住几个常用的，排障时能一眼判断：



表 1.4 模块常见返回与现象



| 返回/现象 | 含义 | 处理 |
| --- | --- | --- |
| 0 | 成功 | — |
| -EEXIST(-17) | 已加载/资源冲突 | 先 rmmod 或改名字 |
| -EBUSY(-16) | 被占用，拒绝卸载 | 查 ref/使用者 |
| invalid module format | vermagic 不匹配 | 用匹配内核重编 |
| unknown symbol | 依赖未加载 | modprobe 或先加载依赖 |



module\_check.sh 节选Shell

 

```text
lsmod | grep mymod          # 是否已加载、引用计数
modinfo mymod.ko           # vermagic 与参数
dmesg | tail -20           # 加载失败的第一条错误
rmmod mymod                # 只有 ref=0 才成功
```

加载/卸载的自检四联



```zhizhan-anchor
m01-pitfalls
```



```zhizhan-anchor
m01-pitfalls-t
```



## 1.5 常见误区与排障



失败路径与排障




- **init 失败资源已注册却不注销** ：下次加载冲突。

- **忽略引用计数** ：rmmod 时仍在使用，内核崩溃。

- **跨版本直接 insmod** ：vermagic 不匹配，加载失败。

- **原子上下文里 printk 过多** ：拖慢中断。



◆ 自测 · Module 01（先答再看）




1. 为什么 rmmod 要在引用计数归零后才能成功？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"ref\\>0 说明还有打开的文件/使用者持有驱动资源；此时卸载会留下悬空指针与已释放资源，内核用引用计数保证安全卸载（返回 -EBUSY）。"}
   ```

2. 模块“能编译但加载失败”，先看什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"先看 ` vermagic ` 是否与运行内核一致（` dmesg ` 会提示 invalid module format），再看依赖模块是否已加载（modprobe 会自动解决，insmod 不会）。"}
   ```

3. module\_init 里注册了设备后又注册中断失败，应该怎么做？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"回滚已注册的设备（注销）再返回错误码。 **失败即回滚** 是模块稳定的第一纪律，否则残留下次加载会冲突。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：为你项目里的一个驱动模块补上“失败即回滚”的 init 与对称的 exit，并核对引用计数保护。



核对与延伸：[Linux 内核文档 · Driver API](https://www.kernel.org/doc/html/latest/driver-api/index.html)

 

动手练习



运行 ` labs/host_module.c `：验证重复 init、ref\>0 拒绝卸载、ref 归零后可卸载。



**检查结果：** 首次 init=0；重复 init=-17；两次 open 后 ref=2；ref\>0 时 exit=-16；release 后 ref=0 且 exit=0。

 

迁移练习：把本章的“能写出带 module\_init/exit、module\_param 与引用计数检查的可加载/卸载模块骨架。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 01 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b10-m01","criterion":"首次 init=0；重复 init=-17；两次 open 后 ref=2；ref>0 时 exit=-16；release 后 ref=0 且 exit=0。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b10-guide)
