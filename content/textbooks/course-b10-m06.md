# 子系统：GPIO / pinctrl / clock / regulator

```zhizhan-anchor
m06
```



现代驱动不直接写寄存器，而是通过 **子系统 API** ：GPIO 用描述符、pinctrl 管复用、clock 管时钟、regulator 管电压。好处是跨 SoC 可移植，依赖关系被内核统一管理（deferred probe）。

 

> 前置：Module 05 platform probe 与资源获取。 · ◷ 约 44 分钟 · ◈ 三平台驱动对照 · ⚑ 主机模型；目标构建与测量按章验收 · 能力目标：能用描述符 GPIO 与时钟子系统 API 写出申请—设置—释放配对、访问前先使能时钟的驱动片段。



```zhizhan-anchor
m06-knowledge-boundary
```



### 资源生命周期是调用者的责任



gpiod\_put 后禁止使用描述符，不能依赖内核拒绝误用。移除设备时，先停止提交、同步中断与工作，再释放资源；devm 负责释放配对，不能替代异步访问的生命管理。实际模块的构建入口见 labs/Makefile；主机模型不是内核行为验证。

 

本章速览




- GPIO/pinctrl/clock/regulator 用子系统 API，跨 SoC 可移植且依赖可管理。

- 忘记使能时钟或配引脚复用，是“寄存器写了没用”的头号原因。

- 资源获取失败要区分 defer 与真错误；devm 自动释放。

 

```zhizhan-anchor
m06-why
```



```zhizhan-anchor
m06-why-t
```



## 6.1 为什么用子系统 API



直接写寄存器把驱动 **绑死在一块芯片** 上，还容易漏掉前置（时钟、引脚复用、电压）。子系统 API 把这些共性抽出来：GPIO 用描述符、pinctrl 配复用、clock 使能、regulator 设电压，驱动只调接口，跨 SoC 可移植。



表 6.1 四类子系统 API



| 子系统 | 典型 API | 注意 |
| --- | --- | --- |
| GPIO | gpiod\_get/set/direction | 活跃电平、错误处理 |
| pinctrl | devm\_pinctrl\_get/select\_state | 状态命名与 dts 对应 |
| clock | clk\_get/prepare\_enable | 使能与频率设置顺序 |
| regulator | regulator\_get/enable | 电压范围与上下电时序 |



```zhizhan-anchor
m06-evidence
```



```zhizhan-anchor
m06-evidence-t
```



## 6.2 真实证据：配对与访问保护



下面是资源状态机的教学模型，model\_ 前缀函数自行返回错误码。它不能验证 Linux GPIO API、设备树或 MMIO 的行为。真实驱动须检查 IS\_ERR/PTR\_ERR，并在释放前停止所有异步使用者：



host\_gpio.cC

 

```text
/* Host resource state machine only. model_* functions are NOT Linux APIs.
 * This model keeps an object alive after model_put to check logical misuse.
 * A real descriptor must never be used after gpiod_put. Real gpiod_get errors
 * use ERR_PTR/IS_ERR, not this model's NULL. MMIO with a disabled clock may
 * fault, hang, or behave differently on different SoCs. */
#include <stdio.h>
#include <string.h>

#define ENODEV 19    /* 资源不可用（未使能 / 已释放） */
#define ENOENT  2    /* 设备树中找不到该资源 */

typedef struct { int in_use; } gpio_desc;
typedef struct { int enabled; } clk;

static int g_led_value = 0;

/* 申请 GPIO 描述符：只有设备树里存在的名字才成功 */
static gpio_desc *model_gpiod_get(const char *name) {
    if (strcmp(name, "led") != 0) return 0;   /* 无此资源 */
    static gpio_desc d;
    d.in_use = 1;
    return &d;
}
/* 设置输出电平：未申请或已释放一律拒绝 */
static int model_gpiod_set_value(gpio_desc *d, int v) {
    if (!d || !d->in_use) return -ENODEV;     /* use-after-put 被拒 */
    g_led_value = v;
    return 0;
}
static void model_gpiod_put(gpio_desc *d) { if (d) d->in_use = 0; }

static int model_clk_prepare_enable(clk *c) { c->enabled = 1; return 0; }
static void model_clk_disable_unprepare(clk *c) { c->enabled = 0; }
/* 读外设寄存器：时钟未使能时访问非法 */
static int model_reg_read(clk *c) { return c->enabled ? 0 : -ENODEV; }

int main(void) {
    int ok = 1;
    gpio_desc *led = model_gpiod_get("led");
    clk uart = {0};

    printf("model_gpiod_get(\"led\")=%s\n", led ? "ok" : "NULL");
    if (!led) ok = 0;

    if (model_gpiod_set_value(led, 1) != 0) ok = 0;
    printf("model_gpiod_set_value(1) → value=%d\n", g_led_value);
    if (g_led_value != 1) ok = 0;

    printf("clk 未 enable 访问寄存器 → %d（期望 -%d）\n", model_reg_read(&uart), ENODEV);
    if (model_reg_read(&uart) != -ENODEV) ok = 0;

    model_clk_prepare_enable(&uart);
    printf("clk enable 后访问寄存器 → %d（期望 0）\n", model_reg_read(&uart));
    if (model_reg_read(&uart) != 0) ok = 0;
    model_clk_disable_unprepare(&uart);

    model_gpiod_put(led);
    printf("model_gpiod_put 后 set_value → %d（期望 -%d，use-after-put 被拒）\n",
           model_gpiod_set_value(led, 0), ENODEV);
    if (model_gpiod_set_value(led, 0) != -ENODEV) ok = 0;

    printf("model_gpiod_get(\"missing\")=%s → -%d\n",
           model_gpiod_get("missing") ? "ok" : "NULL", ENOENT);
    if (model_gpiod_get("missing") != 0) ok = 0;

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
```

GPIO 与时钟子系统配对模型（主机 gcc 真实编译运行）



真实运行



$



```text
$ gcc -std=c11 -Wall -Wextra -O2 labs/host_gpio.c -o labs/host_gpio && ./labs/host_gpio
model_gpiod_get("led")=ok
model_gpiod_set_value(1) → value=1
clk 未 enable 访问寄存器 → -19（期望 -19）
clk enable 后访问寄存器 → 0（期望 0）
model_gpiod_put 后 set_value → -19（期望 -19，use-after-put 被拒）
model_gpiod_get("missing")=NULL → -2

RESULT: PASS
```



这是主机模型自行返回的错误码。目标硬件未开时钟的访问后果依 SoC 而异；gpiod\_put 后禁止再用，内核不保证安全拒绝。



```zhizhan-anchor
fig-图-6-1
```



**图 6.1**  资源申请与释放的配对



```zhizhan-figure
<svg viewBox="0 0 800 132" width="100%" height="132" role="img" aria-label="资源申请与释放的配对" preserveAspectRatio="xMidYMid meet"><rect x="20" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="107.5" y="66" text-anchor="middle" class="sv-lbl-hi">pinctrl</text><path d="M197,69 H213" class="sv-arrow"></path><rect x="215" y="44" width="175" height="50" rx="7" class="sv-cyn-s"></rect><text x="302.5" y="66" text-anchor="middle" class="sv-lbl-hi">clk enable</text><path d="M392,69 H408" class="sv-arrow"></path><rect x="410" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="497.5" y="66" text-anchor="middle" class="sv-lbl-hi">gpio</text><path d="M587,69 H603" class="sv-arrow"></path><rect x="605" y="44" width="175" height="50" rx="7" class="sv-box"></rect><text x="692.5" y="66" text-anchor="middle" class="sv-lbl-hi">访问寄存器</text></svg>
```



probe：取 pinctrl → 取 clk → prepare\_enable → 取 gpio → 访问寄存器；remove：逆序 put/disable。用 devm\_\* 可自动逆序释放。



```zhizhan-anchor
fig-图-6-2
```



**图 6.2**  子系统依赖链：谁先就绪



```zhizhan-figure
<svg viewBox="0 0 800 170" width="100%" height="170" role="img" aria-label="子系统依赖链：谁先就绪" preserveAspectRatio="xMidYMid meet"><rect x="60" y="30" width="680" height="30" rx="6" class="sv-cyn-s"></rect><text x="75" y="49.0" class="sv-lbl-hi">pinctrl（引脚复用）</text><rect x="60" y="64" width="680" height="30" rx="6" class="sv-amb-s"></rect><text x="75" y="83.0" class="sv-lbl-hi">clock（时钟使能）</text><rect x="60" y="98" width="680" height="30" rx="6" class="sv-grn-s"></rect><text x="75" y="117.0" class="sv-lbl-hi">regulator（电压域）</text><rect x="60" y="132" width="680" height="48" rx="6" class="sv-box"></rect><text x="75" y="160.0" class="sv-lbl-hi">外设寄存器访问</text></svg>
```



引脚复用（pinctrl）与时钟（clk）、电压（regulator）必须先就绪，外设才能工作。只对依赖尚未就绪传播 -EPROBE\_DEFER；不存在资源、非法配置等错误不能一概延后重试。



```zhizhan-anchor
m06-detail
```



```zhizhan-anchor
m06-detail-t
```



## 6.3 GPIO 描述符、时钟与 regulator 的细节



GPIO 描述符 API 处理“活跃电平”（有些 LED 低电平点亮），比裸操作更安全；时钟要注意“先 prepare 后 enable”的顺序；regulator 要核对电压范围与上下电时序。



gpio\_clk.c 节选C

 

```text
struct gpio_desc *led = devm_gpiod_get(dev, "led", GPIOD_OUT_LOW);
if (IS_ERR(led)) return PTR_ERR(led);
model_gpiod_set_value(led, 1);          // 逻辑电平，自动处理 active-low

struct clk *clk = devm_clk_get(dev, NULL);
if (IS_ERR(clk)) return PTR_ERR(clk);
return clk_prepare_enable(clk);     // 使能后才能访问寄存器
```

devm\_ 托管 \+ 描述符 GPIO \+ 时钟先使能



表 6.2 资源获取失败的对策



| 资源 | 未就绪时返回 | 处理 |
| --- | --- | --- |
| GPIO | -ENOENT | 检查 dts / defer |
| clock | -EPROBE\_DEFER | 稍后重试 |
| regulator | -EPROBE\_DEFER | 稍后重试 |
| pinctrl | -ENODEV | 检查状态名 |



````zhizhan-details
{"title":"其他平台对照 · 首次只选当前硬件","body":"```zhizhan-anchor\nm06-routes\n```\n\n\n\n```zhizhan-anchor\nm06-routes-t\n```\n\n\n\n## 6.4 三条内核路线对照：子系统\n\n\n\n三条路线的子系统 API 一致，差异在 dts 里的引脚/时钟节点命名。\n\n\n\n表 6.3 三条路线的引脚/时钟节点\n\n\n\n| 内核路线 | GPIO 节点 | 时钟节点 | 说明 |\n| --- | --- | --- | --- |\n| STM32MP1 | gpioz/gpioa... | rcc 时钟树 | mainline |\n| i.MX6ULL | gpio1... | ccm 时钟 | BSP mainline |\n| V3s | pio | ccu 时钟 | sunxi mainline |"}
````



```zhizhan-anchor
m06-err
```



```zhizhan-anchor
m06-err-t
```



## 6.5 子系统错误码速查



子系统 API 的返回值都有含义，排障时按错误码缩小范围：



表 6.4 子系统常见错误码



| 返回/现象 | 含义 | 处理 |
| --- | --- | --- |
| -EPROBE\_DEFER | 依赖未就绪 | 稍后重试，勿当致命错 |
| -ENODEV | API 获取资源失败（不是直接 MMIO 的通用结果） | 检查 dts 与 clk enable |
| -ENOENT | GPIO/资源不存在 | 核对名称与 dts |
| -EBUSY | 资源被占用 | 查重复申请 |
| -EINVAL | 参数非法 | 检查描述符/电压范围 |



subsys\_check.sh 节选Shell

 

```text
cat /sys/kernel/debug/clk/clk_summary | grep myclk   # 时钟是否使能
cat /sys/kernel/debug/gpio                          # GPIO 占用/方向
cat /sys/kernel/debug/pinctrl/*/pinmux-pins         # 引脚复用
dmesg | grep -i defer                               # 是否反复 defer
```

从 debugfs 核对时钟/GPIO/pinctrl 的实际状态



```zhizhan-anchor
m06-pitfalls
```



```zhizhan-anchor
m06-pitfalls-t
```



## 6.6 常见误区与排障



失败路径与排障




- **忘记使能时钟就访问寄存器** ：总线挂死或读到 0。

- **引脚复用没配** ：功能不出，表现为“寄存器写了没用”。

- **regulator 电压不在范围** ：外设工作异常甚至损坏。

- **资源获取失败不处理** ：null 解引用崩溃。



◆ 自测 · Module 06（先答再看）




1. 为什么现代驱动优先用子系统 API 而不是直接写寄存器？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"子系统 API 处理跨 SoC 差异、依赖顺序与电源管理，代码可移植且能被内核统一管理；直接写寄存器把驱动绑死在一块芯片上，且容易漏掉时钟/电压等前置。"}
   ```

2. 访问外设寄存器前必须先做什么？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"先使能该外设的时钟（clk\\_prepare\\_enable）。未使能时的直接寄存器访问可能无效或引起总线故障，具体依 SoC；不能承诺自动返回 errno。"}
   ```

3. GPIO 描述符 API 相比裸写寄存器多了什么保障？
   
   
   
   ```zhizhan-details
   {"title":"查看答案","body":"它处理“活跃电平”（active-high/low），并参与 resource 配对与错误处理。put 之后禁止再使用；调用者必须结束并发访问并维护生命周期，不能依赖安全拒绝。"}
   ```




答完再看解析；不确定的点回到对应小节复读。



迁移练习：把驱动里裸写的 GPIO/时钟操作改为 devm\_\* 描述符/时钟 API，并核对 put/disable 配对。



核对与延伸：[Linux 内核文档 · Driver API](https://www.kernel.org/doc/html/latest/driver-api/index.html) · [Linux 内核文档 · ftrace](https://www.kernel.org/doc/html/latest/trace/ftrace.html)

 

动手练习



运行 ` labs/host_gpio.c `：验证 GPIO 申请/set/put 与时钟 enable/disable 配对，观察模型自己的状态检查；内核描述符释放后禁止访问。



**检查结果：** 区分 model\_ 状态机与 Linux API；真实 gpiod\_get 失败使用 IS\_ERR/PTR\_ERR；释放前停止异步使用，释放后不再访问。

 

迁移练习：把本章的“能用描述符 GPIO 与时钟子系统 API 写出申请—设置—释放配对、访问前先使能时钟的驱动片段。”用到你自己的芯片/项目上，并在 ` labs/ ` 留一份可复跑的命令与结果记录。

 

**Module 06 完成？**  先阅读，再完成本章行为验收与迁移自评。

 

```zhizhan-assessment
{"id":"course-b10-m06","criterion":"区分 model_ 状态机与 Linux API；真实 gpiod_get 失败使用 IS_ERR/PTR_ERR；释放前停止异步使用，释放后不再访问。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```


---

[本册导读、实验资料与完整学习规划](doc:course-b10-guide)
