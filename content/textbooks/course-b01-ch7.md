# 惯用法与架构设计

```zhizhan-anchor
ch7
```



会写 C 和会写 **能维护的嵌入式系统** 是两件事。 这一章讲的是那些"没人教你但必须会"的东西：状态机怎么组织、模块边界怎么划、 错误怎么处理、C 怎么写才能长得像面向对象。

 

> ◷ 约 150 分钟 · ◈ 大量可复用代码 · ⚑ 从能跑到能维护

 

```zhizhan-anchor
ch7-1
```



## 7.1 状态机：嵌入式应用的骨架

 

嵌入式系统本质上是 **对事件做出反应的状态机** 。按键、串口数据、定时器超时、传感器告警——都是事件。 问题不在于"要不要用状态机"，而在于 **用哪种写法** 。

 

**FIG 7.1**  同一个逻辑的三种状态机实现

 

```zhizhan-figure
<svg viewBox="0 0 660 322" width="660" height="322" role="img" aria-label="三种状态机写法对比">
          <!-- ① switch -->
          <rect x="18" y="20" width="200" height="150" rx="7" class="sv-box" stroke="var(--red)"></rect>
          <text x="32" y="42" class="sv-lbl-hi" style="fill:var(--red)">① switch-case</text>
          <text x="32" y="62" class="sv-lbl-dim" style="font-size:10.5px">switch (state) {</text>
          <text x="32" y="78" class="sv-lbl-dim" style="font-size:10.5px">&nbsp;&nbsp;case IDLE:</text>
          <text x="32" y="94" class="sv-lbl-dim" style="font-size:10.5px">&nbsp;&nbsp;&nbsp;&nbsp;if (ev == START) ...</text>
          <text x="32" y="110" class="sv-lbl-dim" style="font-size:10.5px">&nbsp;&nbsp;case RUNNING:</text>
          <text x="32" y="126" class="sv-lbl-dim" style="font-size:10.5px">&nbsp;&nbsp;&nbsp;&nbsp;...</text>
          <text x="32" y="142" class="sv-lbl-dim" style="font-size:10.5px">}</text>
          <text x="32" y="162" class="sv-lbl-dim" style="font-size:10px;fill:var(--amb)">简单直观，但状态一多就失控</text>

          <!-- ② 状态表 -->
          <rect x="230" y="20" width="200" height="150" rx="7" class="sv-box" stroke="var(--grn)"></rect>
          <text x="244" y="42" class="sv-lbl-hi" style="fill:var(--grn)">② 状态转移表</text>
          <text x="244" y="62" class="sv-lbl-dim" style="font-size:10.5px">typedef struct {</text>
          <text x="244" y="78" class="sv-lbl-dim" style="font-size:10.5px">&nbsp;&nbsp;state_t  next;</text>
          <text x="244" y="94" class="sv-lbl-dim" style="font-size:10.5px">&nbsp;&nbsp;action_fn fn;</text>
          <text x="244" y="110" class="sv-lbl-dim" style="font-size:10.5px">} trans_t;</text>
          <text x="244" y="130" class="sv-lbl-dim" style="font-size:10.5px">static const trans_t</text>
          <text x="244" y="146" class="sv-lbl-dim" style="font-size:10.5px">&nbsp;&nbsp;g_table[S][E] = {...};</text>
          <text x="244" y="164" class="sv-lbl-dim" style="font-size:10px;fill:var(--grn)">数据驱动，可自动生成</text>

          <!-- ③ 状态对象 -->
          <rect x="442" y="20" width="200" height="150" rx="7" class="sv-box" stroke="var(--cyn)"></rect>
          <text x="456" y="42" class="sv-lbl-hi" style="fill:var(--cyn)">③ 状态对象（OOP）</text>
          <text x="456" y="62" class="sv-lbl-dim" style="font-size:10.5px">typedef struct {</text>
          <text x="456" y="78" class="sv-lbl-dim" style="font-size:10.5px">&nbsp;&nbsp;void (*on_enter)(void);</text>
          <text x="456" y="94" class="sv-lbl-dim" style="font-size:10.5px">&nbsp;&nbsp;void (*on_exit)(void);</text>
          <text x="456" y="110" class="sv-lbl-dim" style="font-size:10.5px">&nbsp;&nbsp;state_t (*on_event)(ev_t);</text>
          <text x="456" y="126" class="sv-lbl-dim" style="font-size:10.5px">} state_t;</text>
          <text x="456" y="146" class="sv-lbl-dim" style="font-size:10.5px">每状态自带行为</text>
          <text x="456" y="164" class="sv-lbl-dim" style="font-size:10px;fill:var(--cyn)">易扩展，支持层次状态机</text>

          <!-- 选型建议 -->
          <rect x="18" y="186" width="624" height="122" rx="7" class="sv-amb-s"></rect>
          <text x="34" y="208" class="sv-lbl-hi" style="fill:var(--amb)">选型建议（按状态数量）</text>
          <text x="34" y="232" class="sv-lbl-dim" style="font-size:11px">≤ 4 个状态，转移简单&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;→ switch-case 完全够用，别过度设计</text>
          <text x="34" y="254" class="sv-lbl-dim" style="font-size:11px">5–15 个状态，转移规则明确&nbsp;&nbsp;→ 状态转移表（数据驱动，配合代码生成工具最佳）</text>
          <text x="34" y="276" class="sv-lbl-dim" style="font-size:11px">&gt; 15 个状态，或需要嵌套/并发&nbsp;→ 状态对象 + 层次状态机（Harel Statechart）</text>
          <text x="34" y="298" class="sv-lbl-dim" style="font-size:10.5px;fill:var(--red)">反模式：一个 3000 行的 switch-case，每个 case 里嵌 3 层 if —— 这是维护噩梦的开始</text>
        </svg>
```

 

```zhizhan-anchor
ch7-1-1
```



### 7.1.1 方案一：状态转移表（数据驱动）

 

fsm\_table.c — 表驱动状态机（推荐用于中等复杂度） C

 

```text
#include <stdint.h>
#include <stddef.h>

/* ============================================================
   一个"设备配网 + 运行"的状态机
   ============================================================ */

typedef enum {
    ST_INIT = 0,
    ST_IDLE,
    ST_CONNECTING,
    ST_ONLINE,
    ST_ERROR,
    ST_COUNT                    /* 哨兵：状态总数 */
} state_t;

typedef enum {
    EV_START = 0,
    EV_CONNECTED,
    EV_TIMEOUT,
    EV_DATA,
    EV_RESET,
    EV_ERROR,
    EV_COUNT                    /* 哨兵：事件总数 */
} event_t;

/* ---- 动作函数 ---- */
static void act_none(void)        { }
static void act_led_off(void)     { /* gpio_set(LED, 0); */ }
static void act_led_slow(void)    { /* 开启慢闪定时器 */ }
static void act_led_fast(void)    { /* 开启快闪定时器 */ }
static void act_led_on(void)      { /* gpio_set(LED, 1); */ }
static void act_start_connect(void) { /* 发起连接 */ }
static void act_send_data(void)   { /* 处理接收到的数据 */ }
static void act_log_error(void)   { /* 记录错误 */ }

/* ============================================================
   转移表：[状态][事件] → { 下一状态, 要执行的动作 }
   ------------------------------------------------------------
   用指定初始化器（C99）可以让表格自解释，空的位置自动为 0
   ============================================================ */
typedef struct {
    state_t next;
    void  (*action)(void);
} transition_t;

static const transition_t g_fsm[ST_COUNT][EV_COUNT] = {
    /* ---------- 当前状态：ST_INIT ---------- */
    [ST_INIT] = {
        [EV_START]   = { ST_IDLE,       act_led_off  },
        [EV_ERROR]   = { ST_ERROR,      act_log_error},
        [EV_TIMEOUT] = { ST_INIT,       act_none     },   /* 自环：忽略 */
    },

    /* ---------- 当前状态：ST_IDLE ---------- */
    [ST_IDLE] = {
        [EV_START]   = { ST_CONNECTING, act_led_slow },
        [EV_RESET]   = { ST_INIT,       act_none     },
        [EV_ERROR]   = { ST_ERROR,      act_log_error},
    },

    /* ---------- 当前状态：ST_CONNECTING ---------- */
    [ST_CONNECTING] = {
        [EV_CONNECTED] = { ST_ONLINE,    act_led_on   },
        [EV_TIMEOUT]   = { ST_ERROR,     act_log_error},
        [EV_RESET]     = { ST_INIT,      act_none     },
    },

    /* ---------- 当前状态：ST_ONLINE ---------- */
    [ST_ONLINE] = {
        [EV_DATA]    = { ST_ONLINE,      act_send_data },  /* 自环：处理数据后留在原状态 */
        [EV_TIMEOUT] = { ST_ERROR,       act_log_error },
        [EV_RESET]   = { ST_INIT,        act_none      },
    },

    /* ---------- 当前状态：ST_ERROR ---------- */
    [ST_ERROR] = {
        [EV_RESET]   = { ST_INIT,        act_led_fast },
        /* 其他事件在错误状态下被忽略（表格留空 = next 为 0 = ST_INIT，需注意！）*/
    },
};

/* ============================================================
   ⚠ 表格留空的陷阱：next 默认为 0，正好是 ST_INIT
   ------------------------------------------------------------
   这可能导致"未定义的事件悄悄把状态重置了"。
   两种修复方式：
   ============================================================ */

/* ---- 修复 A：显式给所有空位填"保持原状态"哨兵 ---- */
#define STAY  ((state_t)0xFF)       /* 特殊值：表示状态不变 */

static const transition_t g_fsm_safe[ST_COUNT][EV_COUNT] = {
    [ST_ERROR] = {
        [EV_RESET] = { ST_INIT, act_led_fast },
        /* 未列出的项由下面的初始化函数统一填 STAY */
    },
};

/* ---- 修复 B（更常用）：运行期检查 ---- */
typedef struct {
    state_t  current;
    uint32_t transition_count;
    uint32_t invalid_count;         /* 统计无效转移，用于诊断 */
} fsm_t;

void fsm_init(fsm_t *fsm)
{
    fsm->current          = ST_INIT;
    fsm->transition_count = 0;
    fsm->invalid_count    = 0;
}

/* ---- 状态名（调试输出用，极其有用）---- */
static const char *const g_state_names[ST_COUNT] = {
    [ST_INIT]       = "INIT",
    [ST_IDLE]       = "IDLE",
    [ST_CONNECTING] = "CONNECTING",
    [ST_ONLINE]     = "ONLINE",
    [ST_ERROR]      = "ERROR",
};

static const char *const g_event_names[EV_COUNT] = {
    [EV_START]     = "START",
    [EV_CONNECTED] = "CONNECTED",
    [EV_TIMEOUT]   = "TIMEOUT",
    [EV_DATA]      = "DATA",
    [EV_RESET]     = "RESET",
    [EV_ERROR]     = "ERROR",
};

/* ============================================================
   状态机核心：只有 8 行
   ============================================================ */
void fsm_dispatch(fsm_t *fsm, event_t ev)
{
    if (ev >= EV_COUNT) {
        fsm->invalid_count++;
        return;
    }

    const transition_t *t = &g_fsm[fsm->current][ev];

    /* 检查是否是"未定义转移"：动作函数为空指针 */
    if (t->action == NULL) {
        fsm->invalid_count++;
        /* 可选：在错误状态下的任何事件都不改变状态 */
        return;
    }

    fsm->current = t->next;         /* ① 先切状态 */
    t->action();                     /* ② 再执行动作 */
    fsm->transition_count++;
}

/* ============================================================
   使用
   ============================================================ */
static fsm_t g_app_fsm;

void app_init(void)
{
    fsm_init(&g_app_fsm);
    fsm_dispatch(&g_app_fsm, EV_START);          /* INIT → IDLE */
}

void app_on_connected(void)
{
    fsm_dispatch(&g_app_fsm, EV_CONNECTED);      /* IDLE/CONNECTING → ONLINE */
}

/* ---- 调试辅助：随时打印当前状态 ---- */
void app_dump_state(void)
{
    log_printf("FSM: state=%s transitions=%lu invalid=%lu",
               g_state_names[g_app_fsm.current],
               (unsigned long)g_app_fsm.transition_count,
               (unsigned long)g_app_fsm.invalid_count);

    /* invalid_count 持续增长 = 有事件没被正确处理，是重要的诊断信号 */
}

/* ============================================================
   为什么表驱动比 switch 好？

   ① 新增状态：加一行枚举 + 表格加一块，不改任何逻辑代码
   ② 状态转移关系一目了然：整个表就是一份可读的规格文档
   ③ 可以被工具生成：从 UML 状态图 / Excel 表格自动生成 C 代码
   ④ 代码量恒定：不管多少状态，dispatch 永远是 8 行

   代价：
   ① 表格占 Flash（ST_COUNT × EV_COUNT × 8 字节）
      5 状态 × 6 事件 × 8 = 240 字节，可接受
      20 状态 × 20 事件 × 8 = 3.2 KB，就要考虑稀疏表优化了
   ② 动作函数不能带参数（需要用全局/上下文变量传递）
   ============================================================ */
```

 

```zhizhan-anchor
ch7-1-2
```



### 7.1.2 方案二：状态对象 \+ 层次状态机

 

hsm.c — 层次状态机（处理"进入/退出/父子状态"） C

 

```text
#include <stdint.h>
#include <stddef.h>

/* ============================================================
   层次状态机的核心思想：状态可以"继承"父状态的事件处理

   场景：一个电机控制系统
     ┌─ STOPPED（父）
     │    ├─ IDLE（子）
     │    └─ BRAKING（子）
     └─ RUNNING（父）
          ├─ ACCEL（子）
          └─ CRUISE（子）

   在任意子状态下收到 EMERGENCY_STOP，都应该立即停止 ——
   这个逻辑放在父状态 STOPPED/RUNNING 上，子状态不需要重复实现。
   ============================================================ */

/* 状态处理函数的返回值：告诉框架"我处理了"还是"交给父状态" */
typedef enum {
    HANDLED,        /* 本状态处理了事件 */
    IGNORED,        /* 本状态不关心，交给父状态 */
    TRANSITION      /* 发生了状态转移 */
} hsm_result_t;

typedef struct hsm_state hsm_state_t;
typedef struct hsm hsm_t;
typedef uint32_t hsm_event_t;

/* ---- 状态定义 ---- */
struct hsm_state {
    const char        *name;
    const hsm_state_t *parent;                  /* 父状态，NULL = 顶层 */
    hsm_result_t (*on_event)(hsm_t *hsm, hsm_event_t ev);
    void         (*on_enter)(hsm_t *hsm);
    void         (*on_exit)(hsm_t *hsm);
};

/* ---- 状态机实例 ---- */
#define HSM_MAX_DEPTH  8

struct hsm {
    const hsm_state_t *current;
    uint32_t   depth;                            /* 当前嵌套深度 */
    uint32_t   transition_count;
    uint32_t   rejected_count;
    void      *user;                             /* 用户上下文（电机句柄等）*/
};

/* ---- 前向声明 ---- */
static const hsm_state_t S_TOP, S_STOPPED, S_IDLE, S_BRAKING;
static const hsm_state_t S_RUNNING, S_ACCEL, S_CRUISE;

/* ---- 事件定义 ---- */
enum {
    EV_NONE = 0,
    EV_START,           /* 启动 */
    EV_STOP,            /* 正常停止 */
    EV_ESTOP,           /* 急停（所有运行状态都必须响应）*/
    EV_TARGET_REACHED,  /* 达到目标速度 */
    EV_FAULT,           /* 故障 */
    EV_CLEAR_FAULT,     /* 清除故障 */
};

/* ============================================================
   状态转移：需要计算 LCA（最低公共祖先）来决定 enter/exit 顺序
   ============================================================ */
static void hsm_transition(hsm_t *hsm, const hsm_state_t *target)
{
    const hsm_state_t *path_from[HSM_MAX_DEPTH];
    const hsm_state_t *path_to[HSM_MAX_DEPTH];
    int n_from = 0, n_to = 0;

    /* 收集从当前状态到根的路径 */
    for (const hsm_state_t *s = hsm->current; s && n_from < HSM_MAX_DEPTH; s = s->parent) {
        path_from[n_from++] = s;
    }
    /* 收集从目标状态到根的路径 */
    for (const hsm_state_t *s = target; s && n_to < HSM_MAX_DEPTH; s = s->parent) {
        path_to[n_to++] = s;
    }

    /* 从根往下找最低公共祖先的索引 */
    int i = n_from - 1, j = n_to - 1;
    while (i >= 0 && j >= 0 && path_from[i] == path_to[j]) {
        i--; j--;
    }

    /* ① 退出：从当前状态向上退到（不含）LCA */
    for (int k = 0; k <= i; k++) {
        if (path_from[k]->on_exit) path_from[k]->on_exit(hsm);
    }

    /* ② 进入：从 LCA 下方逐层向下进入目标 */
    for (int k = j; k >= 0; k--) {
        if (path_to[k]->on_enter) path_to[k]->on_enter(hsm);
    }

    hsm->current = target;
    hsm->transition_count++;
}

/* ============================================================
   事件派发：沿父链向上冒泡
   ============================================================ */
void hsm_dispatch(hsm_t *hsm, hsm_event_t ev)
{
    const hsm_state_t *s = hsm->current;

    while (s) {
        if (s->on_event) {
            hsm_result_t r = s->on_event(hsm, ev);
            if (r == HANDLED || r == TRANSITION) {
                return;                 /* 被处理了，停止冒泡 */
            }
            /* r == IGNORED：继续向父状态冒泡 */
        }
        s = s->parent;                  /* ← 这就是"继承"：父状态兜底 */
    }

    /* 一路冒泡到顶都没人处理 → 记录为被拒绝的事件 */
    hsm->rejected_count++;
}

void hsm_init(hsm_t *hsm, void *user)
{
    hsm->current          = &S_TOP;
    hsm->depth            = 0;
    hsm->transition_count = 0;
    hsm->rejected_count   = 0;
    hsm->user             = user;

    if (S_TOP.on_enter) S_TOP.on_enter(hsm);
    hsm_transition(hsm, &S_IDLE);       /* 初始进入 IDLE */
}

/* ============================================================
   状态实现
   ============================================================ */

/* ---- 顶层：兜底处理 ---- */
static hsm_result_t top_on_event(hsm_t *hsm, hsm_event_t ev)
{
    (void)hsm;
    switch (ev) {
    case EV_ESTOP:
        /* 任何状态收到急停都立即停止 —— 只写一次，所有子状态共享 */
        hsm_transition(hsm, &S_IDLE);
        return TRANSITION;
    case EV_FAULT:
        hsm_transition(hsm, &S_BRAKING);
        return TRANSITION;
    default:
        return IGNORED;
    }
}
static const hsm_state_t S_TOP = {
    .name = "TOP", .parent = NULL, .on_event = top_on_event,
};

/* ---- STOPPED 父状态 ---- */
static hsm_result_t stopped_on_event(hsm_t *hsm, hsm_event_t ev)
{
    switch (ev) {
    case EV_START:
        hsm_transition(hsm, &S_ACCEL);
        return TRANSITION;
    default:
        return IGNORED;                 /* 交给 TOP */
    }
}
static const hsm_state_t S_STOPPED = {
    .name = "STOPPED", .parent = &S_TOP, .on_event = stopped_on_event,
};

/* ---- IDLE 子状态：只处理自己特有的 ---- */
static hsm_result_t idle_on_event(hsm_t *hsm, hsm_event_t ev)
{
    (void)hsm; (void)ev;
    /* IDLE 没有特有的事件处理：
       - EV_START 由父状态 STOPPED 处理
       - EV_ESTOP 由顶层 TOP 处理
       这就是层次状态机的价值：子状态只写自己关心的 */
    return IGNORED;
}
static const hsm_state_t S_IDLE = {
    .name = "IDLE", .parent = &S_STOPPED, .on_event = idle_on_event,
};

/* ---- BRAKING 子状态 ---- */
static void braking_enter(hsm_t *hsm) { (void)hsm; /* 启动制动 PWM */ }
static hsm_result_t braking_on_event(hsm_t *hsm, hsm_event_t ev)
{
    switch (ev) {
    case EV_CLEAR_FAULT:
        hsm_transition(hsm, &S_IDLE);
        return TRANSITION;
    default:
        return IGNORED;
    }
}
static const hsm_state_t S_BRAKING = {
    .name = "BRAKING", .parent = &S_STOPPED,
    .on_event = braking_on_event, .on_enter = braking_enter,
};

/* ---- RUNNING 父状态 ---- */
static void running_enter(hsm_t *hsm) { (void)hsm; /* 使能驱动器 */ }
static void running_exit(hsm_t *hsm)  { (void)hsm; /* 禁用驱动器 */ }
static hsm_result_t running_on_event(hsm_t *hsm, hsm_event_t ev)
{
    switch (ev) {
    case EV_STOP:
        hsm_transition(hsm, &S_IDLE);
        return TRANSITION;
    default:
        return IGNORED;
    }
}
static const hsm_state_t S_RUNNING = {
    .name = "RUNNING", .parent = &S_TOP, .on_event = running_on_event,
    .on_enter = running_enter, .on_exit = running_exit,
};

/* ---- ACCEL / CRUISE 子状态 ---- */
static hsm_result_t accel_on_event(hsm_t *hsm, hsm_event_t ev)
{
    switch (ev) {
    case EV_TARGET_REACHED:
        hsm_transition(hsm, &S_CRUISE);
        return TRANSITION;
    default:
        return IGNORED;                 /* EV_STOP → RUNNING；EV_ESTOP → TOP */
    }
}
static const hsm_state_t S_ACCEL = {
    .name = "ACCEL", .parent = &S_RUNNING, .on_event = accel_on_event,
};

static hsm_result_t cruise_on_event(hsm_t *hsm, hsm_event_t ev)
{
    switch (ev) {
    case EV_START:                       /* 需要重新加速 */
        hsm_transition(hsm, &S_ACCEL);
        return TRANSITION;
    default:
        return IGNORED;
    }
}
static const hsm_state_t S_CRUISE = {
    .name = "CRUISE", .parent = &S_RUNNING, .on_event = cruise_on_event,
};

/* ============================================================
   使用示例

   hsm_t motor;
   hsm_init(&motor, &motor_ctx);

   hsm_dispatch(&motor, EV_START);          // IDLE → ACCEL（父 STOPPED 处理）
   hsm_dispatch(&motor, EV_TARGET_REACHED); // ACCEL → CRUISE
   hsm_dispatch(&motor, EV_ESTOP);          // CRUISE → IDLE（顶层处理！）
   hsm_dispatch(&motor, EV_ESTOP);          // 已在 IDLE，自转移，无害

   关键优势：
   - EV_ESTOP 只在 TOP 里实现一次，所有状态自动继承
   - 新增子状态时，只需写"特有"的事件，通用逻辑自动继承
   - on_enter/on_exit 保证资源正确获取与释放
   ============================================================ */
```

 

✔ 状态机的三条纪律

 

 
1. **动作要短** ：状态处理函数里不要做耗时操作（延时、阻塞 IO）。 设置标志或发消息，让主循环去处理。
 
2. **状态转移要集中** ：只通过 ` hsm_transition() ` 这类统一入口改状态， 不要在业务代码里到处写 ` fsm->state = XXX `。否则 enter/exit 钩子会被跳过。
 
3. **给状态和事件起可读的名字，并保留名字表** ：` g_state_names[] ` 在调试时值千金。  *当现场设备出问题时，你能通过日志直接看到"卡在 CONNECTING"，而不是"state=2"。*

  

```zhizhan-anchor
ch7-1-3
```



### 7.1.3 把丢掉的五件事装回那张表

 

§7.1.1 那张表只有两个字段：` next ` 和 ` action `。 它把"状态 × 事件 → 干什么"这件事表达得很干净，代价是 **有五件真会发生的事它说不出来** 。 这五件事不是风格问题，每一件都对应一个你迟早会撞上的场景。

 

| 缺的东西 | 写不出来的是哪句话 | 现场的后果 |
| --- | --- | --- |
| ① 动作带不了参数 | "收到 DATA 事件，把这包数据交给处理函数" | 动作函数签名是 ` void (*)(void) `，数据只能先塞进全局变量再让动作去取。谁是生产者、谁是消费者，编译器无从检查 |
| ② 没有守卫条件 | "收到 DATA， **并且** 接收缓冲区还有空位，才处理" | 条件只能塞进动作函数的第一行 ` if ` 里。于是"这条边走没走"在转移表上看不出来，` transitions ` 计数器也会把被挡住的事件算成走过 |
| ③ 自环只有一种 | "重连一次（先拆再建）" vs "收了一包数据，连接不动" | 两种语义在表里长得 **完全一样** （` next ` 指向自己）。前者要跑 ` exit/enter `，后者绝不能跑 —— 写错了就是每次收数据都断一次重连 |
| ④ 空单元格撞上状态 0 | "这一格没有定义" | 空单元格的值是 ` 0 `，而 ` 0 ` 恰好是 ` ST_INIT `。表里漏写一格，运行期的表现是"莫名其妙回到 INIT"，而不是报错 |
| ⑤ 超时无处安放 | "CONNECTING 最多等 10 秒" | 超时不是事件，是 **时间的函数** 。每个状态各写一个软定时器，就有了 N 份互相不知道对方存在的计时逻辑 |

 

下面这份文件把五件事一次补上。 **改动都不大** ，转移表还是那张转移表 —— 但它从"两个字段的结构体"变成了"能表达一条完整规则的结构体"。

 

sm\_event.c — 表驱动状态机（补齐守卫 / 事件参数 / 内部转移 / 超时派生） C

 

```text
/* sm_event.c — 表驱动状态机：把「守卫」「事件参数」「无效哨兵」「内部转移」
 *              「超时派生」这五件 7.1.1 里缺的东西装回表里。
 *
 * 7.1.1 那张表只有 {next, action} 两个字段，于是三件事办不到：
 *   ① 动作不能带参数 —— 事件带了数据也只能写进全局变量；
 *   ② 没有守卫条件 —— "收到 DATA 但要缓冲区有空位才处理"这种规则无处可写；
 *   ③ "自环"只有一种 —— 分不清「内部转移（不跑 exit/enter）」和
 *      「外部自转移（目标是自己，但 exit/enter 照跑）」。
 * 还有一个隐患：空单元格 next 默认为 0，而 0 恰好是 ST_INIT。
 *
 * 这份文件把上面四条一次改掉。改动都不大，但没有一条是"风格问题"——
 * 每一条都对应一个真会出事的场景，注释里逐个写了为什么。
 */
#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>

/* ============================================================
   ① 先把状态 0 抢回来当"无效值"
   ------------------------------------------------------------
   原来 ST_INIT 就是 0，于是"表格留空"和"转到 INIT"在机器眼里是同一件事。
   现在 ST_NONE = 0 专门表示"没有这条转移"，任何一条真转移都不许指向它。
   ============================================================ */
typedef enum {
    ST_NONE = 0,        /* 无效：不是合法状态，只用来标记空表格 */
    ST_INIT,
    ST_IDLE,
    ST_CONNECTING,
    ST_ONLINE,
    ST_ERROR,
    ST_COUNT
} state_t;

/* 这两个断言是本节的地基：ST_NONE 必须是 0（否则零初始化的空单元格
   又会变成某个真状态），而 ST_COUNT 必须比它大（否则数组退化成 1 格）。 */
_Static_assert(ST_NONE == 0, "ST_NONE must be zero: empty cells rely on it");
_Static_assert(ST_COUNT > 1, "state table collapsed");

/* ============================================================
   ② 事件带参数
   ------------------------------------------------------------
   所有事件共用一块"载荷"空间，怎么解释由事件类型决定。
   好处：事件结构体大小固定，队列可以是定长数组（嵌入式里这一点很重要）；
   代价：没有类型检查，读错成员编译器不会拦 —— 所以约定
   "谁能读哪个成员"必须写在事件定义旁边，而不是靠记忆。
   ============================================================ */
typedef enum {
    EV_NONE = 0,
    EV_START,
    EV_CONNECTED,
    EV_DATA,            /* 载荷：pay.data  */
    EV_ERROR,           /* 载荷：pay.err   */
    EV_TICK,            /* 载荷：pay.tick  —— 超时事件由它派生 */
    EV_TIMEOUT,         /* 载荷：pay.tick  —— 也可以由外部直接投递 */
    EV_RESET,
    EV_COUNT
} event_t;

typedef union {
    uint32_t tick;              /* EV_TICK / EV_TIMEOUT */
    struct { uint8_t port, code; } err;    /* EV_ERROR */
    struct { const uint8_t *buf; uint16_t len; } data;  /* EV_DATA */
} ev_payload_t;

typedef struct {
    event_t      id;
    ev_payload_t pay;
} ev_t;

/* ============================================================
   ③ 转移的四种"种类"
   ------------------------------------------------------------
   TR_NONE 是 0，于是**空单元格天然就是"未定义"**，不再撞上任何真状态。
   这是把上面第 ① 条真正兑现的地方：光把 ST_NONE 定成 0 还不够，
   表格的第一个字段必须是 kind，它才能接住那个 0。
   ============================================================ */
typedef enum {
    TR_NONE = 0,        /* 表格留空：这个状态不响应这个事件 */
    TR_EXTERNAL,        /* 外部转移：exit → 改状态 → enter */
    TR_INTERNAL,        /* 内部转移：只跑动作；状态、exit、enter 全都不动 */
    TR_SELF             /* 外部自转移：目标就是自己，但 exit/enter 照跑 */
} tr_kind_t;

typedef struct sm sm_t;

typedef bool (*guard_fn)(const sm_t *sm, const ev_t *ev);
typedef void (*action_fn)(sm_t *sm, const ev_t *ev);

typedef struct {
    tr_kind_t  kind;
    state_t    next;    /* 只有 TR_EXTERNAL / TR_SELF 会读它 */
    guard_fn   guard;   /* NULL = 无守卫 */
    action_fn  action;  /* NULL = 无动作 */
} transition_t;

/* ============================================================
   ④ 每个状态带一个超时，超时事件由 tick 派生
   ------------------------------------------------------------
   "超时"不是一个独立的状态机，而是每个状态自己声明
   "我最多等多久"。tick 事件进来时统一检查，到点就合成一个
   EV_TIMEOUT 再派发一次 —— 于是所有超时逻辑都写在转移表里，
   不需要每个状态各写一个定时器。
   ============================================================ */
typedef struct {
    const char *name;
    void      (*on_enter)(sm_t *sm);
    void      (*on_exit)(sm_t *sm);
    uint32_t    timeout_ms;     /* 0 = 该状态不设超时 */
} state_desc_t;

/* ============================================================
   ⑤ 可重入：派发期间再来的事件进队列，而不是递归进状态机
   ------------------------------------------------------------
   超时派生（上面第 ④ 条）就是"在派发过程中又投递一个事件"，
   而 ISR 里投递也是同一件事。递归派发的后果是退出顺序反过来，
   exit/enter 会成对错位。所以这里做成"忙就排队"。
   ============================================================ */
#define SM_QUEUE_LEN 8

struct sm {
    state_t  current;
    state_t  from;              /* 上一次转移的来源，调试用 */
    uint32_t tick;              /* 由 1 ms 定时器累加 */
    uint32_t state_since;       /* 进入当前状态那一刻的 tick */
    uint32_t transition_count;  /* 真正发生的状态变更次数（含自转移） */
    uint32_t accepted_count;    /* 被接受的事件数（含内部转移） */
    uint32_t guard_reject_count;/* 守卫挡住的事件数 */
    uint32_t invalid_count;     /* 未定义转移 / 非法事件号 */
    uint32_t dropped_count;     /* 队列满了被丢掉的事件数 */
    bool     busy;              /* 正在派发：此时新事件只能进队列 */
    uint8_t  head, queued;
    ev_t     queue[SM_QUEUE_LEN];
};

/* ---- 状态描述表 ---- */
static void on_connecting_enter(sm_t *sm);
static void on_connecting_exit(sm_t *sm);

static const state_desc_t g_states[ST_COUNT] = {
    [ST_NONE]       = { .name = "(none)",     .timeout_ms = 0 },
    [ST_INIT]       = { .name = "INIT",       .timeout_ms = 0 },
    [ST_IDLE]       = { .name = "IDLE",       .timeout_ms = 0 },
    [ST_CONNECTING] = { .name = "CONNECTING",
                        .on_enter = on_connecting_enter,
                        .on_exit  = on_connecting_exit,
                        .timeout_ms = 10000 },   /* 10 秒连不上就认输 */
    [ST_ONLINE]     = { .name = "ONLINE",     .timeout_ms = 30000 },
    [ST_ERROR]      = { .name = "ERROR",      .timeout_ms = 0 },
};

/* ---- 守卫与动作 ---- */
static bool guard_has_room(const sm_t *sm, const ev_t *ev);
static void on_data(sm_t *sm, const ev_t *ev);
static void on_tick_online(sm_t *sm, const ev_t *ev);
static void on_timeout(sm_t *sm, const ev_t *ev);
static void on_error(sm_t *sm, const ev_t *ev);
static void on_restart(sm_t *sm, const ev_t *ev);

/* ============================================================
   转移表：[状态][事件] → { kind, next, guard, action }
   ------------------------------------------------------------
   读这张表的顺序：kind 说"这是一条什么转移"，
   next 只在外部转移里看，guard 说"什么条件下才走"，
   action 说"走了之后干什么"。
   ============================================================ */
static const transition_t g_sm[ST_COUNT][EV_COUNT] = {
    [ST_INIT] = {
        [EV_START]   = { TR_EXTERNAL, ST_IDLE,       NULL,           NULL       },
        [EV_ERROR]   = { TR_EXTERNAL, ST_ERROR,      NULL,           on_error   },
    },
    [ST_IDLE] = {
        [EV_START]   = { TR_EXTERNAL, ST_CONNECTING, NULL,           NULL       },
        [EV_ERROR]   = { TR_EXTERNAL, ST_ERROR,      NULL,           on_error   },
        [EV_RESET]   = { TR_EXTERNAL, ST_INIT,       NULL,           NULL       },
    },
    [ST_CONNECTING] = {
        [EV_CONNECTED] = { TR_EXTERNAL, ST_ONLINE,   NULL,           NULL       },
        [EV_TIMEOUT]   = { TR_EXTERNAL, ST_ERROR,    NULL,           on_timeout },
        [EV_RESET]     = { TR_EXTERNAL, ST_INIT,     NULL,           NULL       },
    },
    [ST_ONLINE] = {
        /* 这条是内部转移：处理完数据就留在 ONLINE。
           它和"自转移"的区别在于**不跑 exit/enter** ——
           连接不该因为收到一包数据就断一次重连。 */
        [EV_DATA]    = { TR_INTERNAL, ST_NONE,  guard_has_room, on_data       },
        [EV_TICK]    = { TR_INTERNAL, ST_NONE,  NULL,           on_tick_online },
        /* 这条是外部自转移：目标是自己，但 exit/enter 照跑 ——
           用来演示"重连一次"（先拆再建）。 */
        [EV_START]   = { TR_SELF,     ST_ONLINE, NULL,          on_restart    },
        [EV_TIMEOUT] = { TR_EXTERNAL, ST_ERROR, NULL,           on_timeout    },
        [EV_RESET]   = { TR_EXTERNAL, ST_INIT,  NULL,           NULL          },
    },
    [ST_ERROR] = {
        [EV_RESET]   = { TR_EXTERNAL, ST_INIT,  NULL,           NULL          },
    },
};

/* ============================================================
   核心：一条转移怎么走
   ============================================================ */
static void sm_enter(sm_t *sm, state_t to)
{
    if (g_states[sm->current].on_exit) g_states[sm->current].on_exit(sm);
    sm->from    = sm->current;
    sm->current = to;
    sm->state_since = sm->tick;
    if (g_states[to].on_enter) g_states[to].on_enter(sm);
    sm->transition_count++;
}

static void sm_step(sm_t *sm, const ev_t *ev)
{
    /* 事件号越界：表都索引不到，只能记一笔 */
    if ((unsigned)ev->id >= (unsigned)EV_COUNT) { sm->invalid_count++; return; }

    const transition_t *t = &g_sm[sm->current][ev->id];

    /* kind == TR_NONE（也就是 0）：表格这一格是空的。
       这就是把 ST_NONE 摆到 0 位、并把 kind 放在结构体第一位换来的收益 ——
       空单元格不可能被误当成"转到 ST_INIT"。 */
    if (t->kind == TR_NONE) { sm->invalid_count++; return; }

    /* 守卫不通过【不算】无效转移：这是一个明确的"现在不行"，
       和"这个状态根本不理这个事件"是两回事，计数也要分开，否则诊断时
       分不清是表格漏了还是业务上被挡住了。 */
    if (t->guard && !t->guard(sm, ev)) { sm->guard_reject_count++; return; }

    if (t->action) t->action(sm, ev);

    if (t->kind != TR_INTERNAL) {
        /* 外部转移必须给出一个真状态；指到 ST_NONE 说明表格写错了 */
        if (t->next == ST_NONE) { sm->invalid_count++; return; }
        sm_enter(sm, t->next);
    }
    sm->accepted_count++;
}

/* ============================================================
   超时派生：tick 进来时先看当前状态等够时间没有
   ------------------------------------------------------------
   对外可见（不是 static）：它由 1 ms 系统节拍中断调用，
   是这份文件真正的"时间入口"。
   ============================================================ */
void sm_on_tick(sm_t *sm, uint32_t now)
{
    sm->tick = now;
    const uint32_t to = g_states[sm->current].timeout_ms;
    if (to == 0) return;
    if ((uint32_t)(now - sm->state_since) < to) return;

    ev_t ev = { .id = EV_TIMEOUT, .pay = { .tick = now } };
    sm_step(sm, &ev);       /* 直接走，不走队列：这是唯一允许"立刻生效"的派生事件 */
}

/* ============================================================
   对外入口：忙就排队
   ============================================================ */
void sm_dispatch(sm_t *sm, const ev_t *ev)
{
    if (sm->busy) {
        if (sm->queued < SM_QUEUE_LEN) {
            sm->queue[(sm->head + sm->queued) % SM_QUEUE_LEN] = *ev;
            sm->queued++;
        } else {
            sm->dropped_count++;    /* 队列也会满：满了必须记，不能静默丢 */
        }
        return;
    }

    sm->busy = true;
    sm_step(sm, ev);
    while (sm->queued) {
        ev_t next = sm->queue[sm->head];
        sm->head = (uint8_t)((sm->head + 1) % SM_QUEUE_LEN);
        sm->queued--;
        sm_step(sm, &next);
    }
    sm->busy = false;
}

void sm_init(sm_t *sm)
{
    sm->current      = ST_INIT;
    sm->from         = ST_NONE;
    sm->tick         = 0;
    sm->state_since  = 0;
    sm->transition_count = sm->accepted_count = 0;
    sm->guard_reject_count = sm->invalid_count = 0;
    sm->dropped_count = 0;
    sm->busy = false;
    sm->head = sm->queued = 0;
    if (g_states[ST_INIT].on_enter) g_states[ST_INIT].on_enter(sm);
}

/* ============================================================
   动作与钩子的实现
   ------------------------------------------------------------
   真实工程里这些函数体里是 HAL 调用（GPIO、UART、定时器）。
   这里只留计数器，是为了让"哪条转移真的走了"能被外部看见 ——
   调试状态机最难的一步永远是"它刚才到底走了哪条边"。
   ============================================================ */
#define RX_MAX_FRAME 128

static uint32_t g_rx_bytes;
static uint32_t g_timeouts;
static uint32_t g_errors;
static uint32_t g_restarts;
static uint32_t g_conn_opens;
static uint32_t g_conn_closes;

static bool guard_has_room(const sm_t *sm, const ev_t *ev)
{
    (void)sm;
    /* 守卫不是"防御性编程"，而是把业务规则搬进表格：
       空帧和超长帧在这里就被挡住，on_data 里不必再判一次。
       注意它读的是**事件载荷**，而不是全局变量 —— 这正是"事件带参数"的收益。 */
    return ev->pay.data.len > 0 && ev->pay.data.len <= RX_MAX_FRAME;
}

static void on_data(sm_t *sm, const ev_t *ev)
{
    (void)sm;
    g_rx_bytes += ev->pay.data.len;
}

static void on_tick_online(sm_t *sm, const ev_t *ev)
{
    (void)sm; (void)ev;
    /* 心跳：真实工程里在这里发一包 keepalive。 */
}

static void on_timeout(sm_t *sm, const ev_t *ev)
{
    (void)sm; (void)ev;
    g_timeouts++;
}

static void on_error(sm_t *sm, const ev_t *ev)
{
    (void)sm;
    g_errors += 1u + ev->pay.err.code;
}

static void on_restart(sm_t *sm, const ev_t *ev)
{
    (void)sm; (void)ev;
    g_restarts++;
}

static void on_connecting_enter(sm_t *sm) { (void)sm; g_conn_opens++; }
static void on_connecting_exit (sm_t *sm) { (void)sm; g_conn_closes++; }

typedef struct {
    uint32_t rx_bytes, timeouts, errors, restarts;
    uint32_t conn_opens, conn_closes;
} sm_stats_t;

sm_stats_t sm_get_stats(void)
{
    sm_stats_t s = { g_rx_bytes, g_timeouts, g_errors, g_restarts,
                     g_conn_opens, g_conn_closes };
    return s;
}

/* ============================================================
   使用与自检

   sm_t app;
   sm_init(&app);
   ev_t e = { .id = EV_START, .pay = { 0 } };
   sm_dispatch(&app, &e);              // INIT → IDLE

   e.id = EV_START;   sm_dispatch(&app, &e);   // IDLE → CONNECTING（on_enter 开连）
   e.id = EV_TICK; e.pay.tick = 10000;
   sm_on_tick(&app, 10000);            // 等满 10 秒 → 派生 EV_TIMEOUT → ERROR
   ============================================================ */
```

 

#### ① 把 ` 0 ` 抢回来当"无效值"

 

这一条要 **两处一起改** 才成立，只改一处是假的：

 

 
1. 新增 ` ST_NONE = 0 `，把原来的状态整体后移一位。于是"表格留空"和"转到 INIT"在机器眼里终于是两件事了。
 
2. 转移表的 **第一个字段必须是 ` kind `** ，而且 ` TR_NONE ` 也得是 ` 0 `。 因为整张表是零初始化的 —— 空单元格真正落到的那个字节，是 **结构体的第一个成员** 。 如果第一个成员是 ` next `，那么空单元格读出来的 ` next ` 就是 ` 0 `， 而 ` 0 ` 现在正好是 ` ST_NONE ` —— 状态没走错，但派发器也看不出"这格是空的"。
 

 

◆ 一条能省很多调试时间的规则

 

**凡是零初始化的表，"无效"那个枚举值就必须是 0，而且承载它的字段要排在结构体最前面。**  这两件事是一句完整的话，拆开做等于没做 —— 这是本节最容易抄漏的一条。

 

#### ② 一次转移有三种"种类"，不是一个自环

 

UML 状态图里区分得很清楚，可惜很多 C 实现把它压成了一种。差别只在 **谁跑 ` exit/enter `** ：

 

**FIG 7.2**  三种转移：只在 ` exit/enter ` 上不同

 

```zhizhan-figure
<svg viewBox="0 0 660 262" width="660" height="262" role="img" aria-label="外部转移、内部转移、外部自转移的执行差异">
          <!-- 表头 -->
          <rect x="18" y="16" width="624" height="34" rx="6" class="sv-amb-s"></rect>
          <text x="34" y="39" class="sv-lbl-hi" style="fill:var(--amb)">同样一格 [ONLINE][DATA]，写成三种 kind，跑出来的东西完全不同</text>

          <!-- 三行 -->
          <rect x="18" y="60" width="200" height="86" rx="6" class="sv-box" stroke="var(--grn)"></rect>
          <text x="32" y="82" class="sv-lbl-hi" style="fill:var(--grn)">TR_INTERNAL</text>
          <text x="32" y="102" class="sv-lbl-dim" style="font-size:10.5px">next = ST_NONE</text>
          <text x="32" y="120" class="sv-lbl-dim" style="font-size:10.5px">exit ✗&nbsp;&nbsp;enter ✗</text>
          <text x="32" y="138" class="sv-lbl-dim" style="font-size:10px;fill:var(--grn)">收数据，连接不断</text>

          <rect x="230" y="60" width="200" height="86" rx="6" class="sv-box" stroke="var(--cyn)"></rect>
          <text x="244" y="82" class="sv-lbl-hi" style="fill:var(--cyn)">TR_EXTERNAL</text>
          <text x="244" y="102" class="sv-lbl-dim" style="font-size:10.5px">next = 别的状态</text>
          <text x="244" y="120" class="sv-lbl-dim" style="font-size:10.5px">exit ✓&nbsp;&nbsp;enter ✓</text>
          <text x="244" y="138" class="sv-lbl-dim" style="font-size:10px;fill:var(--cyn)">正常换状态</text>

          <rect x="442" y="60" width="200" height="86" rx="6" class="sv-box" stroke="var(--red)"></rect>
          <text x="456" y="82" class="sv-lbl-hi" style="fill:var(--red)">TR_SELF</text>
          <text x="456" y="102" class="sv-lbl-dim" style="font-size:10.5px">next = 自己</text>
          <text x="456" y="120" class="sv-lbl-dim" style="font-size:10.5px">exit ✓&nbsp;&nbsp;enter ✓</text>
          <text x="456" y="138" class="sv-lbl-dim" style="font-size:10px;fill:var(--red)">重连一次：先拆再建</text>

          <!-- 执行序列 -->
          <rect x="18" y="158" width="624" height="90" rx="6" class="sv-box"></rect>
          <text x="34" y="180" class="sv-lbl-hi">执行序列（同样一格表项）</text>
          <text x="34" y="202" class="sv-lbl-dim" style="font-size:11px">INTERNAL&nbsp;&nbsp;&nbsp;action → <tspan style="fill:var(--grn)">结束</tspan>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;状态不变，钩子不跑，state_since 不变（超时不会被重置）</text>
          <text x="34" y="222" class="sv-lbl-dim" style="font-size:11px">EXTERNAL&nbsp;&nbsp;&nbsp;action → exit(旧) → 改 current → enter(新) → state_since = tick</text>
          <text x="34" y="242" class="sv-lbl-dim" style="font-size:11px">SELF&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;action → exit(自己) → 改回自己 → enter(自己) → state_since = tick&nbsp;&nbsp;&nbsp;<tspan style="fill:var(--red)">所以接收缓冲区会被真的清一遍</tspan></text>
        </svg>
```

 

对照表里 ` [ST_ONLINE][EV_START] ` 那一格写的是 ` TR_SELF `， 注释里写明它的用途是"重连一次"；而 ` [ST_ONLINE][EV_DATA] ` 是 ` TR_INTERNAL `。 两格的 ` next ` 一个是自己、一个是 ` ST_NONE `，  **只有 ` kind ` 说得清它们不是一回事** 。

 

#### ③ 守卫：把业务规则从函数体里搬回表格

 

` guard_has_room ` 只有两行，但它的位置很关键：

 

```text
static bool guard_has_room(const sm_t *sm, const ev_t *ev)
{
    (void)sm;
    return ev->pay.data.len > 0 && ev->pay.data.len <= RX_MAX_FRAME;
}

/* 表格里那一格： */
[ST_ONLINE] = {
    [EV_DATA] = { TR_INTERNAL, ST_NONE, guard_has_room, on_data },
},
```

 

它读的是 ` ev->pay.data.len ` ——  **事件载荷** ，而不是某个全局变量。 这正是"事件带参数"的收益：规则、数据、动作三样东西在同一个地方能看全。

 

还有一处细节值得单独说：守卫挡住时，` sm_step ` 记的是 ` guard_reject_count `， **不是**  ` invalid_count `。

 

✔ 两个计数器为什么要分开

 

"这个状态根本不理这个事件"（表里没写）和"业务上现在不行"（守卫挡住）是两种完全不同的故障。 合成一个计数器，现场就只能看到"有事件被丢掉了"，然后开始翻表 —— 而实际上表是对的。  *计数器的价值不在于总数，在于它能不能一次把范围缩小一半。*

 

#### ④ 超时不是状态，是每个状态声明的一个数字

 

` state_desc_t ` 里多了 ` timeout_ms `： 每个状态自己声明"我最多等多久"。1 ms 节拍进来时统一检查，到点就 **合成一个 ` EV_TIMEOUT ` 再派发一次** 。

 

这样做的好处是 **所有超时逻辑都活在同一张转移表里**  —— 不需要为每个状态各写一个软定时器，也就不会出现"N 份互相不知道对方存在的计时逻辑"。 代价是：超时只能表达成"进入这个状态后等多久"，  **表达不了"在这个状态里，某件事发生后等多久"** （那需要状态里有多个计时器，是另一个模型）。

 

#### ⑤ 忙就排队，而不是递归

 

` sm_dispatch ` 里有一段 ` busy ` 判断： 正在派发时再进来的事件 **进队列** ，不递归进状态机。 为什么这件事非做不可，§7.1.5 会用一节讲清楚；这里先看它的直接来源 ——  **超时派生本身就是"在派发过程中又投递一个事件"** 。 唯一的例外写在 ` sm_on_tick ` 里：

 

```text
sm_step(sm, &ev);       /* 直接走，不走队列：这是唯一允许"立刻生效"的派生事件 */
```

 

时间的检查必须在它到来的那一拍完成，排到队尾会让 10 秒的超时变成"10 秒 \+ 队列长度"。 这条例外的边界很窄： **只有时间本身有资格插队** ，因为它的语义就是"现在到点了"。

 

#### 这些改动花了多少字节

 

下面全部是 **本机实测** ：GCC 13.3.1、` -O2 `、` -mcpu=cortex-m3 `， 两份文件用同一套编译选项（` -Wall -Wextra -Wpedantic `）。 基线是 §7.1.1 那个 ` fsm_table.c `。

 

**bash**  — 两份文件的段体积，以及与转移表直接相关的两个符号

 

```text
$ arm-none-eabi-gcc -c -mcpu=cortex-m3 -mthumb -O2 -Wall -Wextra -Wpedantic -o fsm.o fsm_table.c
$ arm-none-eabi-size -A fsm.o
.text              204      0
.data                0      0
.bss                12      0
.rodata.str1.4      86      0
.rodata            260      0
$ arm-none-eabi-gcc -c -mcpu=cortex-m3 -mthumb -O2 -Wall -Wextra -Wpedantic -o sm.o sm_event.c
$ arm-none-eabi-size -A sm.o
.text              600      0
.data                0      0
.bss                24      0
.rodata.str1.4      50      0
.rodata            672      0
$ arm-none-eabi-nm --print-size --size-sort fsm.o | grep -E 'g_fsm|g_state_names'
000000f0 00000014 r g_state_names      ← 0x14 = 20 字节：5 个指针
00000000 000000f0 r g_fsm              ← 0xf0 = 240 字节 = 5 × 6 × 8
$ arm-none-eabi-nm --print-size --size-sort sm.o | grep -E 'g_sm|g_states'
00000240 00000060 r g_states           ← 0x60 = 96 字节 = 6 × 16
00000000 00000240 r g_sm               ← 0x240 = 576 字节 = 6 × 8 × 12
```

 

两个 ` .rodata ` 数字没有任何"其它东西"： ` 260 = 240 + 20 `、` 672 = 576 + 96 `，  **整个只读段就是这两张表** 。所以"表变大了多少"这件事是可以精确算的，不用估。

 

| 量 | 7.1.1 基线 | 本节增强版 | 差与原因 |
| --- | --- | --- | --- |
| 代码 ` .text ` | 204 | 600 | **\+396** ：多出 ` kind ` 分支、守卫调用、队列搬运、超时派生 |
| 只读表 ` .rodata ` | 260 | 672 | **\+412** ：转移表每格 8 → 12 字节（` g_sm ` 240 → 576），状态描述表新增 96 |
| 字符串 ` .rodata.str1.4 ` | 86 | 50 | **−36** ：增强版把状态名收进了结构体，字符串字面量反而更少 |
| RAM ` .bss ` | 12 | 24 | \+12：五个统计计数器 |
| 派发路径指令数 | 23 | 75 | ` fsm_dispatch ` 23 → ` sm_step ` 75，另有 ` sm_dispatch ` 54、` sm_on_tick ` 25 |
| 编译告警 | 4 | 0 | 基线那 4 条是什么，§7.1.6 逐条看 |

 

⚠ 这笔账要付得明白：多花 808 字节 flash，换来五件事

 

代码 \+396 字节 \+ 表 \+412 字节，合计 \+808 字节 flash， 另有 \+12 字节 RAM。  **这个数字本身没有对错**  —— 一颗 64 KB flash 的 F103C8 上，808 字节是 1.2%； 在一颗 8 KB 的 M0 上，它是 10%。

 

真正要警惕的是另一种算法： **把五件事留着不补，然后用手写 ` if ` 逐个绕过去** 。 绕过去的每一处都要写一遍 exit/enter 的顺序、都要自己维护一个全局的"当前数据是谁给的"、 都要在每个状态下记得重置那个软定时器 —— 那些代码同样占 flash，但 **它们不会在转移表上留下痕迹** 。 等到现场出问题、你需要回答"它刚才走了哪条边"的时候，那些字节是白花的。

 

#### 顺带量出来的一件事：枚举不一定是 4 字节

 

转移表从 8 字节涨到 12 字节，看起来"多了一个枚举 \+ 两个函数指针应该是 8 \+ 1 \+ 4 \+ 4 = 17 → 20"。 实测是 12，原因是 ARM EABI  **默认 ` -fshort-enums `** ： 枚举只取"能装下其取值范围"的最小整型。` tr_kind_t ` 最大才到 2、 ` state_t ` 最大到 5，两个都只占 1 字节。

 

**bash**  — 同一份 ` sm_event.c `，只加一个 ` -fno-short-enums `

 

```text
$ arm-none-eabi-gcc -c -mcpu=cortex-m3 -mthumb -O2 -fno-short-enums -o sm_nse.o sm_event.c
$ arm-none-eabi-size -A sm_nse.o | grep -E 'text|rodata'
.text              564      0
.rodata.str1.4      50      0
.rodata            864      0        ← 672 → 864
$ arm-none-eabi-nm --print-size --size-sort sm_nse.o | grep g_sm
00000000 00000300 r g_sm               ← 0x300 = 768 = 48 格 × 16 字节
```

 

每格从 12 涨到 16：两个 1 字节的枚举各自变成 4 字节，多出来的 6 字节里， 有 4 个字节能塞进原有的填充，净涨 4 个。 **表越大，这个开关越贵**  —— 48 格涨 192 字节，如果是一张 20 状态 × 20 事件的表，就是 1600 字节。

 

✖ 一个必须亲手量、不能推的反例

 

顺手就会得出"枚举占 4 字节 → 结构体涨 4 字节"的结论。 **不对。**  §7.1.4 里那个状态节点也含一个枚举，加上 ` -fno-short-enums ` 之后它  **一个字节都没涨** ：省下的 3 字节被结构体对齐整个吃掉了。 结论是： *枚举的体积必须逐个结构体去量，不能一概而论* 。这件事本节最后会再验证一次。

   

```zhizhan-anchor
ch7-1-4
```



### 7.1.4 历史状态：退出之后，回来时该停在哪儿

 

§7.1.2 的层次状态机解决了 **"事件往上冒泡"** ：子状态不理的事件，父状态接手， ` EV_ESTOP ` 只在顶层写一次。 但它留下了一个没答的问题： **一个复合状态被退出去、过一会儿又回来，回到它的哪个子状态？**

 

这不是钻牛角尖。想一个真场景：设备正在 ` RUN/WORKING/STEADY `（稳定运行）， 这时候来了一个错误、跳出去处理掉、再回来 —— 你是想回到"稳定运行"， 还是想从"启动中"重新爬一遍斜坡？ **答案几乎总是前者** ， 而朴素的层次状态机给你的恰恰是后者：它只会回到 ` initial `。

 

UML 状态图把这件事做成了两个专门的 **伪状态** （pseudo-state，不是真状态，只是图上的一个记号）：

 

```zhizhan-table
{"rows":[[{"body":"记号","header":true,"rowSpan":1,"colSpan":1},{"body":"名字","header":true,"rowSpan":1,"colSpan":1},{"body":"恢复的粒度","header":true,"rowSpan":1,"colSpan":1},{"body":"回到哪个子状态","header":true,"rowSpan":1,"colSpan":1}],[{"body":"**H**","header":false,"rowSpan":1,"colSpan":1},{"body":"浅历史  \nshallow history","header":false,"rowSpan":1,"colSpan":1},{"body":"只记住 **直接子状态** 是哪一个","header":false,"rowSpan":1,"colSpan":1},{"body":"记住了\"上次在 Working\"，但 Working 自己停在哪一步 **忘了** ，它会从自己的 ` initial ` 重新开始","header":false,"rowSpan":1,"colSpan":1}],[{"body":"**H\\***","header":false,"rowSpan":1,"colSpan":1},{"body":"深历史  \ndeep history","header":false,"rowSpan":1,"colSpan":1},{"body":"记住 **整条活跃路径**","header":false,"rowSpan":1,"colSpan":1},{"body":"记住了\"上次在 Working/Steady\"，回来就直接落到 Steady","header":false,"rowSpan":1,"colSpan":1}]]}
```

 

**FIG 7.3**  本节用的那棵树：谁是复合状态，谁能带历史

 

```zhizhan-figure
<svg viewBox="0 0 660 300" width="660" height="300" role="img" aria-label="状态树与浅历史深历史的差别">
          <!-- 树 -->
          <rect x="20" y="18" width="110" height="30" rx="6" class="sv-box" stroke="var(--cyn)"></rect>
          <text x="75" y="38" text-anchor="middle" class="sv-lbl-hi" style="fill:var(--cyn)">S_TOP</text>

          <rect x="20" y="72" width="110" height="30" rx="6" class="sv-box" stroke="var(--grn)"></rect>
          <text x="75" y="92" text-anchor="middle" class="sv-lbl-hi" style="fill:var(--grn)">S_OFF</text>

          <rect x="176" y="72" width="150" height="30" rx="6" class="sv-box" stroke="var(--amb)"></rect>
          <text x="251" y="92" text-anchor="middle" class="sv-lbl-hi" style="fill:var(--amb)">S_RUN　H</text>

          <rect x="176" y="126" width="150" height="30" rx="6" class="sv-box" stroke="var(--grn)"></rect>
          <text x="251" y="146" text-anchor="middle" class="sv-lbl-hi" style="fill:var(--grn)">S_IDLE</text>

          <rect x="176" y="180" width="150" height="30" rx="6" class="sv-box" stroke="var(--amb)"></rect>
          <text x="251" y="200" text-anchor="middle" class="sv-lbl-hi" style="fill:var(--amb)">S_WORKING</text>

          <rect x="368" y="180" width="112" height="30" rx="6" class="sv-box" stroke="var(--grn)"></rect>
          <text x="424" y="200" text-anchor="middle" class="sv-lbl-hi" style="fill:var(--grn)">S_SPINUP</text>

          <rect x="368" y="222" width="112" height="30" rx="6" class="sv-box" stroke="var(--red)"></rect>
          <text x="424" y="242" text-anchor="middle" class="sv-lbl-hi" style="fill:var(--red)">S_STEADY</text>

          <rect x="368" y="264" width="112" height="30" rx="6" class="sv-box" stroke="var(--grn)"></rect>
          <text x="424" y="284" text-anchor="middle" class="sv-lbl-hi" style="fill:var(--grn)">S_SPINDOWN</text>

          <rect x="512" y="126" width="112" height="30" rx="6" class="sv-box" stroke="var(--grn)"></rect>
          <text x="568" y="146" text-anchor="middle" class="sv-lbl-hi" style="fill:var(--grn)">S_FAULT</text>

          <!-- 连线 -->
          <path d="M75 48 V72" class="sv-line"></path>
          <path d="M130 87 H176" class="sv-line"></path>
          <path d="M251 102 V126" class="sv-line"></path>
          <path d="M251 156 V180" class="sv-line"></path>
          <path d="M326 195 H368" class="sv-line"></path>
          <path d="M424 210 V222" class="sv-line"></path>
          <path d="M424 252 V264" class="sv-line"></path>
          <path d="M326 87 C420 87 480 100 512 126" class="sv-line"></path>

          <!-- 右侧说明 -->
          <rect x="512" y="18" width="130" height="88" rx="6" class="sv-amb-s"></rect>
          <text x="524" y="38" class="sv-lbl-hi" style="fill:var(--amb)">两个复合状态</text>
          <text x="524" y="58" class="sv-lbl-dim" style="font-size:10.5px">S_RUN  initial=Idle</text>
          <text x="524" y="76" class="sv-lbl-dim" style="font-size:10.5px">S_WORKING  initial=SpinUp</text>
          <text x="524" y="96" class="sv-lbl-dim" style="font-size:10.5px">带 H 的是 S_RUN</text>
        </svg>
```

 

树一共 9 个节点、最深一条链 4 层。下面是实现 —— 它比 §7.1.2 那份多了 ` history ` 字段、两个历史数组， 以及一段"算出该退出谁、该进入谁"的代码。

 

hsm\_history.c — 层次状态机 \+ 浅/深历史（退出之后回来停在哪儿） C

 

```text
/* hsm_history.c — 层次状态机补两件 7.1.2 里没有的东西：
 *                 ① 历史状态（浅历史 / 深历史）：回到"上次停在哪儿"；
 *                 ② HANDLED 与 TRANS 的区别，以及派发期间重入怎么办。
 *
 * 7.1.2 那份 hsm.c 已经能算 LCA、能沿父链冒泡，但它退出复合状态时**什么都不记**。
 * 于是「运行 → 故障 → 清故障」回来永远是进初始子状态，
 * 而不是回到故障前那一层 —— 对电机这类"故障前正在加速"的系统，
 * 这一个差别就是「平滑恢复」和「重新起步」的差别。
 *
 * 另一处：hsm_result_t 里 HANDLED 和 TRANSITION 在 hsm_dispatch 里被
 * `if (r == HANDLED || r == TRANSITION)` 一句合并判掉了 —— 两个名字、一套行为，
 * 读到这里的人都会先愣一下"那要两个名字干嘛"。本文件让它俩真的不同
 * （区别在"派发结束后要不要把事件重投给新状态"），并给重投加了预算，
 * 免得把"区别"实现成"死循环"。
 *
 * ── 这份文件能被怎样验证 ───────────────────────────────────
 * 手边没有 qemu，也没有目标硬件，所以**它的运行时行为没有被执行过**。
 * 能拿到的证据只有三类，正文里会逐条标明：
 *   · 编译期断言与结构体尺寸：编译器替我们算的，不是我们说的；
 *   · 反汇编与符号表：各函数的指令条数、各段体积；
 *   · 对**源码里那棵树**的静态分析（tools/sm_model.js）：
 *     树的自洽性，以及三种历史配置下的落点差异。
 * 第三类是"读这份 C 的**数据**"，不是"跑这份 C 的**代码**"，正文会分开写。
 */
#include <stdint.h>
#include <stddef.h>
#include <stdbool.h>

#define HSM_MAX_DEPTH       8       /* 一条父子链最多 8 层 */
#define HSM_MAX_COMPOSITE   8       /* 带历史的复合状态最多 8 个 */

typedef struct hsm hsm_t;
typedef struct hsm_state hsm_state_t;
typedef uint32_t hsm_event_t;

/* 返回值的三个名字：
   IGNORED = 0 是有意的 —— 零初始化的默认值必须是"我不处理"，
   而不能是"我处理了"（否则某个忘了写 return 的函数会静默吞掉事件）。 */
typedef enum {
    HS_IGNORED = 0,     /* 本状态不管，交给父状态 */
    HS_HANDLED,         /* 处理了，状态没变：派发到此为止 */
    HS_TRANS            /* 处理了，状态已变：派发到此为止，再把事件重投一次给新状态 */
} hsm_result_t;

_Static_assert(HS_IGNORED == 0, "IGNORED must be zero: it is the default return value");

typedef enum {
    HIST_NONE = 0,      /* 不记历史：每次回来都从 initial 子状态开始 */
    HIST_SHALLOW,       /* 浅历史：只记"上次活跃的直接子状态" */
    HIST_DEEP           /* 深历史：记"从自己往下到叶子的整条路径" */
} history_t;

struct hsm_state {
    const char        *name;
    const hsm_state_t *parent;      /* NULL = 顶层 */
    const hsm_state_t *initial;     /* 复合状态的默认子状态；NULL = 原子（叶子）状态 */
    history_t          history;
    hsm_result_t (*on_event)(hsm_t *hsm, hsm_event_t ev);
    void         (*on_enter)(hsm_t *hsm);
    void         (*on_exit)(hsm_t *hsm);
};

struct hsm {
    const hsm_state_t *current;

    /* ---- 历史记忆 ----
       ⚠ slots 和 shallow 必须是两个数组。第一版把它们合成一个
       （"登记时把 shallow[slot] 写成状态自己的指针当占位符"），
       结果冷启动第一次进复合状态时，shallow[slot] 恰好等于它本人 ——
       于是"走记忆"走进了自己，栈直接卡死在原地。
       占位符和数据共用一个槽位，是这类代码里最省事也最贵的错误。 */
    const hsm_state_t *slots[HSM_MAX_COMPOSITE];    /* 槽位 → 复合状态 */
    const hsm_state_t *shallow[HSM_MAX_COMPOSITE];  /* 槽位 → 上次活跃的直接子状态 */
#ifndef HSM_NO_DEEP_HISTORY
    const hsm_state_t *deep[HSM_MAX_COMPOSITE][HSM_MAX_DEPTH]; /* 槽位 → 整条路径 */
    uint8_t            deep_len[HSM_MAX_COMPOSITE];
#endif
    uint8_t  composite_count;
    bool     busy;                  /* 正在派发：此时新事件只能进队列 */
    uint8_t  head, queued;
    hsm_event_t queue[HSM_MAX_DEPTH];

    uint32_t transition_count;
    uint32_t rejected_count;        /* 冒泡到顶也没人处理的事件数 */
    uint32_t redispatch_count;      /* 因 HS_TRANS 而重投过几次 */
    hsm_event_t last_redispatch_ev;
    void    *user;
};

/* ============================================================
   状态树
   ------------------------------------------------------------
   形状刻意做成"两层复合"，因为浅历史和深历史的差别
   只有嵌套复合状态才看得出来：

     TOP
      ├─ Off                        原子
      └─ Run            复合 · initial=Idle
          ├─ Idle                   原子
          ├─ Working    复合 · initial=SpinUp
          │   ├─ SpinUp             原子
          │   ├─ Steady             原子
          │   └─ SpinDown           原子
          └─ Fault                  原子
   ============================================================ */
enum {
    S_TOP = 0, S_OFF, S_RUN, S_IDLE, S_WORKING, S_SPINUP, S_STEADY, S_SPINDOWN, S_FAULT,
    S_COUNT
};

/* 事件号：0 是无效值，理由同 sm_event.c —— 零初始化的东西不能是真事件。 */
enum { EV_NONE = 0, EV_GO, EV_STOP, EV_FAULT, EV_CLEAR,
       EV_JOIN_WORK, EV_WORK_DONE, EV_STOP_WORK, EV_COUNT };

/* 三种历史配置，用来把"浅/深"的差别摆成三行可对照的序列。
   序列（都从冷启动开始）：
     GO → Run/Idle，JOIN_WORK → Run/Working/SpinUp，WORK_DONE → Run/Working/Steady，
     STOP → Off（此时记下 Run 的历史），再 GO → 落点见下面每行的注释。

   ⚠ CFG_DEEP 被 #ifndef 包着，这不是排版洁癖：
   深历史那份代码一旦被 -DHSM_NO_DEEP_HISTORY 裁掉，
   如果枚举里还留着 CFG_DEEP，调用方写 hsm_set_config(&h, CFG_DEEP)
   会**编译通过、运行期静默不记历史** —— 裁的是能力，坏的是语义。
   把开关本身一起裁掉，误用就变成一条 undeclared identifier 的编译错误。
   裁剪一个能力时，记得连它的开关一起裁。 */
typedef enum {
    CFG_SHALLOW_ONLY = 0,   /* Run=浅, Working=不记 → 回来落在 Run/Working/SpinUp */
    CFG_NESTED_SHALLOW,     /* Run=浅, Working=浅 → 回来落在 Run/Working/Steady */
#ifndef HSM_NO_DEEP_HISTORY
    CFG_DEEP                /* Run=深, Working=不记 → 回来落在 Run/Working/Steady */
#endif
} hist_cfg_t;

static hsm_state_t g_tree[S_COUNT];
static hsm_t       g_hsm;               /* 演示用的单实例 */

/* ============================================================
   路径工具
   ------------------------------------------------------------
   path[0] 是 s 自己，path[n-1] 是顶层 —— 一律"由内向外"存。
   存成这个方向，LCA 比较深度时正好用下标算：depth = n-1-i。
   ============================================================ */
static int path_to_root(const hsm_state_t *s, const hsm_state_t **out, int cap)
{
    int n = 0;
    for (; s && n < cap; s = s->parent) out[n++] = s;
    return n;
}

/* 找公共祖先：返回它在两条路径里的下标（cur 用 *ic，tgt 用 *it）。
   比的是**深度**不是下标 —— 下标只在各自路径里有意义，
   两条路径长度不同时，"下标相同"和"同一个状态"完全是两码事。 */
static bool find_lca(const hsm_state_t **cur, int cn,
                     const hsm_state_t **tgt, int tn,
                     int *ic, int *it)
{
    int best = -1;
    for (int i = 0; i < cn; i++) {
        for (int j = 0; j < tn; j++) {
            if (cur[i] != tgt[j]) continue;
            const int depth = cn - 1 - i;            /* 该状态离根的距离 */
            if (depth > best) { best = depth; *ic = i; *it = j; }
        }
    }
    return best >= 0;                                /* 同一棵树里恒为 true */
}

/* 复合状态登记表：只往 slots[] 里写，绝不碰 shallow[]（见结构体里的注释）。 */
static int hist_slot(hsm_t *hsm, const hsm_state_t *s)
{
    if (s->history == HIST_NONE) return -1;
    for (uint8_t i = 0; i < hsm->composite_count; i++) {
        if (hsm->slots[i] == s) return (int)i;
    }
    if (hsm->composite_count >= HSM_MAX_COMPOSITE) return -1;
    hsm->slots[hsm->composite_count] = s;
    hsm->shallow[hsm->composite_count] = NULL;       /* 新槽位 = "没有记忆"，不是"记着自己" */
#ifndef HSM_NO_DEEP_HISTORY
    hsm->deep_len[hsm->composite_count] = 0;
#endif
    return (int)hsm->composite_count++;
}

/* ============================================================
   ① 退出：顺手把"上次停在哪儿"记下来
   ------------------------------------------------------------
   path[0] 是当前叶子，path[k] 的父是 path[k+1]。
   要给 parent（path[k+1]）记的"活跃直接子状态"是 **path[k]**，
   记成 path[k+1] 自己的话恢复出来会停在原地 —— 这个反向错误
   是浅历史最常见的 bug，注释留在这里，是为了下次改代码时先看到它。

   循环上界是 ic-1 而不是 ic-2：**LCA 本身不退，但它的历史必须记**。
   "退到 LCA 之下"说的是别把 LCA 的 on_exit 跑了，
   不是"别管 LCA 停在哪"。这两件事混起来，就会出现
   "Run 明明退出了、历史却是空的"这种查半天的毛病。
   ============================================================ */
static void hsm_exit_below(hsm_t *hsm, const hsm_state_t **path, int ic)
{
    for (int k = 0; k < ic; k++) {
        const hsm_state_t *s      = path[k];
        const hsm_state_t *parent = path[k + 1];
        const int slot = hist_slot(hsm, parent);
        if (slot >= 0) {
            hsm->shallow[slot] = s;                  /* 浅历史：直接子状态就是 s */
#ifndef HSM_NO_DEEP_HISTORY
            /* 深历史：从 s 往下直到叶子的整条路径，由外向内 */
            uint8_t n = 0;
            for (int j = k; j >= 0 && n < HSM_MAX_DEPTH; j--) hsm->deep[slot][n++] = path[j];
            hsm->deep_len[slot] = n;
#endif
        }
        if (s->on_exit) s->on_exit(hsm);
    }
}

/* ============================================================
   ② 进入：把"要进哪些状态"先算成一张栈，再照着 enter
   ------------------------------------------------------------
   为什么用栈而不递归：往下走的时候，每碰到一个复合状态都要问三件事 ——
   带不带历史？记忆里有没有东西？记忆指向的**还是不是一个复合状态**？
   递归写法会在第三问上打结（"记忆指向的仍是复合状态"要接着问下去，
   而递归的形态逼你把这层循环塞进递归调用里）。压成一张显式栈之后，
   while 一圈问一次，三问变成一次判断。
   ============================================================ */
static int build_entry_stack(hsm_t *hsm, const hsm_state_t *start,
                             const hsm_state_t **stack)
{
    int n = 0;
    const hsm_state_t *s = start;
    while (s && n < HSM_MAX_DEPTH) {
        stack[n++] = s;
        if (!s->initial) break;                      /* 原子状态：到此为止 */

        const hsm_state_t *next = NULL;
        const int slot = hist_slot(hsm, s);
        if (slot >= 0) {
#ifndef HSM_NO_DEEP_HISTORY
            if (s->history == HIST_DEEP && hsm->deep_len[slot] > 0) {
                /* 深历史：记忆里存的就是整条路，一次接上，后面的层不再问 */
                for (uint8_t d = 0; d < hsm->deep_len[slot] && n < HSM_MAX_DEPTH; d++) {
                    stack[n++] = hsm->deep[slot][d];
                }
                break;
            }
#endif
            if (s->history == HIST_SHALLOW) next = hsm->shallow[slot];
        }
        if (!next) next = s->initial;                /* 没记忆（冷启动）→ 走初始子状态 */
        s = next;
    }
    return n;
}

static void enter_stack(hsm_t *hsm, const hsm_state_t **stack, int n)
{
    for (int k = 0; k < n; k++) {
        hsm->current = stack[k];                     /* 先落位再回调：钩子里读 current 才不滞后 */
        if (stack[k]->on_enter) stack[k]->on_enter(hsm);
    }
}

/* ============================================================
   ③ 转移：exit 到 LCA 之下 → enter 到目标
   ============================================================ */
void hsm_transition(hsm_t *hsm, const hsm_state_t *target)
{
    const hsm_state_t *cur[HSM_MAX_DEPTH], *tgt[HSM_MAX_DEPTH];
    const int cn = path_to_root(hsm->current, cur, HSM_MAX_DEPTH);
    const int tn = path_to_root(target,     tgt, HSM_MAX_DEPTH);
    int ic = 0, it = 0;
    if (!find_lca(cur, cn, tgt, tn, &ic, &it)) return;   /* 不在一棵树里，无从下手 */

    hsm_exit_below(hsm, cur, ic);

    const hsm_state_t *entry[HSM_MAX_DEPTH];
    int en;
    if (it == 0) {
        /* 目标在当前的祖先链上（含"目标就是自己"）。
           UML 的**外部**转移语义是：连目标自己也要先退再进 ——
           这正是"外部自转移"和"内部转移"唯一的分界。
           如果这里省掉 on_exit，自转移就退化成了内部转移。 */
        if (tgt[0]->on_exit) tgt[0]->on_exit(hsm);
        en = build_entry_stack(hsm, tgt[0], entry);
    } else {
        en = build_entry_stack(hsm, tgt[it - 1], entry);
    }
    enter_stack(hsm, entry, en);
    hsm->transition_count++;
}

void hsm_enter_initial(hsm_t *hsm, const hsm_state_t *top)
{
    const hsm_state_t *stack[HSM_MAX_DEPTH];
    enter_stack(hsm, stack, build_entry_stack(hsm, top, stack));
}

/* ============================================================
   ④ 派发：冒泡 + 重入排队 + TRANS 之后的重投
   ------------------------------------------------------------
   三个名字在这里才真的分开：
   · IGNORED → 交给父状态（冒泡）；冒到顶层还没人接就记 rejected；
   · HANDLED → 就地结束，**不重投**；
   · TRANS   → 就地结束，**把同一个事件再投一遍给新状态**（预算 1）。
   合并 HANDLED/TRANS 的老写法省不掉一行代码，却让"要不要重投"
   这个决定无处表达 —— 而它决定了"进了新状态立刻自发一次"这类
   常见需求，究竟是写成 on_enter 里的一次偷偷调用，还是一条正经的转移。
   ============================================================ */
static hsm_result_t hsm_process(hsm_t *hsm, hsm_event_t ev, int budget)
{
    const hsm_state_t *s = hsm->current;
    while (s) {
        const hsm_result_t r = s->on_event ? s->on_event(hsm, ev) : HS_IGNORED;
        if (r == HS_TRANS) {
            if (budget > 0) {                        /* 重投一次，给新状态一个机会 */
                hsm->redispatch_count++;
                hsm->last_redispatch_ev = ev;
                return hsm_process(hsm, ev, budget - 1);
            }
            return r;                                /* 预算用完：不再重投，避免死循环 */
        }
        if (r == HS_HANDLED) return r;
        s = s->parent;                               /* IGNORED：冒泡 */
    }
    hsm->rejected_count++;
    return HS_IGNORED;
}

hsm_result_t hsm_dispatch(hsm_t *hsm, hsm_event_t ev)
{
    if (hsm->busy) {                                 /* 派发中再来事件：排队，不递归 */
        if (hsm->queued < HSM_MAX_DEPTH) {
            hsm->queue[(hsm->head + hsm->queued) % HSM_MAX_DEPTH] = ev;
            hsm->queued++;
        }
        return HS_IGNORED;
    }
    hsm->busy = true;
    const hsm_result_t r = hsm_process(hsm, ev, 1);
    while (hsm->queued) {
        const hsm_event_t next = hsm->queue[hsm->head];
        hsm->head = (uint8_t)((hsm->head + 1) % HSM_MAX_DEPTH);
        hsm->queued--;
        hsm_process(hsm, next, 1);
    }
    hsm->busy = false;
    return r;
}

/* ============================================================
   ⑤ 状态自己的事件处理：只认自己的事，其余一律 IGNORED
   ------------------------------------------------------------
   注意每个函数**只处理自己的事件、其余返回 IGNORED** ——
   "在 Working 里按 STOP 也能停"靠的不是 Working 认识 STOP，
   而是这一层的 IGNORED 把它交给了父状态 Run。
   这就是层次状态机相对平表状态机省下的那份重复：
   父状态写一次，所有子孙白拿。
   ============================================================ */
static uint32_t g_entered[S_COUNT], g_exited[S_COUNT];

static hsm_result_t ev_idle(hsm_t *h, hsm_event_t ev)
{
    if (ev == EV_JOIN_WORK) { hsm_transition(h, &g_tree[S_WORKING]); return HS_TRANS; }
    return HS_IGNORED;
}

static hsm_result_t ev_working_child(hsm_t *h, hsm_event_t ev)
{
    (void)h;
    if (ev == EV_WORK_DONE) { hsm_transition(h, &g_tree[S_STEADY]);   return HS_TRANS; }
    if (ev == EV_STOP_WORK) { hsm_transition(h, &g_tree[S_SPINDOWN]); return HS_TRANS; }
    return HS_IGNORED;
}

static hsm_result_t ev_run(hsm_t *h, hsm_event_t ev)
{
    if (ev == EV_STOP)  { hsm_transition(h, &g_tree[S_OFF]);   return HS_TRANS; }
    if (ev == EV_FAULT) { hsm_transition(h, &g_tree[S_FAULT]); return HS_TRANS; }
    return HS_IGNORED;
}

static hsm_result_t ev_top(hsm_t *h, hsm_event_t ev)
{
    if (ev == EV_GO) { hsm_transition(h, &g_tree[S_RUN]); return HS_TRANS; }
    return HS_IGNORED;
}

/* 指针减指针算下标：只有在"所有状态都住在同一个数组里"时才成立。
   真项目里状态树常分散在多个 .c 里，那时必须给 hsm_state_t 加一个显式 id ——
   不要把这行当通用写法照抄。这里能这么写，是因为 g_tree 就是全部。 */
static int state_idx(const hsm_state_t *s)
{
    const ptrdiff_t i = s - g_tree;
    return (i >= 0 && i < S_COUNT) ? (int)i : -1;
}

static void mark_enter(hsm_t *h) { const int i = state_idx(h->current); if (i >= 0) g_entered[i]++; }
static void mark_exit (hsm_t *h) { const int i = state_idx(h->current); if (i >= 0) g_exited[i]++;  }

/* ============================================================
   建树 + 三种历史配置
   ------------------------------------------------------------
   写成"逐个赋值"而不是静态初始化列表，是因为历史配置要在运行期可改
   （三种配置共用同一棵树，对照才成立）。g_tree 因此不是 const ——
   代价是这棵树进 .data 而不是 .rodata，正文里会给出两种写法的体积差。
   ============================================================ */
static void tree_init(void)
{
    g_tree[S_TOP]      = (hsm_state_t){ "TOP",      NULL,              &g_tree[S_OFF],     HIST_NONE, ev_top,           mark_enter, mark_exit };
    g_tree[S_OFF]      = (hsm_state_t){ "Off",      &g_tree[S_TOP],    NULL,               HIST_NONE, NULL,             mark_enter, mark_exit };
    g_tree[S_RUN]      = (hsm_state_t){ "Run",      &g_tree[S_TOP],    &g_tree[S_IDLE],    HIST_SHALLOW, ev_run,        mark_enter, mark_exit };
    g_tree[S_IDLE]     = (hsm_state_t){ "Idle",     &g_tree[S_RUN],    NULL,               HIST_NONE, ev_idle,          mark_enter, mark_exit };
    g_tree[S_WORKING]  = (hsm_state_t){ "Working",  &g_tree[S_RUN],    &g_tree[S_SPINUP],  HIST_NONE, ev_working_child, mark_enter, mark_exit };
    g_tree[S_SPINUP]   = (hsm_state_t){ "SpinUp",   &g_tree[S_WORKING],NULL,               HIST_NONE, ev_working_child, mark_enter, mark_exit };
    g_tree[S_STEADY]   = (hsm_state_t){ "Steady",   &g_tree[S_WORKING],NULL,               HIST_NONE, ev_working_child, mark_enter, mark_exit };
    g_tree[S_SPINDOWN] = (hsm_state_t){ "SpinDown", &g_tree[S_WORKING],NULL,               HIST_NONE, ev_working_child, mark_enter, mark_exit };
    g_tree[S_FAULT]    = (hsm_state_t){ "Fault",    &g_tree[S_RUN],    NULL,               HIST_NONE, NULL,             mark_enter, mark_exit };
}

void hsm_set_config(hsm_t *hsm, hist_cfg_t cfg)
{
    (void)hsm;
#ifdef HSM_NO_DEEP_HISTORY
    /* CFG_DEEP 在这个配置下不存在，写到这里编译器已经先拦了一道。
       g_tree[S_RUN].history 于是只能是浅历史或不记。 */
    g_tree[S_RUN].history = HIST_SHALLOW;
#else
    g_tree[S_RUN].history = (cfg == CFG_DEEP) ? HIST_DEEP : HIST_SHALLOW;
#endif
    g_tree[S_WORKING].history = (cfg == CFG_NESTED_SHALLOW) ? HIST_SHALLOW : HIST_NONE;
}

void hsm_init(hsm_t *hsm)
{
    tree_init();
    for (int i = 0; i < HSM_MAX_COMPOSITE; i++) {
        hsm->slots[i] = NULL;
        hsm->shallow[i] = NULL;
#ifndef HSM_NO_DEEP_HISTORY
        hsm->deep_len[i] = 0;
#endif
    }
    hsm->composite_count = 0;
    hsm->busy = false;
    hsm->head = hsm->queued = 0;
    hsm->transition_count = hsm->rejected_count = hsm->redispatch_count = 0;
    hsm->last_redispatch_ev = EV_NONE;
    hsm->user = NULL;
    hsm->current = &g_tree[S_TOP];
    hsm_enter_initial(hsm, &g_tree[S_TOP]);
}

hsm_state_t *hsm_tree(void)            { return g_tree; }
hsm_t       *hsm_demo(void)            { return &g_hsm; }
uint32_t     hsm_entered(int i)        { return (i >= 0 && i < S_COUNT) ? g_entered[i] : 0; }
uint32_t     hsm_exited(int i)         { return (i >= 0 && i < S_COUNT) ? g_exited[i]  : 0; }

/* ============================================================
   使用与自检（这段只是注释 —— 没有主机可跑，见文件头）
   ------------------------------------------------------------
     hsm_init(&g_hsm);
     hsm_set_config(&g_hsm, CFG_SHALLOW_ONLY);
     hsm_dispatch(&g_hsm, EV_GO);           // TOP → Run/Idle
     hsm_dispatch(&g_hsm, EV_JOIN_WORK);    // Run/Idle → Run/Working/SpinUp
     hsm_dispatch(&g_hsm, EV_WORK_DONE);    // Working/SpinUp → Working/Steady（子处理，父不管）
     hsm_dispatch(&g_hsm, EV_STOP);         // 退出 Run 整棵子树，顺手记下 Run 的历史
     hsm_dispatch(&g_hsm, EV_GO);           // 再进 Run —— 落点就是三种配置的差别所在
   ============================================================ */
```

 

#### 算这条路径：先找 LCA，再决定退出谁、进入谁

 

一次跨层次的转移，本质上是三步：  **① 找两条路径的分岔点（LCA）**  →  **② 从当前状态往上退到 LCA（不含 LCA）**  →  **③ 从 LCA 往下进到目标（不含 LCA）** 。 第 ③ 步在遇到带历史的复合状态时，走的是 **记忆** 而不是 ` initial `。

 

✖ 这段代码里有三个坑，我第一个版本踩了两个

 

**① 退出循环的上界是 ` ic - 1 `，不是 ` ic - 2 `。**  直觉是"LCA 不退出，所以循环到 LCA 的前一个为止"，于是写成 ` ic - 2 `。 错在： *LCA 自己确实不退出，但 LCA 的 **历史必须记下来***  —— 而记录"我上次的孩子是谁"这件事，恰好发生在这轮循环里。少跑一轮，等于历史永远记不上。

 

**② 记的是 ` path[k] `，不是 ` path[k+1] `。**  ` path[] ` 是"根 → 叶"的顺序，所以 ` path[k] ` 是孩子、 ` path[k+1] ` 才是父亲。给父亲记历史，要记的是 **它的孩子**  （` path[k] `）。写反了编译一样过，运行时表现是"回到上一层"，很难查。

 

**③ 注册表和历史数据必须分成两个数组。**  我第一个版本为了省事，让"已注册的复合状态"和"它记住的孩子"共用同一个槽位， 用 ` hsm->shallow[slot] ` 同时当两者 —— 冷启动时那个占位值还在， 于是状态机第一次进这个复合状态，读到的历史是 **它自己** ，一头撞进自己里面。  *占位符和数据共用一个槽位，是这类代码里最省事也最贵的错误。*

 

#### 三种配置，三个不同的落点

 

"浅"和"深"不是二选一，而是 **每个复合状态各自声明** 的。 本节准备了三种配置，跑同一个场景，落在三个位置上：

 

| 配置 | S\_RUN | S\_WORKING | 重新进入 RUN 后落在 |
| --- | --- | --- | --- |
| ` CFG_SHALLOW_ONLY ` | HIST\_SHALLOW | HIST\_NONE | **RUN / Working / SpinUp**  —— 外层记住了 Working，内层从头开始 |
| ` CFG_NESTED_SHALLOW ` | HIST\_SHALLOW | HIST\_SHALLOW | **RUN / Working / Steady**  —— 每层各记自己的一层，叠起来正好是完整路径 |
| ` CFG_DEEP ` | HIST\_DEEP | HIST\_NONE | **RUN / Working / Steady**  —— 外层一个人记住整条路径 |

 

场景是 ` GO → JOIN_WORK → WORK_DONE → STOP → GO `（最后那个 ` GO ` 是重新进入）。 重放出来的轨迹长这样：

 

```text
S_OFF →(GO)→ S_IDLE →(JOIN_WORK)→ S_SPINUP →(WORK_DONE)→ S_STEADY →(STOP)→ S_OFF →(GO)→ 落点
```

 

◆ 这张表里最有用的一行，是第 2 行和第 3 行

 

**逐层都开浅历史** （` CFG_NESTED_SHALLOW `）和  **只在外层开深历史** （` CFG_DEEP `）  **落点完全一样** 。这句话值钱的地方在于：两条路殊途同归， 但 **代价差一倍**  —— 一个是每层存一个指针，一个是在最外层存一整条路径。  *路径深、层数多的时候，"逐层浅历史"通常是更划算的那个选择。*

 

#### 验证：能钉死的部分和钉不死的部分

 

本机 **没有 qemu、也没有目标硬件** ，所以这份文件 **一次都没有被运行过** 。 这一点必须先说清楚，再看下面三类证据各自能证明什么：

 

 
1. **编译期断言** （钉得最死）：结构体多大、数组多长、枚举值是不是 0 —— 编译不过就是不过。
 
2. **体积与指令数** （实测）：每个功能的代价是多少字节，直接读出来。
 
3. **静态检查 \+ 影子实现** （钉得不死）：脚本解析 C 源码、照抄算法算一遍落点。 *它能说明落点由哪几个量决定，不能说明 C 里那几行写对了。*
 

 

先看第一类。这份文件里所有关键尺寸都写成了 ` _Static_assert `， 编译一次就是一次验证：

 

hsm\_size.c — 这份文件不产出机器码，只让编译器把结构体尺寸算出来 C

 

```text
/* hsm_size.c —— 这份文件不产出任何机器码，它只干一件事：
 *              让**编译器**替我们把结构体尺寸算出来，钉死。
 *
 * 手段是把真文件整个 include 进来。这一条很关键：
 * 量到的必须是 hsm_history.c 里那个结构体本身，
 * 而不是在旁边照抄一份"长得一样"的定义 —— 照抄的那份迟早会漂移，
 * 于是"尺寸断言"会从证据退化成装饰。
 *
 * 断言通过 = 编译通过 = 退出码 0，这就是可被闸门抓住的证据。
 */
#include "hsm_history.c"

/* 状态节点：name(4) + parent(4) + initial(4) + history(1) + 3 填充 +
              on_event(4) + on_enter(4) + on_exit(4) = 28
   history 只占 1 字节，是 ARM EABI 默认 -fshort-enums 的结果：
   枚举只取容纳取值范围的最小整型，history_t 最大才到 2。
   ⚠ 别看它只占 1 字节就以为换成 -fno-short-enums 会把这棵树撑大：
     history 自己确实从 1 涨到 4（实测），但这个节点【仍然是 28】——
     紧跟在它后面的那 3 个字节本来就是填充，涨出来的部分被整个吃掉，
     所以连 sizeof(g_tree) = 252 也一个字节没变。
     下面这两条断言在【两种 ABI 下都通过】，这就是它的物证。
   这条注释的第一版写的是"这个节点会变成 32"—— 那是手算出来的，
   而手算恰恰是会错的那一种：值不值得涨，取决于填充位在第几个字段后面。
   所以结论只有一条：结构体占几字节，让编译器回答，别手算。 */
_Static_assert(sizeof(hsm_state_t) == 28, "state node should be 28 bytes");

/* 9 个状态的树 = 252 字节。注意它住在 .bss 而不是 .rodata ——
   因为 history 字段要能在运行期改（三种配置共用同一棵树）。 */
_Static_assert(sizeof(g_tree) == 9 * 28, "tree should be 252 bytes");

/* 整机对象。
   深历史那一块的成本可以直接读出来：
     8 个槽位 × (1 个指针 + 8 层路径 × 4 字节) = 8 × 36 = 288？不对 ——
     8 × (8×4 + 1) = 8 × 33 = 264，再对 4 字节对齐补成 264。
   124 + 264 = 388。想要深历史，这就是明码标价的 264 字节 RAM。 */
#ifdef HSM_NO_DEEP_HISTORY
_Static_assert(sizeof(hsm_t) == 124, "hsm without deep history should be 124 bytes");
#else
_Static_assert(sizeof(hsm_t) == 388, "hsm with deep history should be 388 bytes");
#endif

/* 两个计数器数组，只为让"哪条转移真的走了"能被外部看见 */
_Static_assert(sizeof(g_entered) + sizeof(g_exited) == 72, "counters should be 72 bytes");
```

 

**bash**  — 同一份断言、三种配置：默认 / 关掉深历史 / 关掉短枚举

 

```text
$ # 断言通过 = 编译通过 = rc 0。三种配置逐个编：
$ for cfg in "" "-DHSM_NO_DEEP_HISTORY" "-fno-short-enums"; do
>   printf '%-24s' "${cfg:-（默认）}"
>   arm-none-eabi-gcc -c -mcpu=cortex-m3 -mthumb -O2 -Wall -Wextra -Wpedantic \
>       $cfg -o /dev/null hsm_size.c && echo "rc=0  编译期断言全部通过"
> done
（默认）                  rc=0  编译期断言全部通过
-DHSM_NO_DEEP_HISTORY    rc=0  编译期断言全部通过
-fno-short-enums         rc=0  编译期断言全部通过
```

 

三种配置全过，说明这些尺寸是 **写在断言里、被编译器逐个核对过** 的： 状态节点 28 字节、树 9 × 28 = 252 字节、 整机对象 388（带深历史）/ 124（不带）、两个计数器 72 字节。

 

注意断言是 **把真文件整个 ` #include ` 进来** 再量的 （` #include "hsm_history.c" `），而不是在旁边照抄一份"长得一样"的定义。 这一点决定了断言是证据还是装饰：照抄的那份迟早会漂移， 而漂移之后 **断言照样通过** ，只是它核对的已经不是真东西了。

 

#### 深历史值多少钱：264 字节 RAM \+ 172 字节 flash

 

**bash**  — 开关一次 ` -DHSM_NO_DEEP_HISTORY `，段体积与对象尺寸的差

 

```text
$ arm-none-eabi-size -A hs.o        # 默认（带深历史）
.text             1504      0
.data                0      0
.bss               712      0
.rodata.str1.4      64      0
.rodata            252      0        ← 9 × 28：运行期赋值产生的模板
$ arm-none-eabi-size -A hs_nd.o     # -DHSM_NO_DEEP_HISTORY
.text             1332      0        ← 少 172
.bss               448      0        ← 少 264
$ arm-none-eabi-nm --print-size --size-sort hs.o | grep -E 'g_tree|g_hsm'
00000000 000000fc b g_tree            ← 0xfc = 252 = 9 × 28
00000144 00000184 b g_hsm             ← 0x184 = 388
$ arm-none-eabi-nm --print-size --size-sort hs_nd.o | grep g_hsm
00000144 0000007c b g_hsm             ← 0x7c = 124     388 − 124 = 264
```

 

264 这个数字是可以手算核对的： 8 个槽位 ×（1 字节长度 \+ 8 层路径 × 4 字节） = 8 × 33 = 264。三个数字全都来自 ` HSM_MAX_COMPOSITE ` 和 ` HSM_MAX_DEPTH ` 两个宏 ——  **想把 RAM 砍一半，改这两个宏就行，改完断言会告诉你新尺寸是多少** 。

 

✔ 这就是"编译期断言"最实用的地方

 

断言写死之后， **改宏的那一次编译会立刻失败** ，报出期望值与实际值。 于是"我把深度从 8 调到 4 会省多少 RAM"这个问题，不需要读代码、不需要跑程序， 改一个数字、编一次、读报错就够了。断言在这里的作用不是"防别人改坏"， 而是 **把一次计算变成一次编译** 。

 

#### 裁掉的能力，要在编译期就拦下来

 

关掉深历史之后，` hsm_set_config(&h, CFG_DEEP) ` 这句调用该怎么办？ 两种做法：让它编过然后运行时静默降级，或者让它 **根本编不过** 。 本节选后者 —— 做法是把 ` CFG_DEEP ` 这个枚举成员本身也包进 ` #ifndef ` 里：

 

**bash**  — 同一个调用点，两种配置

 

```text
$ cat caller.c
#include "hsm_history.c"
void use_cfg_deep(hsm_t *h) { hsm_set_config(h, CFG_DEEP); }
$ arm-none-eabi-gcc -c -mcpu=cortex-m3 -mthumb -O2 -o /dev/null caller.c
（无输出，rc=0）
$ arm-none-eabi-gcc -c -mcpu=cortex-m3 -mthumb -O2 -DHSM_NO_DEEP_HISTORY -o /dev/null caller.c
caller.c: In function 'use_cfg_deep':
caller.c:2:49: error: 'CFG_DEEP' undeclared (first use in this function)
    2 | void use_cfg_deep(hsm_t *h) { hsm_set_config(h, CFG_DEEP); }
      |                                                 ^~~~~~~~
caller.c:2:49: note: each undeclared identifier is reported only once for each function it appears in
```

 

⚠ 裁能力要连开关一起裁

 

只把实现裁掉、把枚举留着，误用就会 **静默降级** ： 调用方写了 ` CFG_DEEP `，编过、跑起来、行为却是浅历史 —— 这种 bug 在现场的表现是"偶尔回到错误的位置"，没有任何日志能指向它。 把开关一起裁掉，同一句代码就在编译期变成一条 ` undeclared `，  **错误从"偶发行为异常"变成"编译不过"** ，这是性价比最高的一次改动。

 

#### 深历史的另一种写法：让树本身是 ` const `

 

本节这棵树住在 ` .bss `（` g_tree ` 是 ` b ` 类型符号）， 因为它要能被三种配置在运行期改写 —— 这是为了 **在一页纸上演示三种配置** 而付的代价： 252 字节 RAM。

 

真实工程里不会这么干。 **配置是编译期定死的** ，所以状态树可以是 ` static const ` 的，整棵树进 flash、RAM 一个字节不占。 代价是那三种配置不能共存于一个固件里 —— 而这在嵌入式里根本不算代价。  *本节为了对比才让它可变，你抄的时候应该抄成 ` const `。*

 

#### 再看一眼那个反例：枚举真的不一定涨

 

§7.1.3 留下过一句话：枚举的体积必须逐个结构体去量。这里就是那个反例 —— ` hsm_state_t ` 里有一个 ` history_t ` 枚举， 用 ` -fno-short-enums ` 编译时它自己从 1 字节涨到 4 字节， 但 **整个结构体仍然是 28 字节** （上一页那条断言在 ` -fno-short-enums ` 下照样通过，就是证据）。

 

```zhizhan-table
{"rows":[[{"body":"结构体","header":true,"rowSpan":1,"colSpan":1},{"body":"默认（短枚举）","header":true,"rowSpan":1,"colSpan":1},{"body":"` -fno-short-enums `","header":true,"rowSpan":1,"colSpan":1},{"body":"为什么","header":true,"rowSpan":1,"colSpan":1}],[{"body":"` transition_t `  \n§7.1.3","header":false,"rowSpan":1,"colSpan":1},{"body":"12","header":false,"rowSpan":1,"colSpan":1},{"body":"16","header":false,"rowSpan":1,"colSpan":1},{"body":"两个枚举各涨 3 字节；其中 2 字节能塞进原有填充，净涨 4。 **真的涨了**","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` hsm_state_t `  \n本节","header":false,"rowSpan":1,"colSpan":1},{"body":"28","header":false,"rowSpan":1,"colSpan":1},{"body":"28","header":false,"rowSpan":1,"colSpan":1},{"body":"` history ` 在偏移 12、` on_event ` 在偏移 16，中间那 3 个字节 **本来就是填充**  —— 涨出来的部分被整个吃掉","header":false,"rowSpan":1,"colSpan":1}]]}
```

 

两个结构体只差了几个字段的排列，结论就完全相反。所以"枚举占几字节"这个问题，  **不能脱离结构体回答** ；而"结构体占几字节"这个问题， 不该靠手算 —— 写一条 ` _Static_assert ` 让编译器回答。

   

```zhizhan-anchor
ch7-1-5
```



### 7.1.5 重入、线程安全与代码生成工具链

 

§7.1.3 里那条"忙就排队"只写了结论。这一节回答 **为什么非排队不可** ， 以及这份代码 **到哪里就不够用了**  —— 后者更重要， 因为状态机的 bug 几乎全长在"它什么时候会被谁调用"这件事上。

 

#### 递归派发的代价：` exit/enter ` 会成对错位

 

假设不排队，而是"派发期间来的事件直接递归进 ` sm_step `"。 看一个具体的时序：正在处理 ` A ` 的过程中，又来了 ` B `， 而 ` B ` 会触发一次转移。

 

**FIG 7.4**  同一串事件，两种派发方式的执行顺序

 

```zhizhan-figure
<svg viewBox="0 0 660 268" width="660" height="268" role="img" aria-label="递归派发与排队派发的执行顺序对比">
          <!-- 递归 -->
          <rect x="18" y="16" width="300" height="236" rx="7" class="sv-box" stroke="var(--red)"></rect>
          <text x="34" y="40" class="sv-lbl-hi" style="fill:var(--red)">✖ 递归派发</text>
          <text x="34" y="62" class="sv-lbl-dim" style="font-size:11px">sm_step(A)</text>
          <text x="34" y="80" class="sv-lbl-dim" style="font-size:11px">&nbsp;&nbsp;exit(S1)</text>
          <text x="34" y="98" class="sv-lbl-dim" style="font-size:11px">&nbsp;&nbsp;enter(S2)</text>
          <text x="34" y="116" class="sv-lbl-dim" style="font-size:11px">&nbsp;&nbsp;action_A&nbsp;&nbsp;<tspan style="fill:var(--red)">← 在这里投递了 B</tspan></text>
          <text x="34" y="134" class="sv-lbl-dim" style="font-size:11px">&nbsp;&nbsp;&nbsp;&nbsp;sm_step(B)　<tspan style="fill:var(--red)">递归进去</tspan></text>
          <text x="34" y="152" class="sv-lbl-dim" style="font-size:11px">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;exit(S2)</text>
          <text x="34" y="170" class="sv-lbl-dim" style="font-size:11px">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;enter(S3)</text>
          <text x="34" y="188" class="sv-lbl-dim" style="font-size:11px">&nbsp;&nbsp;&nbsp;&nbsp;返回</text>
          <text x="34" y="206" class="sv-lbl-dim" style="font-size:11px">&nbsp;&nbsp;action_A 剩下的部分…</text>
          <text x="34" y="232" class="sv-lbl-dim" style="font-size:10.5px;fill:var(--red)">A 的 action 跑在一半时，S2 已经被 exit 了 ——</text>
          <text x="34" y="246" class="sv-lbl-dim" style="font-size:10.5px;fill:var(--red)">它以为自己在 S2，其实系统已经在 S3</text>

          <!-- 排队 -->
          <rect x="342" y="16" width="300" height="236" rx="7" class="sv-box" stroke="var(--grn)"></rect>
          <text x="358" y="40" class="sv-lbl-hi" style="fill:var(--grn)">✔ 排队派发</text>
          <text x="358" y="62" class="sv-lbl-dim" style="font-size:11px">sm_dispatch(A)</text>
          <text x="358" y="80" class="sv-lbl-dim" style="font-size:11px">&nbsp;&nbsp;busy = true</text>
          <text x="358" y="98" class="sv-lbl-dim" style="font-size:11px">&nbsp;&nbsp;sm_step(A) 完整跑完</text>
          <text x="358" y="116" class="sv-lbl-dim" style="font-size:11px">&nbsp;&nbsp;&nbsp;&nbsp;B → queue&nbsp;&nbsp;<tspan style="fill:var(--grn)">← 只入队，不递归</tspan></text>
          <text x="358" y="134" class="sv-lbl-dim" style="font-size:11px">&nbsp;&nbsp;exit(S1) / enter(S2) 都已收尾</text>
          <text x="358" y="152" class="sv-lbl-dim" style="font-size:11px">&nbsp;&nbsp;while (queued) {</text>
          <text x="358" y="170" class="sv-lbl-dim" style="font-size:11px">&nbsp;&nbsp;&nbsp;&nbsp;sm_step(B)　<tspan style="fill:var(--grn)">从队列取</tspan></text>
          <text x="358" y="188" class="sv-lbl-dim" style="font-size:11px">&nbsp;&nbsp;&nbsp;&nbsp;exit(S2) → enter(S3)</text>
          <text x="358" y="206" class="sv-lbl-dim" style="font-size:11px">&nbsp;&nbsp;}</text>
          <text x="358" y="232" class="sv-lbl-dim" style="font-size:10.5px;fill:var(--grn)">每个状态的处理都是一段完整、可中断的事务 ——</text>
          <text x="358" y="246" class="sv-lbl-dim" style="font-size:10.5px;fill:var(--grn)">退出与进入严格成对，顺序不会交叉</text>
        </svg>
```

 

左边那种错的本质是： **状态机的状态被改了，而"正在处理某个事件"这件事还挂在栈上。**  ` exit/enter ` 的配对关系被打断之后， 你在 ` on_enter ` 里申请的资源、在 ` on_exit ` 里释放的资源， 生命周期就不再嵌套了 —— 表现是"偶尔少关一次、偶尔多关一次"。

 

| 做法 | 事件顺序 | 什么时候可以这么写 |
| --- | --- | --- |
| 递归派发 | 后到的先处理完（栈序） | 状态机里 **没有任何 ` exit/enter ` 钩子** 、动作也都不投递新事件时才行。一旦有了钩子，就不安全了 |
| 队列派发（本节） | 先到先处理（FIFO） | 通用做法。代价是定长队列 \+ 一个"满了怎么办"的决定 |
| 只设标志位 | 由主循环统一扫 | 事件种类少（≤ 32 种）时最省：一个 ` uint32_t ` 当位图，不用队列。 **但丢了顺序和重复次数** |

 

队列满了怎么办，本节选了"丢掉并计数"（` dropped_count `）。 另一种常见的做法是覆盖最旧的 —— 哪种对，取决于事件语义：  **"状态类"事件可以覆盖，"命令类"事件不能丢** 。 关键是 **不许静默丢** ：丢了一个事件，计数器上必须看得见。

 

#### 这份代码到哪里就不够用了

 

必须直说：本节这份 ` sm_dispatch `  **只保证了可重入，没有保证线程安全** 。 这两件事经常被混成一件事，其实差得很远：

 

```zhizhan-table
{"rows":[[{"body":"性质","header":true,"rowSpan":1,"colSpan":1},{"body":"含义","header":true,"rowSpan":1,"colSpan":1},{"body":"本节代码是否具备","header":true,"rowSpan":1,"colSpan":1}],[{"body":"**可重入**   \nreentrant","header":false,"rowSpan":1,"colSpan":1},{"body":"同一个函数在执行到一半时又被调用，结果仍然正确","header":false,"rowSpan":1,"colSpan":1},{"body":"**具备** 。靠的不是\"小心\"，是 ` busy ` 标志把并发变成排队 —— 任何时刻只有一层 ` sm_step ` 在跑","header":false,"rowSpan":1,"colSpan":1}],[{"body":"**线程安全**   \nthread-safe","header":false,"rowSpan":1,"colSpan":1},{"body":"多个执行流（主循环 / 中断 / 多个任务）同时调用，结果仍然正确","header":false,"rowSpan":1,"colSpan":1},{"body":"**不具备** 。` head ` 和 ` queued ` 是两个字段，` sm->busy ` 的读改写也不是原子的 —— 主循环正在改、中断插进来改，就会丢掉一次入队","header":false,"rowSpan":1,"colSpan":1}]]}
```

 

✖ 这份代码里有一处真正的隐患，必须点名

 

文件头把 ` sm_on_tick ` 写成"由 1 ms 系统节拍中断调用"， 而它内部 **直接调了 ` sm_step `** 。 如果主循环此刻正在 ` sm_step ` 里面，中断插进来又跑一遍 ——  **这正是本节刚说过的递归派发，只不过从"递归"变成了"抢占"** ，后果一模一样。

 

正确做法是把时间也变成事件，而不是特权路径：

 

 
1. 节拍中断 **只做一件事** ：` g_tick++; `（单个 ` volatile ` 写，天然原子）。
 
2. 主循环里定期调用 ` sm_on_tick(&sm, g_tick) `，和别的入口一样走队列。
 
3. 于是"检查超时"和"处理事件"永远在同一个上下文里， **不需要任何临界区** 。
 

 

代价是超时的判定粒度从"1 ms"变成"主循环一圈"。对一个 10 秒的连接超时来说， 这个代价是零 ——  *而它换来的是"这份代码只有一个上下文"这条极强的不变量* 。

 

✔ 如果确实要在中断里投递事件，三条规则

 

 
1. **中断里只允许调用入队这一个动作** （` sm_post_isr() ` 之类的窄接口）， 绝不允许从 ISR 调 ` sm_dispatch `。窄接口的好处是 **临界区只有一处** 。
 
2. **入队本身要进临界区** ：` head `/` queued ` 的读改写在主循环一侧， 所以要么关中断，要么让 ISR 只写、主循环只读（单生产者单消费者）。
 
3. **载荷不能指向栈上的数据** 。` ev_payload_t ` 里的 ` data.buf ` 是 ` const uint8_t * ` —— ISR 里指向一个局部数组，出了中断就是野指针。 这一条在"事件带参数"的设计里是最容易漏的，因为它 **不会编译报错** 。

 

#### 手写状态机之外：工具链能帮到哪一步

 

状态机的另一个名字是"可以画出来的代码"。所以这一行的工具都围着同一件事转：  **让图成为唯一真相，让 C 代码成为产物。**  下面是这一行的几个主要角色。

 

⚠ 这一小节的证据等级和前面不一样

 

前面每一条结论都有本机实测的编译输出或反汇编撑着。  **这张表没有**  —— 本机没有装这些工具，一条都没跑过， 下面全部是 **手册与文档级别** 的信息，只能当索引用，不能当"已验证"。 挑工具之前自己跑一遍。

 

```zhizhan-table
{"rows":[[{"body":"工具","header":true,"rowSpan":1,"colSpan":1},{"body":"输入是什么","header":true,"rowSpan":1,"colSpan":1},{"body":"产出","header":true,"rowSpan":1,"colSpan":1},{"body":"定位 / 取舍","header":true,"rowSpan":1,"colSpan":1}],[{"body":"**PlantUML**","header":false,"rowSpan":1,"colSpan":1},{"body":"纯文本（` @startuml ` 语法）","header":false,"rowSpan":1,"colSpan":1},{"body":"图（PNG / SVG）","header":false,"rowSpan":1,"colSpan":1},{"body":"只画图， **不生成代码** 。适合把已有逻辑补成一张图放进文档，图和代码是两份、会漂移","header":false,"rowSpan":1,"colSpan":1}],[{"body":"**SCXML**   \nW3C 标准","header":false,"rowSpan":1,"colSpan":1},{"body":"XML 描述状态图","header":false,"rowSpan":1,"colSpan":1},{"body":"可解释执行的模型；部分平台能生成代码","header":false,"rowSpan":1,"colSpan":1},{"body":"把状态图做成了 **标准格式** 。好处是工具可换、模型可移植；代价是 XML 冗长，且运行时解释器本身要占资源","header":false,"rowSpan":1,"colSpan":1}],[{"body":"**QP / QM**   \nQuantum Leaps","header":false,"rowSpan":1,"colSpan":1},{"body":"QM 建模工具里画图","header":false,"rowSpan":1,"colSpan":1},{"body":"纯 C 代码（可读、可调试）","header":false,"rowSpan":1,"colSpan":1},{"body":"面向嵌入式的完整框架：活动对象、事件队列、层次状态机都现成。 **要接受它的编程模型** ，不是\"生成一段代码塞进现有工程\"那种用法","header":false,"rowSpan":1,"colSpan":1}],[{"body":"**SMC**   \nState Machine Compiler","header":false,"rowSpan":1,"colSpan":1},{"body":"一个 ` .sm ` 文本文件","header":false,"rowSpan":1,"colSpan":1},{"body":"C / C\\+\\+ / Java 等多种语言","header":false,"rowSpan":1,"colSpan":1},{"body":"轻量，只做\"文本描述 → 状态机代码\"这一件事，生成结果能直接读。 **适合嵌进已有构建系统**","header":false,"rowSpan":1,"colSpan":1}],[{"body":"**MATLAB Stateflow**","header":false,"rowSpan":1,"colSpan":1},{"body":"Simulink 模型","header":false,"rowSpan":1,"colSpan":1},{"body":"可生成 C / 定点/浮点代码","header":false,"rowSpan":1,"colSpan":1},{"body":"商业工具链，强在仿真与形式化验证。 **成本和集成复杂度也是另一个量级**","header":false,"rowSpan":1,"colSpan":1}]]}
```

 

◆ 什么时候值得引入工具链

 

 
1. **状态数 \> 20，或有多处并发** ：手写表的维护成本会超过工具的学习成本。
 
2. **图和代码必须一致** ：有评审、有认证要求的场合，图是交付物 —— 这时"图漂移了"是缺陷，不是小事。
 
3. **反之，别引入** ：5 个状态、8 个事件，手写一张表 40 行，改一行看一行。 上工具意味着把构建链、生成代码、调试体验一起交出去 ——  *本节这份 377 行的实现，替代它需要一整套工具链。*

   

```zhizhan-anchor
ch7-1-6
```



### 7.1.6 把 §7.1 里的死代码清掉

 

这一段是 **给本节前面几页做体检** 。§7.1.1 那份 ` fsm_table.c ` 和 §7.1.2 那份 ` hsm.c ` 都是要抄进工程里的代码，所以它们自己也得上秤： 有没有定义了却没人用的东西？有没有写进去却永远读不到的分支？

 

先说结论，这里有两类死代码， **需要用两种完全不同的手段去发现** ： 一类 **编译器自己会报** ，另一类 **编译器一声不吭** 。 本节的立场是：能交给编译器的一律交给编译器，不为它写脚本。

 

#### 第一类：编译器会主动报的（基线 4 条）

 

把 §7.1.1 那份文件原样喂给 GCC，打开常规告警集，它会给出 4 条。原文如下，一字未改：

 

**bash**  — ` 176__fsm_table.c ` 在 ` -Wall -Wextra -Wpedantic ` 下的全部输出

 

```text
$ arm-none-eabi-gcc -c -mcpu=cortex-m3 -mthumb -O2 -Wall -Wextra -Wpedantic -o fsm.o fsm_table.c
fsm_table.c: In function 'app_dump_state':
fsm_table.c:175:5: warning: implicit declaration of function 'log_printf' [-Wimplicit-function-declaration]
  175 |     log_printf("FSM: state=%s transitions=%lu invalid=%lu",
      |     ^~~~~~~~~~
fsm_table.c: At top level:
fsm_table.c:123:26: warning: 'g_event_names' defined but not used [-Wunused-const-variable=]
  123 | static const char *const g_event_names[EV_COUNT] = {
      |                          ^~~~~~~~~~~~~
fsm_table.c:93:27: warning: 'g_fsm_safe' defined but not used [-Wunused-const-variable=]
   93 | static const transition_t g_fsm_safe[ST_COUNT][EV_COUNT] = {
      |                           ^~~~~~~~~~
fsm_table.c:33:13: warning: 'act_start_connect' defined but not used [-Wunused-function]
   33 | static void act_start_connect(void) { /* 发起连接 */ }
      |             ^~~~~~~~~~~~~~~~~
$ echo $?
0
```

 

注意最后那个 ` echo $? ` 是 0：  **这 4 条告警一条都不会让编译失败。**  所以"能编过"和"干净"是两件事，而默认的构建脚本只检查前者。

 

```zhizhan-table
{"rows":[[{"body":"告警","header":true,"rowSpan":1,"colSpan":1},{"body":"是什么","header":true,"rowSpan":1,"colSpan":1},{"body":"为什么会变成死代码 / 该怎么改","header":true,"rowSpan":1,"colSpan":1}],[{"body":"` act_start_connect `  \n:33","header":false,"rowSpan":1,"colSpan":1},{"body":"一个动作函数","header":false,"rowSpan":1,"colSpan":1},{"body":"它定义了，但 **没有任何一格转移表引用它** 。多半是当初写了动作、后来把那一格改成了 ` act_led_slow `，函数忘了删。 改法：要么删掉，要么把它填回它该在的那一格 ——  **两种改法语义完全不同，编译器不知道你选哪个。**","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` g_fsm_safe `  \n:93","header":false,"rowSpan":1,"colSpan":1},{"body":"一张\"修复方案 A\"的备选转移表","header":false,"rowSpan":1,"colSpan":1},{"body":"它是为了演示\"给空位显式填哨兵\"而写的，但正文最后用的是另一条路，于是这张表 **从来没有被引用过** 。 这种\"为了讲一个思路而写的代码\"最容易留下来 —— 它在文章里是必要的，在代码里是垃圾","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` g_event_names `  \n:123","header":false,"rowSpan":1,"colSpan":1},{"body":"事件名字表","header":false,"rowSpan":1,"colSpan":1},{"body":"和 ` g_state_names ` 对称写的一份，但 ` app_dump_state ` 只用了状态名那一份。  **这是最值得改的一条** ：把事件名打进日志，正是状态机调试最需要的东西（见下面的对照）","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` log_printf `  \n:175","header":false,"rowSpan":1,"colSpan":1},{"body":"隐式函数声明","header":false,"rowSpan":1,"colSpan":1},{"body":"**这条不是死代码** ，是\"少 ` #include `\"。C99 起隐式声明已经不再是合法 C —— 在没有原型的调用点上，可变参数会被按默认提升传，而真实原型 ` (fmt, ...) ` 要求的是另一套。 在 32 位 ARM 上大多数时候能\"碰巧对\"，因为它是个 ` printf ` 风格函数； 换成返回指针或浮点参数的函数就会真出事。 **补一行 ` #include \"log.h\" ` 就完了，没有理由留着。**","header":false,"rowSpan":1,"colSpan":1}]]}
```

 

◆ 这 4 条死代码占了多少 flash？答案是 0

 

听起来该松一口气，其实这才是最坏的部分。` .rodata ` 实测 260 字节， 而它 **正好等于**  ` g_fsm `（240） 加 ` g_state_names `（20）：

 

```text
000000f0 00000014 r g_state_names      ← 0x14 = 20 字节：5 个指针
00000000 000000f0 r g_fsm              ← 0xf0 = 240 字节 = 5 × 6 × 8
```

 

**` g_fsm_safe ` 和 ` g_event_names ` 一个字节都没进目标文件**  —— ` static ` 且没人用，编译器直接扔了。 所以它们的代价不是 flash，是 **读代码的人的判断** ： 你以为工程里有两张表可以互相印证，实际上只有一张， 而另一张会不会在某次改动后"复活"，取决于下一个人手滑不手滑。  *死代码最贵的从来不是空间，是"这里到底有几个真相"。*

 

增强版 ` sm_event.c ` 在同一套选项下是 **0 条告警** 。 这不是巧合，是上面四条各自的解法： ` act_start_connect ` 对应的动作进了表、 没有第二张备选表、事件名被 ` on_error ` 和统计接口真的用上、 所有函数都有原型。

 

✔ "0 条告警"是个可以写进 CI 的指标

 

告警数量的特点是 **它会自我繁殖** ：一旦有 4 条常驻，第 5 条出现时没人会注意到。 反过来，让"0 条"成为常态，第 1 条出现就会被看见 —— 这比任何"代码规范文档"都有效，而且 **它由编译器执行，不由人执行** 。

 

#### 第二类：编译器一声不吭的（§7.1.2 那三条）

 

§7.1.2 那份 ` hsm.c ` 里有三处死代码， **每一条都不是警告，也不是错误** 。 先把实测结果摆出来 —— 连 GCC 的静态分析器 ` -fanalyzer ` 都不说话：

 

**bash**  — ` hsm.c ` 在常规告警 \+ ` -fanalyzer ` 下

 

```text
$ arm-none-eabi-gcc -c -mcpu=cortex-m3 -mthumb -O2 \
>     -Wall -Wextra -Wpedantic -fanalyzer -o /dev/null hsm.c
$ echo $?
0        ← 一条输出都没有
```

 

为什么会这样？因为"写进去没人读" **在编译器的定义里不是缺陷** 。 优化器看到 ` hsm->depth = 0; ` 之后没有任何读取，会把它当死存储优化掉 —— 对它来说这叫"优化成功"，不叫"发现了问题"。 同理，` HANDLED ` 和 ` TRANSITION ` 在 ` r == HANDLED || r == TRANSITION ` 里被合并成一个条件， 编译器看到的是"一个布尔表达式"，它没有理由关心这两个名字是不是同义词。

 

这三条是 **"字段/枚举的语义死掉了"** ，不是语法问题。 语法层面的工具（编译器、` -fanalyzer `、大多数 linter 的默认规则集） 都看不见它们。要发现它，需要的是一个能跨整个文件数"出现了几次、分别是读还是写"的工具 —— 这就是本节那个 node 脚本存在的原因：

 

**bash**  — ` node tools/sm_model.js ` 的第四部分（只输出这一段）

 

```text
$ node tools/sm_model.js
=== D  编译器看不见的死代码 · verify/src/177__hsm.c ===
  struct hsm 有 5 个字段：current, depth, transition_count, rejected_count, user
  · 177__hsm.c:128  字段 depth：出现 1 次，全部是写，0 次读
  · 177__hsm.c:131  字段 user：出现 1 次，全部是写，0 次读
  ✓ 抓到 depth：它只在 hsm_init 里被赋 0，之后再没人看过 —— "当前嵌套深度"是个摆设
  hsm_result_t 有 3 个成员：HANDLED, IGNORED, TRANSITION
  · 177__hsm.c:113  枚举成员 HANDLED：定义之外只出现 1 次，且每次都和另一个成员写在同一个条件里 —— 它对结果没有独立影响
  ✓ 枚举成员 IGNORED：出现 7 次，有独立语义
  ✓ 枚举成员 TRANSITION：出现 8 次，有独立语义
  ✓ 抓到 HANDLED：它和 TRANSITION 永远出现在同一个 || 里 —— 两个名字，一套行为
  ✓ 非空性对照：IGNORED 被正确判为"有独立语义"，没有被误伤
```

 

```zhizhan-table
{"rows":[[{"body":"死掉的东西","header":true,"rowSpan":1,"colSpan":1},{"body":"实测统计","header":true,"rowSpan":1,"colSpan":1},{"body":"为什么它是问题 / 怎么改","header":true,"rowSpan":1,"colSpan":1}],[{"body":"` hsm->depth `  \n:128","header":false,"rowSpan":1,"colSpan":1},{"body":"出现 1 次， **全是写、0 次读**","header":false,"rowSpan":1,"colSpan":1},{"body":"字段名说的是\"当前嵌套深度\"，实际只在 ` hsm_init ` 里被赋 0，之后再没人看。  **它制造了一个假的承诺** ：读代码的人会以为层次深度是可查的。 改法：要么真的维护它（在 ` hsm_transition ` 里按 LCA 深度更新），要么删掉 ——  *不要留着一个\"看起来在维护状态\"的字段*","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` hsm->user `  \n:131","header":false,"rowSpan":1,"colSpan":1},{"body":"出现 1 次， **全是写、0 次读**","header":false,"rowSpan":1,"colSpan":1},{"body":"这是 ` void *ctx ` 惯用法里预留的用户上下文指针。留一个\"以后可能用得上\"的 ` void * ` 是嵌入式里非常常见的做法， **但它是这四类里唯一有正当理由的** ： 接口一旦发布就要保持 ABI。所以这条不一定该删， **该做的是在注释里写明\"留给调用方，库内不使用\"** ， 让下一个读者不用自己数一遍","header":false,"rowSpan":1,"colSpan":1}],[{"body":"` HANDLED `  \n:113","header":false,"rowSpan":1,"colSpan":1},{"body":"定义外只出现 1 次， **且与另一个成员同处一个 ` || `**","header":false,"rowSpan":1,"colSpan":1},{"body":"枚举里有三个成员 ` IGNORED / HANDLED / TRANSITION `， 但代码只区分\"` IGNORED `\"和\"不是 ` IGNORED `\"。 于是 ` HANDLED ` 和 ` TRANSITION `  **是两个名字、一套行为** 。 这不是 bug，是 **表述和实现不一致** ：状态处理函数的作者会以为自己可以\"处理了但不转移\"和\"转移了\"分开表态， 实际上这两句话的效果一模一样。 改法二选一：把 ` HANDLED ` 删掉只留两个成员（承认现实）， 或者在 ` hsm_dispatch ` 里真的区分对待（兑现承诺）","header":false,"rowSpan":1,"colSpan":1}]]}
```

 

⚠ 脚本会骗人，所以必须带"非空性对照"

 

上面那段输出里有两行看起来像废话，其实是 **整段输出里最重要的两行** ：

 

```text
  ✓ 枚举成员 IGNORED：出现 7 次，有独立语义
  ✓ 非空性对照：IGNORED 被正确判为"有独立语义"，没有被误伤
```

 

一个"什么都报"的脚本和一个"什么都对"的脚本，输出看起来一样漂亮。 要证明它真的在判断，就得让它 **同时在正例和反例上表态** ： ` IGNORED ` 用法正确 → 它说"没问题"； ` HANDLED ` 语义冗余 → 它说"有问题"。 两者都对，才说明它在区分，而不是在瞎报或瞎过。  *本节的脚本还为转移表和状态树各写了两条变异测试（故意改坏一处，看检查会不会变红），是同一个道理。*

 

#### 分工：一条不该越过的线

 

```zhizhan-table
{"rows":[[{"body":"死代码类型","header":true,"rowSpan":1,"colSpan":1},{"body":"谁负责发现","header":true,"rowSpan":1,"colSpan":1},{"body":"本节的处置","header":true,"rowSpan":1,"colSpan":1}],[{"body":"定义了没用的函数 / 变量","header":false,"rowSpan":1,"colSpan":1},{"body":"**编译器**   \n` -Wunused-function ` / ` -Wunused-const-variable `","header":false,"rowSpan":1,"colSpan":1},{"body":"交给编译器，脚本不重复实现","header":false,"rowSpan":1,"colSpan":1}],[{"body":"缺原型 / 隐式声明","header":false,"rowSpan":1,"colSpan":1},{"body":"**编译器**   \n` -Wimplicit-function-declaration `","header":false,"rowSpan":1,"colSpan":1},{"body":"交给编译器","header":false,"rowSpan":1,"colSpan":1}],[{"body":"写了没读的字段","header":false,"rowSpan":1,"colSpan":1},{"body":"**跨文件计数** （编译器看不见）","header":false,"rowSpan":2,"colSpan":1},{"body":"脚本数\"出现几次、读还是写\"","header":false,"rowSpan":2,"colSpan":1}],[{"body":"语义冗余的枚举成员","header":false,"rowSpan":1,"colSpan":1}],[{"body":"资源泄漏 / 空指针 / 释放后使用","header":false,"rowSpan":1,"colSpan":1},{"body":"**` -fanalyzer `**","header":false,"rowSpan":1,"colSpan":1},{"body":"本节没演示，但同一套构建里应该常开","header":false,"rowSpan":1,"colSpan":1}]]}
```

 

✔ 本节最后一条,也是最该记住的一条

 

**先问编译器能不能报，报不了再写脚本。**  为 ` -Wunused-function ` 能覆盖的东西写一个自定义检查， 得到的是一个更弱、更容易漂移、还没人维护的复制品 ——  *而它会给你一种"我们做了检查"的安全感，这比不做检查更危险。*

  

```zhizhan-anchor
ch7-2
```



## 7.2 面向对象 C：让代码长得有结构

 

C 没有 ` class `，但 **面向对象的三个核心——封装、继承、多态——全都能实现** ， 而且这是 Linux 内核、[FreeRTOS](term:rtos)、各种驱动框架的通行做法。

 

```zhizhan-anchor
ch7-2-1
```



### 7.2.1 封装：不透明指针（Opaque Pointer）

 

sensor.h — 头文件只暴露接口，不暴露实现 C

 

```text
/* ============================================================
   sensor.h —— 公开接口
   ------------------------------------------------------------
   关键：使用者拿到的只是一个"句柄"，看不到内部结构。
   好处：
     ① 内部实现可以随便改，不影响调用方（不用重编译）
     ② 使用者无法直接改内部字段，只能通过 API（真正的封装）
     ③ 强制走 API 意味着所有访问都能被集中控制（加锁、校验、统计）
   ============================================================ */
#ifndef SENSOR_H
#define SENSOR_H

#include <stdint.h>
#include <stddef.h>

/* ---- 不完整类型：只有声明，没有定义 ---- */
typedef struct sensor sensor_t;

/* ---- 错误码：比返回 -1 有信息量得多 ---- */
typedef enum {
    SENSOR_OK = 0,
    SENSOR_ERR_NULL,            /* 参数为空 */
    SENSOR_ERR_NO_MEM,          /* 内存不足 */
    SENSOR_ERR_IO,              /* 总线通信失败 */
    SENSOR_ERR_CRC,             /* 数据校验失败 */
    SENSOR_ERR_NOT_INIT,        /* 未初始化 */
    SENSOR_ERR_RANGE,           /* 数值超出量程 */
    SENSOR_ERR_BUSY,            /* 设备忙 */
} sensor_err_t;

/* ---- 配置结构：调用方提供，明确输入 ---- */
typedef struct {
    uint8_t  i2c_addr;
    uint32_t timeout_ms;
    uint16_t sample_rate_hz;
    uint8_t  oversampling;      /* 1, 2, 4, 8, 16 */
} sensor_cfg_t;

/* ---- 生命周期 ---- */
sensor_t    *sensor_create(const sensor_cfg_t *cfg);
void         sensor_destroy(sensor_t *s);

/* ---- 操作 ---- */
sensor_err_t sensor_init(sensor_t *s);
sensor_err_t sensor_read(sensor_t *s, float *temperature, float *humidity);
sensor_err_t sensor_reset(sensor_t *s);

/* ---- 状态查询（只读接口，不暴露内部）---- */
uint32_t     sensor_get_error_count(const sensor_t *s);
uint32_t     sensor_get_sample_count(const sensor_t *s);
const char  *sensor_err_str(sensor_err_t err);

#endif /* SENSOR_H */
```

 

sensor.c — 实现（放在单独的 .c 里，使用者看不到） C

 

```text
#include "sensor.h"
#include <string.h>
#include <stdlib.h>      /* malloc / free —— 少了这一行，下面两处就会踩坑：
                           C99 里 malloc 被隐式声明为"返回 int"，
                             · 在 32 位 MCU 上指针和 int 同宽，侥幸能跑；
                             · 拿到 64 位 PC 上跑单元测试，指针被截成 32 位 → 直接崩；
                           C23 起隐式函数声明是硬错误，连编译都过不去。
                           本章的核心卖点就是"能在 PC 上测试"，所以这个头文件不能省。 */

/* ============================================================
   内部结构：这个定义只存在于本 .c 文件
   使用者就算拿到 sensor_t* 也无法访问这些字段
   ============================================================ */
#define SENSOR_MAGIC    0x53454E53UL    /* "SENS" */

struct sensor {
    uint32_t     magic;             /* 用于检测野指针/重复 destroy */
    sensor_cfg_t cfg;
    uint8_t      initialized;
    uint8_t      busy;

    /* 内部状态（使用者完全看不到）*/
    uint32_t     err_count;
    uint32_t     sample_count;
    int32_t      raw_temp;
    int32_t      raw_humid;
    uint32_t     last_tick;
};

/* ---- 动态创建（用标准 malloc 或你自己的内存池）---- */
sensor_t *sensor_create(const sensor_cfg_t *cfg)
{
    if (!cfg) return NULL;
    if (cfg->oversampling != 1 && cfg->oversampling != 2 &&
        cfg->oversampling != 4 && cfg->oversampling != 8 &&
        cfg->oversampling != 16) {
        return NULL;                /* 非法参数在创建时就拒绝 */
    }

    sensor_t *s = (sensor_t *)malloc(sizeof *s);
    if (!s) return NULL;

    memset(s, 0, sizeof *s);
    s->magic = SENSOR_MAGIC;
    s->cfg   = *cfg;                /* 拷贝配置，避免调用方改cfg后行为突变 */
    return s;
}

void sensor_destroy(sensor_t *s)
{
    if (!s) return;
    if (s->magic != SENSOR_MAGIC) return;   /* ✔ 野指针检测 */
    s->magic = 0;                            /* ✔ 双重 destroy 检测 */
    free(s);
}

/* ---- 内部辅助函数：static，不导出 ---- */
static sensor_err_t sensor_wait_ready(sensor_t *s)
{
    uint32_t start = get_tick();
    while (get_tick() - start < s->cfg.timeout_ms) {
        if (/* 读取状态寄存器，就绪 */ 1) {
            return SENSOR_OK;
        }
    }
    return SENSOR_ERR_IO;           /* 超时 */
}

/* ---- 公开操作：每个都做参数校验 ---- */
sensor_err_t sensor_init(sensor_t *s)
{
    if (!s || s->magic != SENSOR_MAGIC) return SENSOR_ERR_NULL;

    /* 软复位 */
    /* i2c_write(s->cfg.i2c_addr, REG_RESET, 0x01); */

    sensor_err_t e = sensor_wait_ready(s);
    if (e != SENSOR_OK) {
        s->err_count++;
        return e;
    }

    s->initialized = 1;
    return SENSOR_OK;
}

sensor_err_t sensor_read(sensor_t *s, float *temperature, float *humidity)
{
    /* ✔ 三层校验：句柄、状态、参数 */
    if (!s || s->magic != SENSOR_MAGIC) return SENSOR_ERR_NULL;
    if (!s->initialized)               return SENSOR_ERR_NOT_INIT;
    if (!temperature || !humidity)     return SENSOR_ERR_NULL;
    if (s->busy)                       return SENSOR_ERR_BUSY;

    s->busy = 1;

    /* ... 实际读取 I2C，填充 s->raw_temp / s->raw_humid ... */

    /* 原始值转物理量（转换公式属于实现细节，不外泄）*/
    *temperature = (float)s->raw_temp  / 100.0f;
    *humidity    = (float)s->raw_humid / 1024.0f;

    /* 量程检查 */
    if (*humidity < 0.0f || *humidity > 100.0f) {
        s->busy = 0;
        s->err_count++;
        return SENSOR_ERR_RANGE;
    }

    s->sample_count++;
    s->busy = 0;
    return SENSOR_OK;
}

uint32_t sensor_get_error_count(const sensor_t *s)
{
    /* ✔ 注意 const：查询接口不应该修改对象 */
    if (!s || s->magic != SENSOR_MAGIC) return 0;
    return s->err_count;
}

uint32_t sensor_get_sample_count(const sensor_t *s)
{
    if (!s || s->magic != SENSOR_MAGIC) return 0;
    return s->sample_count;
}

/* ---- 错误码转字符串：日志里极其有用 ---- */
const char *sensor_err_str(sensor_err_t err)
{
    switch (err) {
    case SENSOR_OK:            return "OK";
    case SENSOR_ERR_NULL:      return "NULL pointer";
    case SENSOR_ERR_NO_MEM:    return "out of memory";
    case SENSOR_ERR_IO:        return "I/O failure";
    case SENSOR_ERR_CRC:       return "CRC mismatch";
    case SENSOR_ERR_NOT_INIT:  return "not initialized";
    case SENSOR_ERR_RANGE:     return "value out of range";
    case SENSOR_ERR_BUSY:      return "device busy";
    default:                   return "unknown error";
    }
}

/* ============================================================
   使用方（完全看不到 struct sensor 的内容）

   sensor_cfg_t cfg = {
       .i2c_addr = 0x40, .timeout_ms = 100,
       .sample_rate_hz = 10, .oversampling = 4,
   };
   sensor_t *th = sensor_create(&cfg);
   if (!th) { ... }

   float t, h;
   sensor_err_t e = sensor_read(th, &t, &h);
   if (e != SENSOR_OK) {
       log_error("sensor_read: %s", sensor_err_str(e));   // ← 可读的错误信息
   }
   ============================================================ */
```

 

```zhizhan-anchor
ch7-2-2
```



### 7.2.2 多态：接口（Interface）\+ 多个实现

 

display.h — 一个接口，三种屏幕 C

 

```text
/* ============================================================
   display.h —— 抽象接口
   ------------------------------------------------------------
   场景：产品有多个型号，分别用 ST7789（SPI）、SSD1306（I2C）、
         ILI9341（并口）。上层应用代码不应该知道用的是哪个。
   ============================================================ */
#ifndef DISPLAY_H
#define DISPLAY_H

#include <stdint.h>

typedef enum {
    DISP_ROT_0 = 0, DISP_ROT_90, DISP_ROT_180, DISP_ROT_270
} disp_rotation_t;

/* RGB565 颜色 */
typedef uint16_t disp_color_t;
#define DISP_BLACK   0x0000
#define DISP_WHITE   0xFFFF
#define DISP_RED     0xF800
#define DISP_GREEN   0x07E0
#define DISP_BLUE    0x001F

/* ---- 虚函数表：这就是 C 里的 vtable ---- */
typedef struct {
    int  (*init)(void *ctx, disp_rotation_t rot);
    void (*deinit)(void *ctx);
    int  (*fill_rect)(void *ctx, int x, int y, int w, int h, disp_color_t c);
    int  (*draw_pixel)(void *ctx, int x, int y, disp_color_t c);
    int  (*blit)(void *ctx, int x, int y, int w, int h, const disp_color_t *src);
    int  (*flush)(void *ctx);               /* 把帧缓冲推到屏幕 */

    /* ⚠ 注意这里【故意没有】width / height 字段。
       原因值得单独说，因为这是本章"抽象泄漏"最典型的反面案例：

       虚函数表描述的是"这一类驱动能干什么"，它对所有实例都是同一份、
       而且是 const 的；而屏幕的宽高是【每个实例】的状态——
       同一颗 ST7789，旋转 0° 时是 320×240，旋转 90° 就变成 240×320。

       一旦把 width/height 塞进 const 虚表，就会出现这种局面：
         · ops->width 永远是 320（虚表是编译期常量，运行时改不了）
         · 而驱动内部 ctx->width 已经被 init(rot) 改成了 240
         · 上层用 ops->width 去清屏 / 算裁剪边界 → 画到缓冲区外面去
       更糟的是它【不报错】：日志会打印 "ST7789 320x240"，
       看起来一切正常，只有屏幕上的花屏在提醒你出事了。

       所以尺寸必须走虚函数，从 ctx 里现取。 */
    int  (*get_size)(void *ctx, int *w, int *h);

    const char *name;                       /* 驱动型号名，这个是类型属性，放虚表里没问题 */
} display_ops_t;

/* ---- 通用设备句柄：ops + 私有上下文 ---- */
typedef struct display {
    const display_ops_t *ops;
    void                *ctx;               /* 具体驱动的私有数据 */
} display_t;

/* ---- 具体驱动注册函数（每个驱动实现一个）---- */
int st7789_create(display_t *out, int spi_host, int cs_pin, int dc_pin, int rst_pin);
int ssd1306_create(display_t *out, int i2c_port, uint8_t addr);
int ili9341_create(display_t *out, int fsmc_bank);

#endif /* DISPLAY_H */
```

 

st7789.c — 一个具体实现 C

 

```text
#include "display.h"
#include <stdlib.h>
#include <string.h>

/* ---- 驱动私有上下文：别的驱动完全不知道它的存在 ---- */
typedef struct {
    int      spi_host;
    int      cs_pin, dc_pin, rst_pin;
    uint16_t width, height;
    disp_rotation_t rot;
    uint8_t *framebuf;              /* 帧缓冲 */
} st7789_ctx_t;

/* ---- 实现各虚函数 ---- */
static int st7789_init(void *vctx, disp_rotation_t rot)
{
    st7789_ctx_t *c = (st7789_ctx_t *)vctx;

    c->rot = rot;
    /* 硬件复位序列 */
    /* gpio_set(c->rst_pin, 0); delay_ms(10); gpio_set(c->rst_pin, 1); delay_ms(120); */
    /* 发送初始化命令序列... */

    if (rot == DISP_ROT_90 || rot == DISP_ROT_270) {
        c->width  = 240; c->height = 320;
    } else {
        c->width  = 320; c->height = 240;
    }
    return 0;
}

static int st7789_fill_rect(void *vctx, int x, int y, int w, int h, disp_color_t color)
{
    st7789_ctx_t *c = (st7789_ctx_t *)vctx;
    if (!c->framebuf) return -1;

    /* 裁剪到屏幕范围 —— 驱动层必须自己做，不能指望调用方 */
    if (x < 0) { w += x; x = 0; }
    if (y < 0) { h += y; y = 0; }
    if (x + w > c->width)  w = c->width  - x;
    if (y + h > c->height) h = c->height - y;
    if (w <= 0 || h <= 0) return 0;      /* 完全在屏幕外，什么都不画 */

    for (int row = 0; row < h; row++) {
        disp_color_t *p = (disp_color_t *)c->framebuf
                        + (y + row) * c->width + x;
        for (int col = 0; col < w; col++) {
            p[col] = color;
        }
    }
    return 0;
}

static int st7789_flush(void *vctx)
{
    st7789_ctx_t *c = (st7789_ctx_t *)vctx;
    /* 设置窗口 + 通过 SPI/DMA 推送 framebuf */
    return 0;
}

static void st7789_deinit(void *vctx)
{
    st7789_ctx_t *c = (st7789_ctx_t *)vctx;
    free(c->framebuf);
    free(c);
}

/* ---- 尺寸查询：从【实例】里取，而不是从虚表里取 ----
   旋转之后 c->width / c->height 已经变了，只有这里能拿到真值。 */
static int st7789_get_size(void *vctx, int *w, int *h)
{
    st7789_ctx_t *c = (st7789_ctx_t *)vctx;
    if (!c) return -1;
    if (w) *w = c->width;
    if (h) *h = c->height;
    return 0;
}

/* ---- 虚函数表：这个驱动的"身份证" ----
   只放"对所有实例都一样"的东西：函数指针 + 型号名。
   任何"每个实例可能不同"的值都不该出现在这里。 */
static const display_ops_t g_st7789_ops = {
    .init       = st7789_init,
    .deinit     = st7789_deinit,
    .fill_rect  = st7789_fill_rect,
    .draw_pixel = NULL,                 /* 未实现（可选接口） */
    .blit       = NULL,
    .flush      = st7789_flush,
    .get_size   = st7789_get_size,
    .name       = "ST7789",
};

/* ---- 工厂函数：分配上下文，绑定 ops ---- */
int st7789_create(display_t *out, int spi_host, int cs_pin, int dc_pin, int rst_pin)
{
    if (!out) return -1;

    st7789_ctx_t *c = (st7789_ctx_t *)calloc(1, sizeof *c);
    if (!c) return -1;

    c->spi_host = spi_host;
    c->cs_pin   = cs_pin;
    c->dc_pin   = dc_pin;
    c->rst_pin  = rst_pin;
    c->width    = 320;
    c->height   = 240;
    c->framebuf = (uint8_t *)malloc(320 * 240 * 2);

    if (!c->framebuf) { free(c); return -1; }

    out->ops = &g_st7789_ops;
    out->ctx = c;
    return 0;
}
```

 

ui.c — 上层应用：完全不知道用的是哪个屏幕 C

 

```text
#include "display.h"
#include "log.h"        /* log_info */
#include <string.h>

/* 开发板的引脚/外设编号来自 board_config.h（由构建系统 -include 或
   在 Makefile 里按 BOARD_xxx 宏选择）：
       BOARD_A：st7789  引脚 PIN_CS / PIN_DC / PIN_RST，SPI2_HOST
       BOARD_B：ssd1306 I2C_PORT_0，从机地址 0x3C
   这里不展开，因为它和"多态"这个主题无关 —— 想看得清楚，
   记住一点就够了：这些名字属于【板级配置】，不属于 UI 代码。 */

/* ili9341 挂在 FSMC 的 bank1（NOR/PSRAM 区）。
   参数是驱动约定的 bank 编号，不是地址 —— 地址由驱动自己算。 */
#define FSMC_BANK1   1

/* ============================================================
   上层 UI 代码：只依赖 display_t 抽象
   ------------------------------------------------------------
   换屏幕 = 换 create 函数的一行调用，UI 代码零改动。
   这就是多态的价值。
   ============================================================ */

static display_t g_disp;

/* ---- 初始化：根据编译配置选择驱动 ---- */
int ui_init(void)
{
#if defined(BOARD_A)
    if (st7789_create(&g_disp, SPI2_HOST, PIN_CS, PIN_DC, PIN_RST) != 0)
        return -1;
#elif defined(BOARD_B)
    if (ssd1306_create(&g_disp, I2C_PORT_0, 0x3C) != 0)
        return -1;
#else
    if (ili9341_create(&g_disp, FSMC_BANK1) != 0)
        return -1;
#endif

    /* ✔ 通过接口调用，不关心具体实现 */
    if (g_disp.ops->init(g_disp.ctx, DISP_ROT_90) != 0) {   /* 竖屏安装 */
        return -1;
    }

    /* 尺寸必须【在 init 之后】问实例要 —— init 可能会因为旋转而改掉它 */
    int w = 0, h = 0;
    if (g_disp.ops->get_size(g_disp.ctx, &w, &h) != 0) {
        return -1;
    }
    log_info("display: %s %dx%d", g_disp.ops->name, w, h);   /* → ST7789 240x320 */
    return 0;
}

/* ---- 画一个带边框的矩形（组合已有原语）---- */
static void draw_box(int x, int y, int w, int h, disp_color_t fill, disp_color_t border)
{
    g_disp.ops->fill_rect(g_disp.ctx, x, y, w, h, border);            /* 外框 */
    g_disp.ops->fill_rect(g_disp.ctx, x + 2, y + 2, w - 4, h - 4, fill); /* 内填充 */
}

/* ---- 可选接口的调用：必须先检查非空 ---- */
static int ui_blit_image(int x, int y, int w, int h, const disp_color_t *pixels)
{
    if (!g_disp.ops->blit) {
        /* 这个驱动不支持直接 blit，降级为逐像素 */
        for (int r = 0; r < h; r++) {
            for (int c = 0; c < w; c++) {
                if (g_disp.ops->draw_pixel) {
                    g_disp.ops->draw_pixel(g_disp.ctx, x + c, y + r,
                                           pixels[r * w + c]);
                }
            }
        }
        return 0;
    }
    return g_disp.ops->blit(g_disp.ctx, x, y, w, h, pixels);
}

/* ---- 主界面 ---- */
void ui_render(void)
{
    /* 清屏区域也要问实例要 —— 用虚表里写死的 320x240 会清错一片 */
    int w = 0, h = 0;
    if (g_disp.ops->get_size(g_disp.ctx, &w, &h) != 0) return;

    g_disp.ops->fill_rect(g_disp.ctx, 0, 0, w, h, DISP_BLACK);
    draw_box(10, 10, 100, 40, DISP_BLUE, DISP_WHITE);
    draw_box(10, 60, 100, 40, DISP_GREEN, DISP_WHITE);

    g_disp.ops->flush(g_disp.ctx);      /* 统一提交 */
}

/* ============================================================
   内存布局对比（这是多态的真实代价）

   struct display_t:
     ops  (8 字节指针，32 位平台是 4 字节)
     ctx  (4/8 字节)

   比"直接用具体驱动"多了一次指针解引用。
   在现代 MCU 上，这个开销可以忽略；
   换来的是"上层代码零改动就能换硬件"。

   这就是嵌入式里"抽象"的性价比判断：一次间接跳转 vs 大幅降低的耦合。
   ============================================================ */
```

  

```zhizhan-anchor
ch7-2-3
```



### 7.2.3 继承：把共有的那一截放在最前面

 

§7.2 开头把面向对象的三件事一次点了名：封装、继承、多态。§7.2.1 讲了封装（不透明指针）， §7.2.2 讲了多态（虚表 \+ 多个实现）， **继承一直没讲** 。这一节补上它。

 

C 里没有 ` class `，也没有 C\+\+ 那个冒号继承符号，于是很多人以为 "继承在 C 里做不了"。事实相反： **C 版的继承比 C\+\+ 更透明** 。 C\+\+ 编译器替你排布局、插虚表指针、在每次向上转型时加上偏移 —— 你看不见； C 里这几件事 **全都写在你自己的结构体定义里** ，一个字节都不藏。 代价是同一个： **排错了，编译器默认一声不吭** 。 所以这一节分成两半，一半讲布局约定，一半讲怎么让编译器替你把约定看住 —— 后一半才是真正的工程量。

 

◆ 继承在 C 里的全部内容：一句标准保证 \+ 一个位置约定

 

C11 §6.7.2.1p15 原文：

 

```text
A pointer to a structure object, suitably converted, points to its initial
member (or if that member is a bit-field, then to the unit in which it
resides), and vice versa.                    —— C11 §6.7.2.1p15
```

 

译：指向结构体对象的指针，经适当转换后指向它的 **初始成员** ，反之亦然。

 

这句话是"向上转型"（把派生对象当基类用）在 C 里合法的 **唯一** 依据。 注意它带两个限定词，少一个都不成立：

 

 
- **initial member**  —— 必须是 **第一个** 成员。 基类一挪到第二位，这句话立刻作废，上转型从"标准保证"降级成"在你这台机器上碰巧能用"。
 
- **suitably converted**  —— 要 **显式转换** 。 ` &s->base ` 和 ` (device_t *)s ` 都算， 不加转换的直接赋值不算：那是约束违反，编译器默认就会报 （下面 §7.2.3 ② 有实测输出， **不需要 ` -Wall ` 也会报** ）。

 

#### ① 布局：基类放第一个，然后用断言把位置钉死

 

下面这份文件就是这一节的物证。它定义了三个类型：一个"基类"和两个"派生类"。 基类 ` device_t ` 只有三个字段 —— 一张虚表指针、一个给派生类挂私有状态的 ` void * `、 一个初始化标志。它的存在意义不是省代码，而是让 **所有设备共用同一套遍历/探测/注册逻辑** 。

 

| 类型 | 组成 | ` sizeof ` | 关键偏移 |
| --- | --- | --- | --- |
| ` device_t ` | ` ops `(4) \+ ` priv `(4) \+ ` inited `(1) \+ 3 字节填充 | **12** | ` ops `@0 · ` priv `@4 · ` inited `@8 |
| ` spi_dev_t ` | ` device_t `(12) \+ ` cs_pin `(4) \+ ` baud `(4) | **20** | ` base `@0 · ` cs_pin `@12 · ` baud `@16 |
| ` i2c_dev_t ` | ` device_t `(12) \+ ` addr `(1) \+ 3 字节填充 | **16** | ` base `@0 · ` addr `@12 |
| ` spi_bad_t ` | ` cs_pin `(4) \+ ` device_t `(12) ←  **基类挪到了第二位** | 16 | ` base `@ **4**  ← 就是这一格惹的祸 |

 

注意最后两行： **把基类从第一位挪到第二位，总尺寸一个字节都没变** （都是 16）。 所以"位置错了"不会撞上任何尺寸检查 —— 它只会让上转型悄悄算错地址。 这类错误正是 **最该被编译期断言拦住的那一类** ：它不影响编译、不影响体积统计、 不影响单元测试（如果测试只跑一个类型的话），只会在现场某个型号的板子上变成"读到野指针"。

 

dev\_inherit.c — 继承的物证：布局断言 \+ 上下转型 \+ container\_of C

 

```text
/* dev_inherit.c —— §7.2.3「继承」的全部物证。
 *
 * 这一份文件不产出任何要跑的逻辑，它只干两件事：
 *   ① 把"基类必须是派生类的第一个成员"从一句规约变成**编译器必须遵守的断言**；
 *   ② 把 container_of 的算术代价量出来 —— 偏移是 0 时它是 0 条指令。
 *
 * 全是编译期可判的：本机没有 qemu 和目标硬件，C 代码只编译不运行，
 * 所以这一节的每一个数字都必须来自"编译通过"或"反汇编里读出来的东西"，
 * 而不是"我觉得编译器会这么优化"。
 *
 * ⚠ 这一份【必须编过】：-O2、-Wall -Wextra -Wpedantic -Wshadow
 *   -Wconversion -Wsign-conversion，cortex-m3 与 cortex-m0 两个核都零告警。
 *   它里面同时放着"正确写法"和"错误写法"，两者都能编过、都没有告警 ——
 *   这正是这一节的论点：布局错了编译器不会吭声，_Static_assert 才会。
 *   会响的那一半在 spi_guard_fail.c。
 */
#include <stdint.h>
#include <stddef.h>

/* ============================================================
   一、基类：所有设备共有的那一部分
   ============================================================ */
typedef struct device device_t;

typedef struct device_ops {
    const char *name;
    int  (*init)(device_t *d);
    int  (*read)(device_t *d, void *buf, uint32_t len);
} device_ops_t;

struct device {
    const device_ops_t *ops;    /* 偏移 0 —— 虚表指针，全族共用一张 const 表 */
    void               *priv;   /* 偏移 4 —— 派生类自己的状态挂在这儿 */
    uint8_t             inited; /* 偏移 8 */
};

/* ============================================================
   二、派生类：基类放【第一个】
   ------------------------------------------------------------
   "第一个成员"不是风格偏好，是硬要求 —— C 标准 6.7.2.1p15：
   指向结构体的指针，经适当转换后指向它的**初始成员**，反之亦然。
   这句话是"上转型"（把派生对象当基类用）在 C 里能成立的唯一依据。
   把 base 挪到第二个位置，那句话就不再适用，上转型从"标准保证"
   降级成"在你这台机器上碰巧能用"。下面用 _Static_assert 把位置钉住。
   ============================================================ */
typedef struct {
    device_t base;              /* ← 必须是第一个成员 */
    uint32_t cs_pin;
    uint32_t baud;
} spi_dev_t;

typedef struct {
    device_t base;
    uint8_t  addr;
} i2c_dev_t;

/* ---- 布局断言：位置、尺寸，一个都不许漂 ----
   ⚠ 这几条断言就是"继承"在 C 里的护栏。有人为了"看起来更整齐"把 base 挪到
     后面，或者往基类里插一个新字段，编译器会在这里当场拦住，
     而不是等到几个月后某个型号的板子上出现"读到野指针"。

   ⚠⚠ 消息全部写 ASCII（英文），中文只出现在这段注释里 —— 这是 §3 就立下、
     §6 又重申过一次的规矩，此处遵守：非 ASCII 字节进了
     `static assertion failed:` 会被逐字节转义成八进制，读出来是
     `"\37777777745\37777777637..."`（`-finput-charset=UTF-8` 也救不回来）；
     而同一份诊断里**源码行回显**的中文是正常的。所以：
     **注释写中文（编译器原文回显），断言消息写 ASCII（诊断可读）。**
     话是给人在编译日志里读的，读不出来的护栏只算半条。 */
_Static_assert(sizeof(device_t) == 12, "device_t = ops(4)+priv(4)+inited(1)+3 pad");
_Static_assert(offsetof(spi_dev_t, base) == 0, "spi_dev_t.base must be at offset 0");
_Static_assert(offsetof(i2c_dev_t, base) == 0, "i2c_dev_t.base must be at offset 0");
_Static_assert(offsetof(spi_dev_t, cs_pin) == 12, "derived fields start after the base");
_Static_assert(offsetof(spi_dev_t, base.priv) == 4, "non-zero offset sample for container_of");
_Static_assert(offsetof(i2c_dev_t, addr) == 12, "derived fields start after the base");
_Static_assert(sizeof(spi_dev_t) == 20, "spi_dev_t = 12 + 4 + 4");
_Static_assert(sizeof(i2c_dev_t) == 16, "i2c_dev_t = 12 + 1 + 3 pad");
/* 下面三条不是"顺手多写的"：正文引用的反汇编里能直接读到这三个数，
   断言把它们从"反汇编里看出来的"升级成"编译器担保的"——
   `str r1, [r3, #16]` 写的是 baud，`strb.w r8, [r5, #8]` 写的是 inited，
   `ldr r3, [r3, #4]` 取的是 ops->init。数对不上，这三条先红。 */
_Static_assert(offsetof(spi_dev_t, baud) == 16, "spi_dev_t.baud at offset 16");
_Static_assert(offsetof(device_t, inited) == 8, "device_t.inited at offset 8");
_Static_assert(offsetof(device_ops_t, init) == 4, "device_ops_t.init at offset 4");

/* ============================================================
   三、上转型：两种写法，只有一种永远对
   ------------------------------------------------------------
   下面四个函数两两成对。它们的反汇编条数就是这一小节的结论：
   当 base 在偏移 0 时，两种写法编译成**完全相同**的代码（都是恒等变换）；
   一旦 base 不在偏移 0，`&s->base` 会多出一条加法，而 `(device_t *)s` 一条都不多
   —— 因为后者压根就没打算加，它把 cs_pin 的地址当成了 device_t 的地址。
   **错的那条代码更短。**
   ============================================================ */

/* 正确写法：取基类成员的地址。与 base 在第几位无关，永远对。 */
device_t *spi_as_device_ref(spi_dev_t *s)
{
    return &s->base;
}

/* 碰巧也对：base 在偏移 0 时，(device_t *)s 与 &s->base 是同一个地址。
   它靠的是上面那条 _Static_assert；断言一红，这行就不是"碰巧"而是"已经错了"。 */
device_t *spi_as_device_cast(spi_dev_t *s)
{
    return (device_t *)s;
}

/* ---- 反面：base 排在第二个成员 ---- */
typedef struct {
    uint32_t cs_pin;
    device_t base;              /* ← 挪到后面了 */
} spi_bad_t;

_Static_assert(offsetof(spi_bad_t, base) == 4,
               "spi_bad_t.base is at offset 4: upcast is no longer the identity");
/* 尺寸一个字节都没变 —— 变的只是 base 的位置。所以"位置错了"不会撞上任何
   尺寸检查，它只会让上转型悄悄算错。 */
_Static_assert(sizeof(spi_bad_t) == 16, "spi_bad_t size is unchanged: 4 + 12");

/* ---- 护栏真的会响吗？----
   上面那条断言只证明了"我量到的偏移是 4"。它没有证明"护栏会拦住有人把它改成
   非 0" —— 一条永远不响的断言和保护色是同一种东西。
   所以那一半放在同目录的 spi_guard_fail.c 里：只留结构体定义 + 一条
   `offsetof(spi_bad_t, base) == 0`，按设计必然编译失败，正文逐字贴它的诊断。
   分成两份文件，是因为"这份必须编过（-O2、零告警）"和"这份必须编不过"
   是两个互斥的断言目标，塞进同一个文件只会让两边都验不干净。 */

/* 依然正确：编译器必须把 +4 做出来 */
device_t *spi_bad_as_device_ref(spi_bad_t *s)
{
    return &s->base;
}

/* 依然"编译得过去"，依然"没有告警"，但它返回的是 cs_pin 的地址。
   ⚠ 下面这个函数的存在意义就是给读者看这条反汇编：它比上面那条【少一条指令】。 */
device_t *spi_bad_as_device_cast(spi_bad_t *s)
{
    return (device_t *)s;
}

/* ============================================================
   四、container_of：从成员地址反推宿主对象
   ------------------------------------------------------------
   这是"继承"的另一半。上转型是"拿着派生对象当基类用"；
   container_of 是反向的 —— 基类那侧的代码只拿到一个 device_t *，
   要反过来访问派生类自己的字段（spi_dev_t.cs_pin），就得算回宿主地址。

   Linux 内核、Zephyr、RT-Thread、ESP-IDF 里到处是这个宏，
   它本身的值就是一句指针减法，代价可以精确到指令条数。
   ============================================================ */

/* 简版：不做类型检查。能编过，但传错指针类型也照样编过。 */
#define container_of(ptr, type, member) \
    ((type *)((char *)(ptr) - offsetof(type, member)))

/* 带类型检查的版本（GCC/Clang）：先把 ptr 赋给一个"成员的正确类型"的指针，
   类型不匹配时编译器在这里报错。
   `__extension__` 不是装饰 —— 下面用了语句表达式（braced-group），
   那是 GCC 扩展，`-Wpedantic` 默认会为它报一条 "ISO C forbids braced-groups"。
   加 __extension__ 表示"这里是我有意使用的扩展"，告警被压掉，
   而文件其余部分照旧受 -Wpedantic 约束。少了它，这一节的"零告警"就站不住。 */
#define container_of_checked(ptr, type, member) __extension__ ({ \
    const __typeof__(((type *)0)->member) *__mptr = (ptr);       \
    (type *)((char *)__mptr - offsetof(type, member)); })

/* 偏移 0：这句减法应当被整个折掉，函数体里只剩下返回本身。 */
spi_dev_t *spi_from_base(device_t *d)
{
    return container_of_checked(d, spi_dev_t, base);
}

/* 偏移 4：折不掉，应当留下一条减法。 */
spi_dev_t *spi_from_priv(void *p)
{
    return container_of(p, spi_dev_t, base.priv);
}

/* ---- container_of 的真实用途：让基类那侧能碰到派生状态 ---- */
int spi_set_baud(device_t *d, uint32_t baud)
{
    if (!d) return -1;
    spi_dev_t *s = container_of_checked(d, spi_dev_t, base);
    s->baud = baud;
    return 0;
}

/* ---- 整族遍历：一张表装下所有型号，靠虚表分派 ---- */
int dev_probe_all(device_t *const *list, uint32_t n)
{
    uint32_t ok = 0;
    for (uint32_t i = 0; i < n; i++) {
        device_t *d = list[i];
        if (d && d->ops && d->ops->init && d->ops->init(d) == 0) {
            d->inited = 1;
            ok++;
        }
    }
    return (int)ok;
}

/* ---- 供链接期使用的一个真实实例：证明这一族真的能摆成数组 ---- */
spi_dev_t g_spi0 = {
    .base = { .ops = (const device_ops_t *)0, .priv = (void *)0, .inited = 0 },
    .cs_pin = 4,
    .baud   = 1000000,
};
```

 

✔ 这份文件里同时放着"正确写法"和"错误写法"，而两者都能编过

 

` spi_as_device_cast `（` (device_t *)s `）和 ` spi_bad_as_device_cast `（同样一行，只是结构体里 base 排在第二位）  **编译结果完全一样：零告警、零报错** 。这份文件在 cortex-m3 和 cortex-m0 上都是 ` -O2 -Wall -Wextra -Wpedantic -Wshadow -Wconversion -Wsign-conversion ` 下  **0 条告警** （实测）。 *编译器不会因为你排错布局就吭声 —— 它压根不知道你在模仿继承。*  所以在 C 里做继承，护栏 **必须自己写** ，而且必须是编译期的。

 

#### ② 向上转型：允许两种写法，只有一种永远对

 

先看一个容易被忽略的前提。 **"适当转换"里的那个转换，不加行不行？**  下面这个 20 行的文件就是回答：同样的两个函数，一个不加转换，一个加。

 

upcast\_implicit.c — 加不加那个转换，差别就在这条告警上 C

 

```text
#include <stdint.h>

typedef struct device device_t;
struct device { const void *ops; void *priv; uint8_t inited; };
typedef struct { device_t base; uint32_t cs_pin; } spi_dev_t;

/* ① 不加转换：C 标准说这是约束违反（6.5.16.1 指针赋值），
   编译器【默认就必须报】—— 不依赖 -Wall，因为它属于"必须诊断"那一类。
   但它只是一条 warning：rc 仍然是 0，目标文件照样生成。
   （这一条是实测的：加上 -Wall -Wextra -Wpedantic 也是同一句，不多不少。） */
device_t *upcast_implicit(spi_dev_t *s) { return s; }

/* ② 加上那个转换：告警消失。
   在 base 位于偏移 0 的结构上，这个转换是【多余但正确】的 ——
   编译器替我们算出来的地址本来就等于对象地址，转与不转是同一个数。
   在 base 不在偏移 0 的结构上（见 dev_inherit.c 里的 spi_bad_t），
   同一个转换会顺手把上面那条告警一起咽下去，而这次算出来的地址是错的。
   所以："加上转换"不是风格，它是唯一让编译器闭嘴的办法 ——
   也正因为如此，必须另有一条 _Static_assert 在布局上把着。 */
device_t *upcast_explicit(spi_dev_t *s) { return (device_t *)s; }
```

 

**bash**  — 实测：不加转换报，加转换不报（两个核都是 1 条告警）

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -O2 -Wall -Wextra -Wpedantic -c upcast_implicit.c -o upcast_implicit.o
upcast_implicit.c: In function 'upcast_implicit':
upcast_implicit.c:11:50: warning: returning 'spi_dev_t *' from a function with incompatible return type 'device_t *' {aka 'struct device *'} [-Wincompatible-pointer-types]
   11 | device_t *upcast_implicit(spi_dev_t *s) { return s; }
      |                                                  ^
→ 加上 -Wall -Wextra -Wpedantic 也是同一句，不多不少；
  把这三个开关全去掉，它【照样报】—— 这条属于"编译器必须诊断"的那一类，不是可选的。
  但它只是 warning：rc 还是 0，目标文件照样生成。

$ arm-none-eabi-gcc -mcpu=cortex-m0 -mthumb -std=c11 -O2 -Wall -Wextra -Wpedantic -c upcast_implicit.c -o upcast_implicit.o
upcast_implicit.c:11:50: warning: ... [-Wincompatible-pointer-types]   ← 一字不差，同一个行号、同一个列号
```

 

于是那个转换的作用说清楚了： **它是让编译器闭嘴的唯一办法** 。 在 base 位于偏移 0 的结构上，这个转换是"多余但正确"的 —— 编译器本来算出的地址就等于对象地址，转与不转是同一个数。 而在 base 不在偏移 0 的结构上， **同一个转换会顺手把上面那条告警一起咽下去** ， 而这次算出来的地址是错的。  *一个用来消除告警的写法，同时消掉了唯一会指出这个 bug 的信号*  —— 这就是为什么 §7.2.3 ① 那几条 ` _Static_assert ` 不是"锦上添花"。

 

现在看代价。` dev_inherit.c ` 里那四个函数两两成对， 区别只有 ` base ` 在第几位、以及写法是取成员地址还是直接强转。 它们的反汇编长这样：

 

**bash**  — 实测反汇编（节选）· cortex-m3 · -O2 · 六个小函数全在这里

 

```text
$ arm-none-eabi-objdump -d dev_inherit.o
<spi_as_device_ref>:                    ← 正确写法，且 base 在偏移 0
   0:	4770      	bx	lr
   2:	bf00      	nop                      ← 编译器补的对齐填充，源码里没有这一条
<spi_as_device_cast>:                   ← (device_t *)s，base 也在偏移 0
   4:	4770      	bx	lr
   6:	bf00      	nop
<spi_bad_as_device_ref>:                ← 正确写法，但 base 跑到了偏移 4
   8:	3004      	adds	r0, #4           ← 编译器老老实实加上了 4
   a:	4770      	bx	lr
<spi_bad_as_device_cast>:               ← (device_t *)s，base 在偏移 4
   c:	4770      	bx	lr
   e:	bf00      	nop                      ← 一条 adds 都没有：它压根没打算加

<spi_from_base>:                        ← container_of 到偏移 0 的成员
  10:	4770      	bx	lr
  12:	bf00      	nop                      ← 那句减法被整个折掉了
<spi_from_priv>:                        ← container_of 到偏移 4 的成员
  14:	3804      	subs	r0, #4           ← 这条减法折不掉
  16:	4770      	bx	lr
```

 

✖ 这张反汇编里最不该被忽略的一件事：错的那条，体积上没有任何迹象

 

` spi_bad_as_device_ref ` 老老实实做了 ` adds r0, #4 `； 紧跟着的 ` spi_bad_as_device_cast `  **一条 ` adds ` 都没有**  —— 因为它返回的是 ` cs_pin ` 的地址，被当成了 ` device_t ` 的地址。

 

按直觉，"少了那一步"总该在体积上留下点什么。实测结果相反 ——  **两者都是 2 条指令、都是 4 字节**  （Thumb 下 ` bx lr ` 只占 2 字节，余下的槽位由编译器补的对齐 ` nop ` 填掉）：

 

 
- 把 ` base ` 从偏移 0 挪到偏移 4， **条数一条都没涨**  —— 多出来的那条 ` adds ` 恰好占掉了原本属于对齐 ` nop ` 的位置。 这 4 个字节的偏移，在 cortex-m3 上连一条指令的代价都没留下（cortex-m0 上同样如此）。
 
- 而写错的那条 **同样是 2 条指令、同样 4 字节**  —— size 报告、反汇编条数、map 文件， **一个异常都没有** 。
 

 

**代价为零不等于风险为零，恰恰相反。**  编译期零告警、体积零变化、条数零变化 —— 这条错误在你手上的每一份报告里都是隐形的。 它可怕的地方不在难修，而在 **它从来没有"坏掉"的样子** ： 只是让基类那侧读到派生类的字段，值看起来还挺像回事。  *所以"如果错了体积会变"这类间接信号，在这里一个都用不上 —— 护栏只能是编译期断言。*

 

⚠ 这一节的证据为什么不是"指令条数"

 

上面六个函数， **每一个都正好是 2 条指令** （` bx lr ` \+ 编译器补的对齐 ` nop `；` spi_bad_as_device_ref ` 那 2 条 是 ` adds ` \+ ` bx lr `）。 也就是说： **数条数在这一节一点用都没有**  —— "恒等变换"和"多加 4"数出来是同一个数。

 

所以门禁里这一节的断言 **故意没有用指令条数**  （本站其它小节用过 ` countByCpu ` 那套）， 而是按 **函数名 \+ 具体指令编码** 来钉： ` <spi_as_device_ref>: ` 与下一个空行之间不许出现 ` adds `， ` <spi_bad_as_device_ref>: ` 之间必须有 ` 3004 adds r0, #4 `， ` <spi_from_priv>: ` 之间必须有 ` 3804 subs r0, #4 `。 指令编码是架构规定的、不会随 GCC 小版本漂移的东西 —— 钉它比钉"几条"结实得多。  *这是"选对证据形态"的一个具体例子：同一个事实，用错形态就什么都证明不了。*

 

#### ③ 护栏必须真的会响

 

上面那几条 ` _Static_assert ` 只证明了一件事：  **我量到的偏移是这些数** 。它 **没有** 证明"护栏会拦住别人把它改成非 0"—— 一条永远不响的断言和保护色是同一种东西。 所以这一半单独放一个文件：只留结构体定义 \+ 一条位置断言， **按设计必然编译失败** 。

 

spi\_guard\_fail.c — 反面教材：把基类挪到第二位，护栏必须当场响 C

 

```text
#include <stdint.h>
#include <stddef.h>

/* 反面教材：把基类从第一个成员挪到第二个，就为了看第 10 行那句话。
   它与 dev_inherit.c 里的部分连字段名都一样，差别只有 base 的位置 ——
   而这一处差别，编译器【本来完全可以不吭声】。 */
typedef struct { const void *ops; void *priv; uint8_t inited; } device_t;
typedef struct { uint32_t cs_pin; device_t base; } spi_bad_t;

_Static_assert(offsetof(spi_bad_t, base) == 0, "base must be the first member");
```

 

**bash**  — 实测编译失败（就是为了看这句话）

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -Wall -Wextra -c spi_guard_fail.c -o spi_guard_fail.o
spi_guard_fail.c:10:1: error: static assertion failed: "base must be the first member"
   10 | _Static_assert(offsetof(spi_bad_t, base) == 0, "base must be the first member");
      | ^~~~~~~~~~~~~~

→ 编译停在原地。这就是我们要的效果：
  诊断里【原样带出】了断言消息，读的人立刻知道是哪条前提不成立 ——
  而且它还顺手把出错的那一行源码回显在下面，连"哪个结构体"都不用猜。
  只把断言里的 0 换成 4（也就是承认 base 在第二位），rc 立刻回到 0 ✓
  ——所以红的确实是"位置"这一件事，不是别的什么连带的错。
```

 

✔ 为什么断言消息必须写成英文（ASCII）

 

上面那句 ` "base must be the first member" ` 是英文，不是崇洋。 §3.6.2 实测过一个坑： **非 ASCII 字节进了 ` static assertion failed: ` 会被逐字节转义成八进制** ，读出来是 ` "\37777777745\37777777637..." `，加 ` -finput-charset=UTF-8 ` 也救不回来。 而同一份诊断里 **源码行回显** 的中文是正常的。

 

所以本站的规矩是： **注释写中文（编译器原文回显），断言消息写 ASCII（诊断可读）** 。 断言一旦会响，它的消息就是给人在编译日志里读的 ——  *读不出来的护栏只能算半条。*

 

#### ④ container\_of：反方向的同一句话

 

上转型是"拿着派生对象当基类用"。继承还有另一半：基类那侧的代码只拿到一个 ` device_t * `，它想反过来访问派生类自己的字段（比如 ` spi_dev_t.baud `），怎么办？

 

答案是指针减法：既然知道 ` base ` 在宿主结构体里的偏移， 用成员地址减掉偏移就回到了宿主地址。` dev_inherit.c ` 里给了两个版本：

 

 
- ` container_of ` —— 简版，一句指针减法，不做任何类型检查。 能编过，但传错指针类型也照样编过。
 
- ` container_of_checked ` —— 先把 ` ptr ` 赋给一个 "成员的正确类型"的指针，类型不匹配时编译器在这里报错。这就是 Linux 内核里那个版本。 注意它外面套了 ` __extension__ `：里面用了语句表达式（braced-group）， 那是 GCC 扩展，` -Wpedantic ` 默认会为它报一条  *"ISO C forbids braced-groups"* 。加 ` __extension__ ` 表示 "这里是我有意使用的扩展"，告警被压掉，而文件其余部分照旧受 ` -Wpedantic ` 约束。  **少了它，上面那句"零告警"就站不住**  —— 这不是推测：下面那份文件就是同一个宏删掉 ` __extension__ ` 的样子， 同一套编译开关喂进去，告警立刻就出来了。
 

 

下面这份文件与 ` dev_inherit.c ` 里的 ` container_of_checked `  **只差最前面那一个 ` __extension__ `** ，其余一个字都没动。 把它单独摆出来，是因为"少了它就会报"这句话如果只是嘴上说， 读者没有任何办法分辨它是实测还是我以为：

 

pedantic\_braced.c — 反面教材：只删掉 \_\_extension\_\_，-Wpedantic 立刻说话 C

 

```text
#include <stddef.h>

typedef struct device device_t;
struct device { const void *ops; void *priv; };
typedef struct { device_t base; unsigned cs_pin; } spi_dev_t;

/* 与 dev_inherit.c 里的 container_of_checked 是同一个宏，
   只少了最前面那个 __extension__ —— 其余一个字都没动。 */
#define container_of_naive(ptr, type, member) ({ \
    const __typeof__(((type *)0)->member) *__mptr = (ptr); \
    (type *)((char *)__mptr - offsetof(type, member)); })

spi_dev_t *spi_naive(device_t *d) { return container_of_naive(d, spi_dev_t, base); }
```

 

**bash**  — 实测：同一套开关，差别只有那一处

 

```text
$ arm-none-eabi-gcc -mcpu=cortex-m3 -mthumb -std=c11 -O2 -Wall -Wextra -Wpedantic -c pedantic_braced.c -o pedantic_braced.o
pedantic_braced.c: In function 'spi_naive':
pedantic_braced.c:9:47: warning: ISO C forbids braced-groups within expressions [-Wpedantic]
    9 | #define container_of_naive(ptr, type, member) ({ \
      |                                               ^
pedantic_braced.c:13:44: note: in expansion of macro 'container_of_naive'
   13 | spi_dev_t *spi_naive(device_t *d) { return container_of_naive(d, spi_dev_t, base); }
      |                                            ^~~~~~~~~~~~~~~~~~
→ 正好一条，行号 9 列号 47 —— 指的就是那个 `({`。
  实测过三组开关：只给 -Wpedantic、给 -Wall -Wextra -Wpedantic、
  再叠上 -Wshadow -Wconversion -Wsign-conversion，三组都是【这一条，不多不少】。
  也就是说这条告警不是"开关开多了冒出来的"，它是 -Wpedantic 的固有立场：
  ISO C 里没有语句表达式这个东西。
  而 dev_inherit.c 在同一套开关下是 0 条 —— 两边的差别只有开头那一个 __extension__。
```

 

它的代价可以精确到指令条数，就在上面那张反汇编里：  **偏移为 0 时那句减法被整个折掉** （` <spi_from_base> ` 只剩 ` bx lr `）， **偏移为 4 时留下一条 ` subs r0, #4 `**  （` <spi_from_priv> `）。 也就是说： *容器宏本身不花钱，花钱的是偏移不为 0* 。 ` container_of_checked ` 的类型检查也是零运行时代价 —— 那个 ` __mptr ` 局部变量只会存在于类型系统里。

 

◆ 反汇编是布局的公证人：这几个数在指令里能直接读出来

 

文档会过期、注释会漂移，但 **机器码是按真实偏移生成的** 。 上面那份反汇编里，` dev_inherit.c ` 的三个关键偏移能逐条对上：

 

 
- ` dev_probe_all ` 里 ` strb.w r8, [r5, #8] ` （cortex-m0 是 ` strb r3, [r5, #8] `）—— 写的是 ` d->inited `， **偏移 8** 。
 
- ` spi_set_baud ` 里有一条 ` str r1, [r3, #16] ` （cortex-m0 上是 ` str r1, [r0, #16] `，寄存器号不同、偏移一样）—— 写的是 ` s->baud `， **偏移 16** （= 基类 12 \+ ` cs_pin ` 4）。
 
- ` dev_probe_all ` 里 ` ldr r3, [r5, #0] ` 然后 ` ldr r3, [r3, #4] ` —— 先取 ` d->ops `（ **偏移 0** ）， 再取 ` ops->init `（` device_ops_t ` 里的 **偏移 4** ）。 这一对连起来就是"虚表指针在第一个位置"的物证。

 

这三个数，在 ` dev_inherit.c ` 里各有一条 ` _Static_assert ` 看着。  **反汇编和断言是互相独立的两个证人** ：断言错、反汇编对不上， 门禁里两边都会红。这就是为什么这一节的产物是"一份能编过的文件 \+ 一份必须编不过的文件"， 而不是一堆抄在正文里的数字。

 

#### ⑤ 同一份代码，两个核：M0 上没有"便宜"的抽象

 

把 ` dev_inherit.c ` 分别按 cortex-m3 和 cortex-m0 编出来， 差别比想象中大：

 

| 函数 | cortex-m3 | cortex-m0 | 差在哪 |
| --- | --- | --- | --- |
| 六个转型 / 容器小函数 | 各 2 | 各 2 | 一致。M0 上的对齐填充是 ` 46c0 `（` mov r8, r8 `），M3 是 ` bf00 `，仅此而已 |
| ` spi_set_baud ` | **7** | **8** | M0 没有 ` cbz `，得用 ` cmp ` \+ ` beq ` 两条；返回 ` -1 ` 也要 ` movs ` \+ ` negs ` 两条，M3 一条 ` mov.w ` 就够 |
| ` dev_probe_all ` | **25** | **42** | **多 68%** 。M3 用 ` ldr.w r5, [r6, #4]! `（带写回的预索引寻址）一条走一步，M0 得先 ` lsls r3, r4, #2 ` 把下标乘 4、再 ` ldr r5, [r7, r3] `；每处判空也从一条 ` cbz ` 变成 ` cmp ` \+ ` beq ` |

 

*（这张表里的数是 ` objdump -d ` 的行数，从函数标签行数到下一个空行， 含编译器补的对齐 ` nop `。口径写在门禁里，两个核用的同一条。）*

 

结论只有一句，但它值得单独记住： **抽象的代价不是常数，它随内核变化** 。 "虚表 \+ 基类 \+ 容器宏"这套写法在 M3 上几乎免费， 在 M0 上每一处判空、每一次下标寻址都要多付一条指令。 如果你的目标芯片是 M0/M0\+，那么这一段继承代码要多付多少，是可以量出来的 —— 同一个文件里 ` dev_probe_all ` 从 25 条涨到 42 条（ **\+68%** ）， ` spi_set_baud ` 从 7 条涨到 8 条。 这不是"风格问题"，是选型问题。要么换核，要么在设计阶段就把"这一层抽象值不值"算清楚。

 

#### ⑥ 三件套的分工与代价：什么时候不该用继承

 

把 §7.2 这三节放在一起看，"面向对象 C"其实是一张三选一的清单， 每一件都有它自己的每实例代价和使用前提：

 

| 能力 | C 里靠什么实现 | 每实例代价 | 什么时候 **不** 该用 |
| --- | --- | --- | --- |
| 封装 | 不透明指针：头文件里只留 ` typedef struct sensor sensor_t; `，定义藏在 ` .c ` 里（§7.2.1） | 0 字节（句柄本身可以放栈上） | 字段少、且调用方就是同一模块 —— 多一层 ` sensor_get() ` 只增加跳转 |
| 继承 | 基类置首成员 \+ 上下转型 \+ ` container_of `（本节） | 基类那部分每实例都要占（本例  **12 B** ） | 只有一个实现；或者层次只有一层 —— 这时 **组合** （把 ` device_t ` 当普通成员，用 ` &obj->dev ` 传出去）比继承更清楚，也不用背"必须放第一位"的包袱 |
| 多态 | 虚表：` const ` 的函数指针表 \+ 每个对象一个 ` ops ` 指针（§7.2.2） | 每实例 4 B 虚表指针 \+ 每次调用一次间接跳转 | 中断处理路径里 —— 间接调用不可预测，且会打断流水线；这类路径改用 **编译期选择** （` #if ` 或链接期绑定） |

 

◆ 一句话记住这一节

 

C 的继承 =  **一个位置约定（基类放第一个）\+ 一句标准保证（C11 §6.7.2.1p15） \+ 一条 ` _Static_assert `** 。 前两样让上转型成立，第三样让"有人破坏它"变成一次编译失败而不是一次现场事故。  *少了第三样，你写的不是继承，是"碰巧能跑的强制类型转换"。*

 

◆ 三件套落地时的三个工程细节：ctx、可选能力、const 放哪

 

接口能跑起来之后，真正决定它"能不能被别人接手维护"的，是下面这三条约定：

 

 
- **` void *ctx ` 就是显式传进去的 this。**  虚表里每个函数第一个参数统一是句柄（` void *ctx ` 或具体的 ` sensor_t * `）， 实现自己再往回转。 **不要用全局变量假装成员**  —— 那样一个类型就只能有一个实例， 多开一个传感器就穿帮。ctx 的存在本身，就是把"对象状态"从"全局状态"里救出来的手段。
 
- **可选能力：虚表成员允许为 NULL，但调用点必须判。**  不是每个实现都支持全部操作（某个屏没有背光、某个传感器没有校准）。 规范写法是` if (ops->set_backlight) ops->set_backlight(ctx, v); `；  **漏了判空，换一个实现就当场空指针崩** 。能力查询要么直接判 NULL，要么另给一个 ` capabilities() ` 位掩码 —— 两者都行，关键是"缺能力"要能被表达，而不是假装都有。
 
- **const 要加对地方。**  ` ops ` 表本身应是 ` const `（进 Flash、不占 RAM、也防被改）； 只读接口的句柄参数应是 ` const xxx_t * `； ` get_size() ` 这种查询更不该收非 const 句柄。 const 加错位置，轻则编译不过、重则逼你在调用点做强转，把类型检查一起丢掉。   
   ⚠ 反过来说： **运行期状态（尺寸、当前旋转、错误计数）绝不能塞进 ` const ` 的 ops 表**  —— 那是"每实现一份"的常量表，不是"每实例一份"的状态。状态放 ctx（私有结构体），ops 只放函数指针。

  

```zhizhan-anchor
ch7-3
```



## 7.3 分层架构：模块边界怎么划

 

**FIG 7.2**  嵌入式软件的四层架构（依赖只能向下）

 

```zhizhan-figure
<svg viewBox="0 0 660 320" width="660" height="320" role="img" aria-label="四层架构">
          <!-- 层 -->
          <rect x="60" y="20" width="540" height="62" rx="7" fill="var(--vio-d)" stroke="var(--vio)"></rect>
          <text x="76" y="42" class="sv-lbl-hi" style="fill:var(--vio)">④ 应用层 Application</text>
          <text x="76" y="62" class="sv-lbl-dim" style="font-size:10.5px">业务逻辑 · 状态机 · 协议解析 · 用户交互</text>
          <text x="510" y="52" class="sv-lbl-dim" style="font-size:10px" text-anchor="end">可移植 · 可在 PC 上单元测试</text>

          <path d="M 330 82 L 330 96" class="sv-arrow"></path>

          <rect x="60" y="100" width="540" height="62" rx="7" fill="var(--cyn-d)" stroke="var(--cyn)"></rect>
          <text x="76" y="122" class="sv-lbl-hi" style="fill:var(--cyn)">③ 服务层 Service / Middleware</text>
          <text x="76" y="142" class="sv-lbl-dim" style="font-size:10.5px">RTOS 封装 · 日志 · 配置管理 · 文件系统 · 通信协议栈 · 算法库</text>
          <text x="510" y="132" class="sv-lbl-dim" style="font-size:10px" text-anchor="end">尽量不依赖具体硬件</text>

          <path d="M 330 162 L 330 176" class="sv-arrow"></path>

          <rect x="60" y="180" width="540" height="62" rx="7" fill="var(--grn-d)" stroke="var(--grn)"></rect>
          <text x="76" y="202" class="sv-lbl-hi" style="fill:var(--grn)">② 驱动层 Driver / HAL</text>
          <text x="76" y="222" class="sv-lbl-dim" style="font-size:10.5px">外设驱动（GPIO/UART/SPI/I2C/ADC）· 统一接口（见 7.2 的多态）</text>
          <text x="510" y="212" class="sv-lbl-dim" style="font-size:10px" text-anchor="end">这一层开始碰寄存器</text>

          <path d="M 330 242 L 330 256" class="sv-arrow"></path>

          <rect x="60" y="260" width="540" height="52" rx="7" fill="var(--amb-d)" stroke="var(--amb)"></rect>
          <text x="76" y="282" class="sv-lbl-hi" style="fill:var(--amb)">① 硬件层 Hardware</text>
          <text x="76" y="302" class="sv-lbl-dim" style="font-size:10.5px">MCU 寄存器 · 外设电路 · 传感器 · 执行器 · 时钟树</text>

          <!-- 侧边规则 -->
          <text x="606" y="60" class="sv-lbl-hi" style="fill:var(--red);font-size:10px" text-anchor="middle">✕</text>
          <text x="606" y="140" class="sv-lbl-hi" style="fill:var(--red);font-size:10px" text-anchor="middle">✕</text>
          <text x="606" y="220" class="sv-lbl-hi" style="fill:var(--red);font-size:10px" text-anchor="middle">✕</text>
          <text x="630" y="180" class="sv-lbl-dim" style="font-size:9.5px" transform="rotate(90 630 180)" text-anchor="middle">禁止反向依赖</text>
        </svg>
```

 

**铁律：依赖只能向下，不能向上，也不能跨层。**  应用层不直接调寄存器，驱动层不调用业务逻辑。   
  
  *违反这条规则的代价：想换个 MCU 就得重写整个项目；想给业务逻辑写单元测试，必须先造一块板子。*

 

分层实践：一个温度采集任务的四层代码 C

 

```text
/* ============================================================
   同一个功能"每 10 秒读一次温度，超过 30℃ 报警"
   在四层里的样子
   ============================================================ */

#include "sensor.h"     /* sensor_err_t / SENSOR_OK / SENSOR_ERR_IO / SENSOR_ERR_CRC */

/* 下面是 6.x 的 I2C 层提供的东西 —— 这四层自己不实现总线，
   只调用总线。所以这里只需要声明（分层做对了的另一个标志：
   驱动层不认识寄存器，只认识 i2c_read）。 */
extern int  i2c_read(uint8_t addr, uint16_t cmd, uint8_t *buf, size_t len);
extern uint8_t crc8(const uint8_t *data, size_t len);
#define SHT30_ADDR   0x44        /* SHT30 的 7 位地址 */
#define CMD_MEASURE  0x2C06      /* 高重复性、无时钟拉伸的测量命令 */

/* ---------- ② 驱动层：sht30.c ---------- */
/* 只负责"怎么和这个芯片说话"，不含业务判断 */
sensor_err_t sht30_read_raw(uint16_t *raw_temp, uint16_t *raw_humid)
{
    uint8_t buf[6];
    if (i2c_read(SHT30_ADDR, CMD_MEASURE, buf, sizeof buf) != 0)
        return SENSOR_ERR_IO;
    if (crc8(buf, 5) != buf[5])
        return SENSOR_ERR_CRC;
    *raw_temp  = (uint16_t)((buf[0] << 8) | buf[1]);
    *raw_humid = (uint16_t)((buf[3] << 8) | buf[4]);
    return SENSOR_OK;
}

/* ---------- ③ 服务层：temp_svc.h ---------- */
/* 这一层自己的"词汇表"：错误码 + 依赖接口 + 对外接口。
   分层是否做对，看这个文件就知道：
     · 它 include 了 sensor.h（因为它要靠 sensor_err_t 描述"读失败"）
     · 它【不】认识寄存器、不 include 任何 stm32 头 */

/* ⚠ 关键：这一层通过函数指针获取时间，而不是直接调 HAL_GetTick()
   这样在 PC 上测试时可以注入假时钟 */
typedef struct {
    uint32_t (*get_tick)(void);         /* 时间源，可注入 */
    sensor_err_t (*read_raw)(uint16_t *t, uint16_t *h);
} temp_svc_deps_t;

typedef enum {
    TEMP_OK = 0,            /* 本次真的有新数据 */
    TEMP_NOT_DUE,           /* 还没到采样周期，不是错误 */
    TEMP_ERR_READ           /* 读传感器失败 */
} temp_err_t;

void       temp_svc_init(const temp_svc_deps_t *deps);
temp_err_t temp_svc_poll(void);
int32_t    temp_svc_get_x100(void);

/* ---------- ③ 服务层：temp_svc.c ---------- */
/* 负责"把原始值变成有意义的物理量 + 缓存 + 滤波" */

static temp_svc_deps_t g_deps;
static int32_t  g_last_temp_x100;       /* 最后一次温度（0.01℃）*/
static uint32_t g_last_read_tick;
static int32_t  g_filter_buf[4];        /* 简单滑动平均 */
static uint8_t  g_filter_idx;

void temp_svc_init(const temp_svc_deps_t *deps)
{
    g_deps = *deps;                     /* 依赖注入 */
    g_last_temp_x100 = INT32_MIN;       /* 表示"还没有数据" */

    /* ⚠ 必须把"上次采样时刻"设成"一个周期之前"，不能靠 .bss 清零。
       只靠清零（=0）的话，上电后 now - 0 一开始小于周期，
       poll() 会在头 10 秒里一直返回 TEMP_NOT_DUE —— 第一次采样白白晚一个周期。
       用 unsigned 回绕写成 now - 周期，保证第一次调用就到期。
       （这个缺陷曾差点被单元测试的起始条件掩盖，见 7.6 的案例。） */
    g_last_read_tick = g_deps.get_tick() - 10000u;
}

/* 转换公式：SHT30 的 datasheet 公式，属于服务层的知识 */
static int32_t temp_raw_to_x100(uint16_t raw)
{
    /* T = -45 + 175 * raw / 65535  （单位 ℃）
       转成 0.01℃ 定点数，避免浮点（Cortex-M0 无 FPU）*/
    return -4500 + (int32_t)((17500LL * raw) / 65535LL);
}

temp_err_t temp_svc_poll(void)
{
    uint32_t now = g_deps.get_tick();
    if (now - g_last_read_tick < 10000) {   /* 10 秒周期 */
        return TEMP_NOT_DUE;
    }
    g_last_read_tick = now;

    uint16_t rt, rh;
    sensor_err_t e = g_deps.read_raw(&rt, &rh);
    if (e != SENSOR_OK) return TEMP_ERR_READ;

    /* 滑动平均滤波 */
    g_filter_buf[g_filter_idx] = temp_raw_to_x100(rt);
    g_filter_idx = (g_filter_idx + 1) & 0x03;

    int32_t sum = 0;
    for (int i = 0; i < 4; i++) sum += g_filter_buf[i];
    g_last_temp_x100 = sum / 4;

    return TEMP_OK;
}

int32_t temp_svc_get_x100(void) { return g_last_temp_x100; }

/* ---------- ④ 应用层：alarm_logic.c ---------- */
/* 纯业务逻辑：没有任何硬件调用，可以在 PC 上完整测试 */

typedef enum { ALARM_NORMAL, ALARM_WARNING, ALARM_CRITICAL } alarm_level_t;

#define TEMP_WARN_X100      3000        /* 30.00℃ */
#define TEMP_CRIT_X100      4500        /* 45.00℃ */
#define HYSTERESIS_X100      200        /* 2℃ 回差，防止在阈值附近抖动 */

alarm_level_t alarm_evaluate(int32_t temp_x100, alarm_level_t prev)
{
    /* 回差处理：升温到 30℃ 才报警，但降到 28℃ 才解除。
       没有回差的话，温度在 30.00℃ 附近波动会疯狂报警/解除 */
    switch (prev) {
    case ALARM_NORMAL:
        if (temp_x100 >= TEMP_CRIT_X100) return ALARM_CRITICAL;
        if (temp_x100 >= TEMP_WARN_X100) return ALARM_WARNING;
        return ALARM_NORMAL;

    case ALARM_WARNING:
        if (temp_x100 >= TEMP_CRIT_X100) return ALARM_CRITICAL;
        if (temp_x100 <  TEMP_WARN_X100 - HYSTERESIS_X100) return ALARM_NORMAL;
        return ALARM_WARNING;

    case ALARM_CRITICAL:
        if (temp_x100 < TEMP_WARN_X100 - HYSTERESIS_X100) return ALARM_NORMAL;
        if (temp_x100 < TEMP_CRIT_X100 - HYSTERESIS_X100) return ALARM_WARNING;
        return ALARM_CRITICAL;
    }
    return ALARM_NORMAL;
}

/* ---------- 组装：main.c ----------
   装配点在【最上面一层】，这是分层的另一条规矩：
   只有 main.c 认识所有人，其他三层互相只认识接口。 */

/* ① 系统时钟源（6.x 里基于 SysTick 实现，返回上电以来的毫秒数）*/
extern uint32_t hal_get_tick(void);

/* ④ 报警动作：LED / 蜂鸣器 / 上报云端，换实现不影响上面三层。
   这里只声明 —— 它的实现属于"输出设备"那一层，不是本节的关注点。 */
extern void alarm_notify(alarm_level_t level, int32_t temp_x100);

void app_main(void)
{
    /* 驱动层依赖注入到服务层 */
    temp_svc_deps_t deps = {
        .get_tick = hal_get_tick,
        .read_raw = sht30_read_raw,
    };
    temp_svc_init(&deps);

    static alarm_level_t level = ALARM_NORMAL;

    for (;;) {
        if (temp_svc_poll() == TEMP_OK) {
            int32_t t = temp_svc_get_x100();
            alarm_level_t new_level = alarm_evaluate(t, level);

            if (new_level != level) {
                level = new_level;
                /* 报警动作也通过接口，方便换实现（LED / 蜂鸣器 / 上报云端）*/
                alarm_notify(level, t);
            }
        }
        /* 让出 CPU 给其他任务 */
    }
}

/* ============================================================
   这个分层带来的实际好处

   ① 换传感器（SHT30 → SHT40）：
      只改 sht30.c，服务层和应用层零改动

   ② 换 MCU（STM32F1 → ESP32）：
      只改驱动层（i2c_read 的实现），上面全不动

   ③ 在 PC 上测试报警逻辑：
      alarm_evaluate 是纯函数，直接写测试：
        assert(alarm_evaluate(3100, ALARM_NORMAL) == ALARM_WARNING);
        assert(alarm_evaluate(2900, ALARM_WARNING) == ALARM_WARNING);  // 回差
        assert(alarm_evaluate(2700, ALARM_WARNING) == ALARM_NORMAL);
      毫秒级跑完，不需要任何硬件

   ④ 调试时只看一层：
      传感器读数不对 → 只查驱动层
      读数对但报警不对 → 只查应用层
      这个"二分定位"能力，是分层架构最大的日常收益
   ============================================================ */
```

 

◆ 判断分层是否成功的三个测试

 

 
1. **能不能在 PC 上编译应用层？**  如果 ` alarm_logic.c ` 需要包含 ` stm32f1xx.h ` 才能编译，说明分层失败了。
 
2. **换一块开发板要改几个文件？**  理想答案是"只改驱动层的那几个"。如果答案是"到处都要改"，说明抽象泄漏了。
 
3. **一个 bug 需要看几个文件才能定位？**  好的分层下，大多数 bug 只需要看 1-2 个文件——因为职责边界清晰，问题必然落在某一层里。

 

○ 再补两层：BSP 与 OSAL，以及"依赖倒置"这个唯一例外

 

四层图是骨架，真实工程常在它内部再分出两小块：  **BSP（板级支持包）** 把"这块板子特有的东西"收在一处 —— 同一颗 MCU 换个板子，引脚、晶振、外设接线都可能不同，换板时只改 BSP；  **OSAL（操作系统抽象层）** 把"建任务 / 延时 / 加锁"包成自己的一套接口， 裸机版、FreeRTOS 版、RT-Thread 版共用同一份上层代码。 两者都是"把易变的东西隔离到一层"，和分层的动机一致。

 

**依赖只能向下的唯一例外，叫"依赖倒置"。**  服务层需要"读温度""取时间"这类下层能力，但不想硬绑某个具体驱动 —— 于是它 **自己定义所需的接口** （就是 §7.3 里的 ` temp_svc_deps_t `）， 由最上层的装配点把具体实现塞进来（依赖注入）。这不违反"依赖向下"： 服务层依赖的是 **一个抽象** ，而抽象的实现仍然在下面。  *判断有没有做对，看服务层有没有 include 任何具体驱动的头文件 —— 没有，就对了。*

 

**跨层违规怎么自动查** ：① 看 ` #include ` 图，应用层不许出现 ` stm32*.h `； ② 目录/命名约定（应用层文件不带 ` bsp_ `/` hal_ ` 前缀）； ③ 最省事的一种 ——  **编译应用层时干脆不给驱动头文件的 ` -I ` 路径** ， 一旦偷偷 include 就直接编译失败，比任何 CI 规则都硬。

 

```zhizhan-anchor
ch7-4
```



## 7.4 错误处理：嵌入式里最容易被敷衍的部分

 

| 策略 | 适用场景 | 实现要点 |
| --- | --- | --- |
| **返回错误码** | 绝大多数函数。 *嵌入式首选* | 定义模块专属的错误码枚举 \+ ` xxx_err_str() ` 函数。不要裸返回 ` -1 ` |
| **断言 assert** | 检查"绝不应该发生"的内部不变量 | 开发期启用，量产禁用（或保留临界断言触发复位）。 **只用于程序 bug，不用于外部输入** |
| **错误回调** | 驱动层向服务层报告异步错误 | ` typedef void (*err_cb_t)(err_t, void *user); ` 注册到模块 |
| **错误状态机** | 通信协议、状态机驱动 | 把 ERROR 作为显式状态（见 7.1），有明确的恢复路径 |
| **看门狗复位** | 无法恢复的严重错误 | 最后手段。复位前把错误码写进 **备份寄存器** ，重启后可读回。 ⚠ 网上流传的 ` RTC->BKP ` 是 F4/H7 的写法， **STM32F1 上没有这个成员** ——具体写法见下方 |

 

⚠ "复位前存错误码"：F1 上到底该写哪几个寄存器

 

这个技巧本身是对的，但网上的代码大多抄的是 F4/H7 的写法，直接搬到蓝板上会 **编译不过，或者编译过了却写不进去** 。 两个系列的备份域长得完全不一样：

 

 
- **F4 / F7 / H7** ：` RTC->BKP0R ` ~ ` BKP31R `，32 位，挂在 RTC 外设下面。
 
- **F1 / F0** ：` BKP->DR1 ` ~ ` DR10 `， **只有 10 个、每个 16 位** （合计 20 字节）， 是独立外设 ` BKP `，基址 ` 0x40006C00 `。 *没有 ` BKP0R ` 这个名字* 。
 

 

更关键的是：F1 的备份域默认 **锁着** ，写之前必须做两件事——  **① 开 BKP/PWR 的 APB1 时钟** （默认关闭，漏了会静默失败），  **② 置 ` PWR_CR ` 的 ` DBP ` 位解锁** 。 而且 ` DBP ` 在每次复位后都会被硬件清掉，所以每次上电都得重新解锁一次。

 

panic.c — STM32F103 的"临终遗言" C

 

```text
#include "stm32f1xx.h"          /* RCC / PWR / BKP 的寄存器定义 */

/* 前提：VBAT 上接了纽扣电池或超级电容。
   没有的话，主电源一断备份域也跟着掉，这个机制就形同虚设
   （蓝板一般焊了电池座，但要自己装电池）。 */

#define BKP_MAGIC   0x5A5AUL    /* 用来区分"我们真的写过"和"上电随机值" */

static void bkp_unlock(void)
{
    /* ① 开时钟：BKPEN = APB1ENR bit27，PWREN = bit28。
          两个外设都在 APB1 上，默认时钟关闭。
          漏了这一步不会有任何报错，只是后面写什么都进不去。 */
    RCC->APB1ENR |= RCC_APB1ENR_BKPEN | RCC_APB1ENR_PWREN;
    (void)RCC->APB1ENR;         /* 回读一次，等时钟真正稳定（外设总线有时序要求）*/

    /* ② 解锁备份域：PWR_CR 的 DBP（bit8）。
          这是个防手滑开关，复位后硬件会把它清掉，
          所以"每次上电后第一次写备份寄存器"都必须先解锁。 */
    PWR->CR |= PWR_CR_DBP;
}

void panic_store(uint16_t code)
{
    bkp_unlock();
    BKP->DR1 = BKP_MAGIC;       /* 先写魔数，再写内容 */
    BKP->DR2 = code;
    PWR->CR &= ~PWR_CR_DBP;     /* 写完立刻上锁，防止别处误写 */
}

/* 读不需要解锁，所以"复位后第一时间读回来"是成立的 */
int panic_recall(uint16_t *code)
{
    if ((uint16_t)BKP->DR1 != BKP_MAGIC) return -1;   /* 冷启动，从没写过 */
    *code = (uint16_t)BKP->DR2;
    return 0;
}
```

 

**三个容易忽略的点** ：①备份寄存器只有 20 字节，不是给你存日志的，只够存几个错误码和计数器； ②` BKP ` 的 ` DRx ` 是  **16 位** 寄存器，用 CMSIS 结构体访问时类型是 32 位， 读回来记得自己截断；③"复位前写"这个动作本身要足够早、足够短—— 真到了硬件异常（HardFault）里，你未必还有机会完整地走完这三步。

 

error.h — 一套统一的错误处理基础设施 C

 

```text
#ifndef ERROR_H
#define ERROR_H

#include <stdint.h>
#include "log.h"        /* ERR_CHECK / ASSERT 里要用 log_error */

/* ============================================================
   统一错误码设计
   ------------------------------------------------------------
   高位划分模块（便于快速定位来源），低位是具体错误。
   这样一眼就能看出"是哪个模块出的问题"。
   ============================================================ */

#define ERR_MODULE_SHIFT    16
#define ERR_MODULE_MASK     0xFF0000UL
#define ERR_CODE_MASK       0x00FFFFUL

#define ERR_MAKE(module, code)  ((((uint32_t)(module)) << ERR_MODULE_SHIFT) | \
                                 ((uint32_t)(code) & ERR_CODE_MASK))
#define ERR_MODULE(err)         (((err) & ERR_MODULE_MASK) >> ERR_MODULE_SHIFT)
#define ERR_CODE(err)           ((err) & ERR_CODE_MASK)

#define ERR_MODULE_COMMON   0x01
#define ERR_MODULE_SENSOR   0x02
#define ERR_MODULE_UART     0x03
#define ERR_MODULE_FLASH    0x04
#define ERR_MODULE_NET      0x05

typedef uint32_t err_t;

#define ERR_NONE                ERR_MAKE(ERR_MODULE_COMMON, 0x0000)
#define ERR_INVALID_ARG         ERR_MAKE(ERR_MODULE_COMMON, 0x0001)
#define ERR_NULL_PTR            ERR_MAKE(ERR_MODULE_COMMON, 0x0002)
#define ERR_NOT_INIT            ERR_MAKE(ERR_MODULE_COMMON, 0x0003)
#define ERR_NO_MEMORY           ERR_MAKE(ERR_MODULE_COMMON, 0x0004)
#define ERR_TIMEOUT             ERR_MAKE(ERR_MODULE_COMMON, 0x0005)
#define ERR_BUSY                ERR_MAKE(ERR_MODULE_COMMON, 0x0006)
#define ERR_NOT_SUPPORTED       ERR_MAKE(ERR_MODULE_COMMON, 0x0007)
#define ERR_STATE               ERR_MAKE(ERR_MODULE_COMMON, 0x0008)

/* ---- 检查宏：让调用点极致简洁 ---- */
#define ERR_CHECK(expr)                                     \
    do {                                                    \
        err_t __e = (expr);                                 \
        if (__e != ERR_NONE) {                              \
            log_error("%s:%d: %s → 0x%06lX",                \
                      __FILE__, __LINE__, #expr,            \
                      (unsigned long)__e);                  \
            return __e;                                     \
        }                                                   \
    } while (0)

/* 带资源清理的版本（C 里模拟 RAII）*/
#define ERR_CHECK_GOTO(expr, label)                         \
    do {                                                    \
        err_t __e = (expr);                                 \
        if (__e != ERR_NONE) {                              \
            log_error("%s:%d: %s → 0x%06lX",                \
                      __FILE__, __LINE__, #expr,            \
                      (unsigned long)__e);                  \
            goto label;                                     \
        }                                                   \
    } while (0)

/* ---- 断言：只用于检查程序 bug ---- */
#ifdef DEBUG
  #define ASSERT(cond)                                          \
      do {                                                      \
          if (!(cond)) {                                        \
              log_error("ASSERT FAILED: %s at %s:%d",           \
                        #cond, __FILE__, __LINE__);             \
              assert_failed(__FILE__, __LINE__);                \
          }                                                     \
      } while (0)
#else
  #define ASSERT(cond)  ((void)0)
#endif

/* 断言失败的处理：可以在实现里选择死循环、复位、或记录后继续 */
void assert_failed(const char *file, int line);

err_t err_from_module(err_t module, uint16_t code);
const char *err_str(err_t err);

#endif /* ERROR_H */

/* ============================================================
   使用对比
   ============================================================ */

#if 0
/* ✕ 敷衍的写法 */
int read_config(config_t *cfg)
{
    if (!cfg) return -1;                    /* -1 是什么错？调用方不知道 */
    if (flash_read(&cfg->data, sizeof cfg->data) != 0) return -1;
    return 0;
}
/* 调用方只能写：if (read_config(&c)) { 出错了，但不知道为啥 } */

/* ✔ 有信息量的写法 */
err_t config_load(config_t *cfg)
{
    if (!cfg) return ERR_NULL_PTR;

    err_t e = flash_read(&cfg->data, sizeof cfg->data);
    if (e != ERR_NONE) return e;            /* 保留原始错误，让上层看到真正原因 */

    if (cfg->magic != CONFIG_MAGIC) return ERR_MAKE(ERR_MODULE_FLASH, 0x10);
    if (cfg->version > CONFIG_VERSION) return ERR_MAKE(ERR_MODULE_FLASH, 0x11);

    return ERR_NONE;
}

/* 调用方可以用 ERR_CHECK 链式传播：*/
err_t app_start(void)
{
    ERR_CHECK(config_load(&g_cfg));
    ERR_CHECK(sensor_init(&g_sensor));
    ERR_CHECK(uart_open(&g_uart, g_cfg.baud));
    return ERR_NONE;
}
/* 任何一步失败，会自动打印 "文件:行号: 出错表达式 → 错误码" 并向上传播 */
#endif
```

 

◆ 为什么嵌入式不照抄 POSIX 的 ` errno `

 

在其他平台待久了，第一反应往往是"用 ` errno ` 啊"—— 成功返回 ` -1 `、把原因塞进全局 ` errno `，再用 ` strerror(errno) ` / ` perror() ` 打印。 这套在嵌入式里 **恰恰是要避开的** ，原因不是"风格老"，而是三个硬伤：

 

 
- **` errno ` 是"每进程一份的全局变量"** 。裸机上没有进程隔离，  **中断或多任务会在你检查 ` errno ` 之前就把它改掉**  —— 你读到的错误可能根本不是这次调用产生的。它不是"线程安全的返回值通道"。
 
- **负错误码要额外约定** ：` -EINVAL `、` -EAGAIN ` 这些宏来自 ` <errno.h> `， 你的函数签名是 ` int `，到底"返回 0 是成功还是返回 0 是长度"要每次查文档。显式错误码枚举没有这个歧义。
 
- **` strerror() ` 会拉进整张字符串表** ，在几 KB 预算的固件里是纯浪费。
 

 

所以本站统一选 **"返回值直接就是错误码"** （模块高 8 位 \+ 低 16 位，见上面的 ` error.h `）： 不依赖任何全局状态、天然可重入、中断里也能安全用。   
  
  **那 ` errno ` 什么时候还能用？** 只在"本来就在宿主 libc 上跑"的那部分（PC 单元测试里调 ` open/read `）， 而且必须是 **单一上下文、拿到就立刻处理** 。 *永远不要把它带进中断服务程序。*  顺带提一句：newlib 的 ` malloc ` 等也会设 ` errno `，但那属于你 **在检查它之后才知道的东西** ， 不能当成应用层的错误通道。

 

○ 光有错误码还不够：把"上下文"和"错误注入"补上

 

错误码解决的是" **是什么错** "，现场还常常需要" **错在哪、当时是什么状态** "。 ` err_str(ERR_NULL_PTR) ` 只会告诉你"NULL pointer" —— 但真正要查的是" **哪一行把它传成 NULL 的、当时重试了几次、外设寄存器是什么值** "。 两种补法： **① 让错误带上上下文** （多一个出参结构体，装地址/寄存器/重试次数）；  **② 在发生点就地记录** （像 ` ERR_CHECK ` 那样自动带上 ` __FILE__ `/` __LINE__ `）。

 

还有一件最少人做、却最能证明"错误处理真的有效"的事： **错误注入测试** 。 在 PC 上用 mock 让 ` flash_read() ` 返回 ` ERR_TIMEOUT `， 看上层 **是不是真的** 走了超时分支、有没有把资源释放干净。 *不能制造出错误的错误处理，等于没写。*

 

```zhizhan-anchor
ch7-5
```



## 7.5 日志系统：现场问题的唯一线索

 

log.h / log.c — 分级日志（编译期可裁剪） C

 

```text
#ifndef LOG_H
#define LOG_H

#include <stdint.h>

/* ============================================================
   五级日志。级别越低越严重。
   编译期通过 LOG_LEVEL 裁剪 —— 量产固件可以完全去掉 DEBUG/TRACE
   ============================================================ */
typedef enum {
    LOG_LVL_NONE  = 0,
    LOG_LVL_ERROR = 1,
    LOG_LVL_WARN  = 2,
    LOG_LVL_INFO  = 3,
    LOG_LVL_DEBUG = 4,
    LOG_LVL_TRACE = 5,
} log_level_t;

#ifndef LOG_LEVEL
  #ifdef DEBUG
    #define LOG_LEVEL  LOG_LVL_DEBUG
  #else
    #define LOG_LEVEL  LOG_LVL_INFO
  #endif
#endif

/* ---- printf 风格的可移植属性守卫 ----
   __attribute__((format(...))) 是 GCC / Clang 的扩展；老 ARMCC 与 IAR 不认它
   （较新的 armclang 认）。少了这个守卫，同一份头文件换个工具链就直接编不过 ——
   而它本只是一个"帮我查格式串"的可选注解，不该成为可移植性的瓶颈。 */
#if defined(__GNUC__) || defined(__clang__)
  #define LOG_PRINTF_LIKE(fmt_idx, arg_idx) __attribute__((format(printf, fmt_idx, arg_idx)))
#else
  #define LOG_PRINTF_LIKE(fmt_idx, arg_idx)   /* IAR / ARMCC 不支持，留空即可 */
#endif

/* ---- 核心输出函数 ---- */
void log_write(log_level_t lvl, const char *file, int line,
               const char *fmt, ...) LOG_PRINTF_LIKE(4, 5);

/* ---- 编译期裁剪：低于当前级别的调用会被完全消除，零开销 ---- */
#define LOG_IMPL(lvl, tag, ...)                                     \
    do {                                                            \
        if ((lvl) <= LOG_LEVEL) {                                   \
            log_write((lvl), __FILE__, __LINE__,                    \
                      "[" tag "] " __VA_ARGS__);                    \
        }                                                           \
    } while (0)

#define log_error(...)  LOG_IMPL(LOG_LVL_ERROR, "E", __VA_ARGS__)
#define log_warn(...)   LOG_IMPL(LOG_LVL_WARN,  "W", __VA_ARGS__)
#define log_info(...)   LOG_IMPL(LOG_LVL_INFO,  "I", __VA_ARGS__)
#define log_debug(...)  LOG_IMPL(LOG_LVL_DEBUG, "D", __VA_ARGS__)
#define log_trace(...)  LOG_IMPL(LOG_LVL_TRACE, "T", __VA_ARGS__)

/* ---- 无级别输出：不受 LOG_LEVEL 编译期裁剪，永远打印 ----
   ⚠ 这个函数是必需的，不是可有可无的便利品。
     所有 log_xxx 宏都会被 LOG_LEVEL 在编译期裁掉 —— 这正是它们零开销的原因，
     但也意味着【发布版里 log_error 可能一行都不剩】。
     而 HardFault 处理、断言失败、启动自检这些地方，
     恰恰是"出了事必须留下痕迹"的时刻，绝不能因为级别配置而消失。
     所以它们必须用一个不参与裁剪的入口。 */
void log_printf(const char *fmt, ...) LOG_PRINTF_LIKE(1, 2);

/* ---- 运行期动态调整级别（调试时不用重编译）---- */
void log_set_level(log_level_t lvl);
log_level_t log_get_level(void);

/* ---- 输出后端注册：串口 / RTT / 内存缓冲 ---- */
typedef void (*log_sink_t)(const char *buf, uint32_t len);
void log_set_sink(log_sink_t sink);

/* ---- 时间戳源注册（与 7.3 的依赖注入同理）----
   ⚠ 它【必须】出现在头文件里。log.c 里定义了实现、头文件里却不声明，
     使用者要么只能"隐式声明"（-Wimplicit-function-declaration 警告，
     C23 起是硬错误），要么根本调不到 —— 这正是本站早期的一处接口残缺。 */
void log_set_tick_source(uint32_t (*fn)(void));

/* ---- 统计（诊断用）---- */
uint32_t log_get_dropped_count(void);

#endif /* LOG_H */

/* ============================================================
   log.c 中的关键实现要点
   ============================================================ */

#if 0
#include "log.h"
#include <stdarg.h>
#include <stdio.h>
#include <string.h>

static log_level_t   s_level   = LOG_LVL_INFO;
static log_sink_t    s_sink    = NULL;
static uint32_t      s_dropped = 0;

/* 时间戳源，可注入（与 7.3 的依赖注入同理）*/
static uint32_t (*s_get_tick)(void) = NULL;
void log_set_tick_source(uint32_t (*fn)(void)) { s_get_tick = fn; }

/* ---- 追加助手：把"已用多长"这件事收口到一个地方 ----
   ⚠ 这是整个日志实现里最容易写错的一行，值得单独成函数。

   坑在于：snprintf / vsnprintf 返回的是【如果缓冲够大会写多少字节】，
   不是"实际写了多少"。所以一旦发生截断，它的返回值会大于缓冲区容量：

       char buf[128];
       int n = vsnprintf(buf, sizeof buf, 很长的fmt, ap);   // ← 缓冲只有 128，它返回 500

   于是 n = 500。接下来无论谁拿 n 去用，都是错的：
       · s_sink(buf, n)            → 从 128 字节的栈上越界读 500 字节，
                                     轻则打出乱码，重则读到别的栈变量并泄露出去；
       · buf[n++] = '\n'           → 直接越界写，踩坏返回地址；
       · snprintf(buf+n, sizeof buf - n, ...)
             → n 是 int、sizeof 是 size_t，n 会被提升成无符号数，
               128 - 500 变成一个极大的正数 —— 长度检查彻底失效。

   解法就是把每一次追加的返回值都经由这个函数"夹"一次。

   注意它只需要"容量、已用、这次返回"三个数，不需要缓冲区本身 ——
   夹长度是纯算术，看得见 buf 反而让人以为它要往里面写东西。 */
static int log_append(int cap, int used, int rc)
{
    if (rc < 0) return used;          /* 格式化失败：长度不前进，别把 used 弄坏 */
    int n = used + rc;
    int limit = cap - 1;              /* 永远留 1 字节给结尾的 '\0' */
    return (n > limit) ? limit : n;   /* 截断时钉死在容量上，绝不越界 */
}

void log_write(log_level_t lvl, const char *file, int line,
               const char *fmt, ...)
{
    if (lvl > s_level) return;

    /* ⚠ 关键设计：日志绝不能阻塞或耗时太久。
       如果输出是阻塞串口，高频日志会拖垮实时性。
       方案：
         ① 写环形缓冲区（见 6.7），由低优先级任务慢慢输出
         ② 用 DMA 发送
         ③ 缓冲区满了就丢弃并计数（s_dropped++）—— 宁可丢日志，不可丢实时性
    */
    char buf[128];
    const int cap = (int)sizeof buf;   /* 128；n 永远不会 ≥ cap，见 log_append */
    int n = 0;

    /* 时间戳（相对启动的毫秒数，比绝对时间更有用）*/
    if (s_get_tick) {
        n = log_append(cap, n,   
                       snprintf(buf + n, (size_t)(cap - n), "[%8lu] ",
                                (unsigned long)s_get_tick()));
    }

    /* 文件名只取 basename，省空间 */
    const char *base = strrchr(file, '/');
    if (!base) base = strrchr(file, '\\');
    base = base ? base + 1 : file;

    n = log_append(cap, n,   
                   snprintf(buf + n, (size_t)(cap - n), "%s:%d: ", base, line));

    va_list ap;
    va_start(ap, fmt);
    n = log_append(cap, n,   
                   vsnprintf(buf + n, (size_t)(cap - n), fmt, ap));
    va_end(ap);

    /* 补换行：只有还剩得下 2 字节 + 结尾 '\0' 时才补 */
    if (n <= cap - 3) { buf[n++] = '\r'; buf[n++] = '\n'; }
    buf[n] = '\0';                    /* 收尾；n ≤ cap-1，这一步一定在界内 */

    if (s_sink) {
        s_sink(buf, (uint32_t)n);     /* n 已被夹在 [0, 127]，绝不会越界读 */
    } else {
        s_dropped++;
    }
}
#endif

/* ============================================================
   日志的几条实战经验

   ① 不要在中断里打日志
      串口输出可能阻塞，会严重影响中断响应。
      中断里只设置标志或写环形缓冲区。

   ② 不要在日志里做浮点格式化
      printf("%f") 会链接进几 KB 的浮点格式化代码（即使有 FPU）。
      用定点数代替：log_info("temp=%ld.%02ld", t/100, t%100);

   ③ 关键路径上不要打日志
      一个 1 kHz 控制循环里每周期打一条日志，
      串口根本来不及输出，缓冲区永远满，还把 CPU 耗在格式化上。

   ④ 用有意义的、可 grep 的格式
      ✕ "error at 5"
      ✔ "sensor_read FAILED: timeout after 100ms, addr=0x40, retry=3"
      现场调试时，你只有串口日志这一个信息来源。

   ⑤ 用编译期开关保留"诊断模式"
      #ifdef DEBUG_VERBOSE
          log_debug("raw regs: CRH=0x%08lX CRL=0x%08lX",
                    GPIOA_CRH, GPIOA_CRL);
      #endif
      平时不编译进去，需要时打开重编一次。
   ============================================================ */
```

 

⚠ 上面那段里藏着一个"只会在注释里犯"的错，值得单独记住

 

在讲 ` log_append ` 的坑时，注释里原本写了这么一行 *示意代码* ：

 

```text
int n = vsnprintf(buf, sizeof buf, 很长的fmt, ap);   /* 返回 500 */
```

 

它只是想说明"返回值是 500"。但这行示意代码里的 ` /* … */ ` 会被预处理器当成  **外面那层大注释的结束标记** ——C 的块注释 **不能嵌套** ， 编译器看到第一个 ` */ ` 就认为注释到此为止。

 

后果：注释后半段的中文说明全被当成 C 代码去解析， 编译器报出一串 ` stray '\343' in program `（八进制 343 是 UTF-8 汉字的第一个字节） 和 ` unknown type name `。  **报错位置和真正的错处隔着二十多行，而且报的全是中文乱码** ——是排查起来最费劲的一类。 （GCC 会在这种地方额外给一条 ` -Wcomment ` 警告，看到 ` "/*" within comment ` 就是这个毛病，别忽略它。）

 

**两条实用规则** ：① 要在注释里写示意代码，用 ` // ` 行注释， 或者干脆把示意代码移出注释块、放在正文里； ② 写完带大段注释的代码，第一件事是 **编一遍** —— 这类错误语法高亮往往看不出来，只有编译器会告诉你。

 

◆ 现场日志的两个必备属性：原子性、以及"最后一次心跳"

 

日志在 PC 上很随意，在嵌入式里有两个必须处理的问题：

 

**① 原子性 —— 日志会被多个上下文同时调用。**  ` log_write ` 是"先格式化到缓冲、再交给 sink 输出"两步。 sink 若是串口（逐字节、慢），主循环和中断的两条日志就会 **交错成乱码** 。 三个做法： **临界区只包住"写入 sink"那一段** （越短越好）；  **中断里不要直接格式化长日志**  —— ` vsnprintf ` 慢且未必可重入， ISR 只把"事件码 \+ 少量参数"塞进一个环形事件队列，交给主循环/低优先级任务去格式化输出； 或改用 RTT（固定长度 memcpy，天然更适合多上下文）。

 

**② 把"最近 N 条"留在 RAM。**  在 RAM 里放一个固定大小的环形日志缓冲（比如 2 KB / 最近 32 条），每条日志同时写它一份。 这样 **即使没有接串口、或者崩溃前串口还没刷完** ， 也能在复位后（或 HardFault 处理器里）把这块缓冲 dump 出来 —— 它和 §8.3 的 HardFault 报告是天然搭档。   
  
  *一句话纪律：中断里打日志有"三不"——不用 ` %f `、不做动态内存、临界区尽量短。*

 

```zhizhan-anchor
ch7-6
```



## 7.6 单元测试：在 PC 上测试嵌入式逻辑

 

这是 **投入产出比最高的工程实践** 。硬件调试一次要几十秒（编译 → 烧录 → 观察）， PC 上跑测试只要几毫秒。同一份业务代码，用两种方式编译：

 

test\_alarm.c — 不依赖任何硬件的单元测试 C

 

```text
/* ============================================================
   测试 7.3 里的 alarm_evaluate —— 纯逻辑，无任何硬件依赖
   编译：gcc -I../Inc test_alarm.c alarm_logic.c temp_svc.c -o test && ./test

   三个头文件的来历：
     alarm_logic.h / temp_svc.h —— 把上面"分层实践"那个大块里
       ④ 应用层、③ 服务层各自的类型与函数声明单独抄进 Inc/ 就是它们。
       分层做对了的直接证据：这个测试只 include 头文件、不 include
       任何 stm32 相关头，就能把整条链路的逻辑跑起来。
     sensor.h —— 6.6 节的传感器抽象层头文件，sensor_err_t 出自那里。
   ============================================================ */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "alarm_logic.h"    /* alarm_evaluate / alarm_level_t / TEMP_*_X100 */
#include "sensor.h"         /* sensor_err_t / SENSOR_OK —— 下面 fake_read_raw 要用 */
#include "temp_svc.h"       /* temp_svc_deps_t / temp_svc_init / temp_svc_poll */

static int g_pass = 0, g_fail = 0;

#define CHECK(cond)                                                 \
    do {                                                            \
        if (cond) { g_pass++; }                                     \
        else {                                                      \
            g_fail++;                                               \
            printf("  ✕ FAIL %s:%d: %s\n", __FILE__, __LINE__, #cond); \
        }                                                           \
    } while (0)

/* ---- 测试 1：正常升温路径 ---- */
static void test_heating(void)
{
    printf("test_heating\n");
    alarm_level_t l = ALARM_NORMAL;

    l = alarm_evaluate(1000, l); CHECK(l == ALARM_NORMAL);   /* 10℃ */
    l = alarm_evaluate(2500, l); CHECK(l == ALARM_NORMAL);   /* 25℃ */
    l = alarm_evaluate(3000, l); CHECK(l == ALARM_WARNING);  /* 30℃ 恰好触发 */
    l = alarm_evaluate(4500, l); CHECK(l == ALARM_CRITICAL); /* 45℃ */
}

/* ---- 测试 2：回差（滞回）行为 —— 最容易出错的地方 ---- */
static void test_hysteresis(void)
{
    printf("test_hysteresis\n");

    /* 从 WARNING 降回 NORMAL 需要低于 28℃ */
    CHECK(alarm_evaluate(2950, ALARM_WARNING) == ALARM_WARNING);  /* 29.5℃，还在警告 */
    CHECK(alarm_evaluate(2850, ALARM_WARNING) == ALARM_WARNING);  /* 28.5℃，还在警告 */
    CHECK(alarm_evaluate(2750, ALARM_WARNING) == ALARM_NORMAL);   /* 27.5℃，解除 */

    /* 从 CRITICAL 两级降 */
    CHECK(alarm_evaluate(4400, ALARM_CRITICAL) == ALARM_CRITICAL); /* 44℃，仍严重 */
    CHECK(alarm_evaluate(4200, ALARM_CRITICAL) == ALARM_WARNING);  /* 42℃，降为警告 */
}

/* ---- 测试 3：边界值与异常值 ---- */
static void test_boundary(void)
{
    printf("test_boundary\n");

    /* 极端值不应崩溃或产生未定义行为 */
    CHECK(alarm_evaluate(-4000, ALARM_NORMAL) == ALARM_NORMAL);    /* -40℃ */
    CHECK(alarm_evaluate(12500, ALARM_NORMAL) == ALARM_CRITICAL);  /* 125℃ */
    CHECK(alarm_evaluate(INT32_MIN, ALARM_NORMAL) == ALARM_NORMAL);
    CHECK(alarm_evaluate(INT32_MAX, ALARM_NORMAL) == ALARM_CRITICAL);

    /* 阈值精确边界（off-by-one 最容易错的地方）*/
    CHECK(alarm_evaluate(2999, ALARM_NORMAL) == ALARM_NORMAL);   /* 29.99℃ 不报 */
    CHECK(alarm_evaluate(3000, ALARM_NORMAL) == ALARM_WARNING);  /* 30.00℃ 报 */
    CHECK(alarm_evaluate(4499, ALARM_NORMAL) == ALARM_WARNING);
    CHECK(alarm_evaluate(4500, ALARM_NORMAL) == ALARM_CRITICAL);
}

/* ---- 测试 4：状态机的"无跳变"性质 ---- */
static void test_no_skipping(void)
{
    printf("test_no_skipping\n");

    /* 温度单调上升过程中，级别只能逐级上升，不能跳级 */
    alarm_level_t l = ALARM_NORMAL;
    alarm_level_t prev = ALARM_NORMAL;
    for (int32_t t = 0; t <= 10000; t += 10) {
        l = alarm_evaluate(t, l);
        CHECK(l >= prev);                    /* 单调不减 */
        CHECK(l - prev <= 1);                /* 一次最多升一级 */
        prev = l;
    }
}

/* ============================================================
   模拟时间：测试需要"时间"的逻辑时，注入假时钟
   ============================================================ */
static uint32_t g_fake_tick = 0;
static uint32_t fake_get_tick(void) { return g_fake_tick; }

static uint16_t g_fake_raw_temp = 0;
static sensor_err_t fake_read_raw(uint16_t *t, uint16_t *h)
{
    *t = g_fake_raw_temp;
    *h = 30000;
    return SENSOR_OK;
}

static void test_temp_svc_period(void)
{
    printf("test_temp_svc_period\n");

    temp_svc_deps_t deps = {
        .get_tick = fake_get_tick,
        .read_raw = fake_read_raw,
    };
    temp_svc_init(&deps);

    g_fake_tick = 0;   g_fake_raw_temp = 32768;   /* 约 42.5℃ */
    CHECK(temp_svc_poll() == TEMP_OK);
    CHECK(temp_svc_get_x100() > 4000 && temp_svc_get_x100() < 4500);

    /* 周期未到 → 不应该再读 */
    g_fake_tick = 5000;
    CHECK(temp_svc_poll() == TEMP_NOT_DUE);

    /* 周期到了 → 应该读 */
    g_fake_tick = 10000;
    CHECK(temp_svc_poll() == TEMP_OK);

    /* ★ 关键：整个测试在毫秒级完成，不需要等真实的 10 秒 */
}

int main(void)
{
    printf("=== alarm logic tests ===\n");
    test_heating();
    test_hysteresis();
    test_boundary();
    test_no_skipping();
    test_temp_svc_period();

    printf("\n%d passed, %d failed\n", g_pass, g_fail);
    return g_fail == 0 ? 0 : 1;
}

/* ============================================================
   为什么这个方法极其有效

   ① 反馈速度：PC 上 0.01 秒 vs 硬件上 30 秒 —— 3000 倍差距
   ② 边界覆盖：可以轻松测试 -40℃、INT32_MAX 这些硬件上造不出来的输入
   ③ 回归保护：改了代码跑一遍，立刻知道有没有破坏旧行为
   ④ 支持 TDD：先写测试定义行为，再写实现
   ⑤ 可调试：直接 gdb ./test，断点、单步，比调试硬件舒服得多

   实践建议：
   - 项目一开始就建立这个机制（后期补代价很大）
   - 目标不是"覆盖率 100%"，而是"把容易错的逻辑测到"
     （状态机转移、边界条件、协议解析、算法）
   - 用 CMake 做双 target：一个给 ARM，一个给 PC（见 Module 05）
   ============================================================ */
```

 

◆ 要真用起来，还差三样：框架 / 硬件替身 / 覆盖率

 

上面那个手写 ` CHECK ` 宏适合起步。项目一大，测试本身也要工程化：

 

 
- **框架** ：` Unity `（断言库）\+ ` CMock `（自动生成 mock）\+ ` Ceedling `（Ruby 驱动的构建/运行封装）， 是嵌入式 C 里最常用的一套；` CppUTest ` 也可以。
 
- **硬件替身（mock）两种做法** ： **函数指针注入** （运行时把 ` deps.get_tick ` 换成假的 —— 本页用的就是它，见 §7.3）； 或 **链接期 ` --wrap `** （` -Wl,--wrap=HAL_GetTick `，链接器把所有对它的调用改道到 ` __wrap_HAL_GetTick `）。 前者要求你能改接口，后者适合不能动的第三方库。
 
- **覆盖率** ：宿主 gcc 加 ` --coverage `，跑完用 ` gcov ` / ` lcov ` 出报告。  **别追 100%** ，优先覆盖状态机转移、边界条件、协议解析、算法这些最容易错的地方。 ⚠ 覆盖率量的是" **PC 上那一份** "，不等于目标端覆盖率。
 
- **怎么测"并发/ISR"** ：不要在单元测试里直接调 ISR 函数再断言共享变量 —— 单线程下"恰好对了"说明不了并发下也对。正确做法是 **把 ISR 里的逻辑抽成纯函数单独测** ， 竞态则交给静态分析（§8.4）或 QEMU / 硬件在环。
 
- **接进 CI** ：` make test ` 每次提交自动跑、失败即拦。细节留给《工程化、测试与量产》那一册。
 

 

*测试的成本不在写，而在"让它能自动跑"。一旦接进 CI，它就从"心情好才跑"变成了"每次提交都跑"。*

 

○ 一个真实案例：测试和实现差点互相掩盖

 

§7.3 的 ` temp_svc_poll() ` 用"距上次采样是否满一个周期"来决定要不要读传感器， 周期是 10 秒。` g_last_read_tick ` 是个 ` static ` 变量，上电时被 ` .bss ` 清零 ——  **如果初始化时不管它** ，那么上电后 ` now - 0 ` 在头 10 秒里小于周期， ` poll() ` 会一直返回 ` TEMP_NOT_DUE `： *第一次采样被白白推迟一个周期* 。

 

危险的地方在于：这个缺陷 **很难被常规测试抓到** 。 测试里往往把假时钟从一个"顺手"的初值开始拨， 而只要那个初值让"第一次就到期"，实现里的问题就被 **起始条件盖住** 了 —— 测试全绿，缺陷完好无损。 （上面对 ` temp_svc_init ` 的修复，就是把"上次采样时刻"显式设成"一个周期之前"， 让第一次调用必然到期，从根上消掉这个对 ` .bss ` 初值的依赖。）

 

**能带走的教训** ：写测试时要专门问一句" **上电/初始时刻的行为，我测了吗？** " —— 边界不只是数据的边界，也包括时间的起点。 *测试与实现共享同一个错误假设时，两者会一起变绿。*

 

◆ 本章要点

 

 
- 状态机按规模选型： **≤4 状态用 switch，5-15 用转移表，\>15 或用状态对象/层次状态机** 。
 
- 转移表是 **可执行的规格文档** ：加状态只改表，` dispatch ` 永远 8 行。
 
- 层次状态机让子状态 **继承父状态的事件处理** ——` EV_ESTOP ` 只写一次，所有状态共享。
 
- 保留 ` g_state_names[] ` / ` g_event_names[] ` 名字表，调试时值千金。
 
- C 的面向对象三件套： **不透明指针（封装）\+ 结构体首成员（继承）\+ 函数指针表（多态）** 。
 
- 不透明指针配合 ` magic ` 字段，能检测野指针和重复释放。
 
- 分层铁律： **依赖只能向下** 。判断标准是"应用层能不能在 PC 上单独编译"。
 
- 错误处理： **模块化错误码 \+ ` ERR_CHECK ` 宏传播 \+ ` err_str() ` 可读化** 。不要裸返回 ` -1 `。
 
- 日志： **编译期分级裁剪、不在中断里打、不用 ` %f `、写环形缓冲** 。现场问题只有日志这一个线索。
 
- **在 PC 上对纯逻辑做单元测试** 是投入产出比最高的实践：反馈快 3000 倍，能测边界值，能防回归。

 

◆ 自测 · Module 07（先答再看）

 

 
1. 简答：状态机按规模怎么选型？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"大致： **≤4 个状态用 ` switch `** （直观）； **5–15 个用转移表** （数据驱动、加状态只改表）； **\\>15 或需要进入/退出/历史语义时用状态对象或层次状态机** 。"}
   ```
 
2. 填空：不透明指针（封装）通常靠一个 \_\_\_\_\_\_ 字段来检测野指针和重复释放。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"` magic `。对象创建时写入一个魔数，每次操作前校验；` destroy ` 后把魔数改掉（或清零），就能把\"用了已释放的句柄\"变成一次可检测的失败，而不是静默踩内存。"}
   ```
 
3. 简答：分层的"铁律"是什么？有没有最省事的自动验证办法？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"铁律： **依赖只能向下** （应用层不碰寄存器，驱动层不调业务）。验证： **编译应用层时不给驱动头文件的 ` -I ` 路径** ——只要偷偷 ` #include ` 驱动头就直接编不过；配套还可查 include 图与命名前缀。"}
   ```
 
4. 简答：为什么嵌入式错误处理不照抄 POSIX 的 ` errno `？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"① ` errno ` 是 **每进程一份的全局** ，裸机上中断/多任务会在你读之前改掉它 → 竞态；② 负错误码要额外约定、易歧义；③ ` strerror ` 拉进大字符串表。 **惯例是\"函数返回值直接就是错误码\"** （可重入、中断安全）。"}
   ```
 
5. 找错：7.6 的 ` temp_svc ` 案例里，为什么"测试全绿"却可能放过一个真实缺陷？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"因为 **测试的起始条件和实现依赖同一个错误假设** 。例如 ` g_last_read_tick ` 只靠 ` .bss ` 清零，上电后头一个周期内 ` poll() ` 会一直返回\"未到期\"；而测试若从一个\"刚好到期\"的初值开始，就把这个时序缺陷盖住了。 *教训：专门测\"上电/初始时刻\"的行为，边界不止数据的边界，还有时间的起点。*"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 07 完成？**  把项目里的一个 ` switch ` 状态机改成转移表试试。

 

```zhizhan-assessment
{"id":"course-b01-ch7","criterion":"把一项驱动拆成状态机与硬件适配；注入超时后上层可观测并可恢复。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[C11 N1570 · 对象、类型与语言语义](https://www.open-std.org/jtc1/sc22/wg14/www/docs/n1570.pdf)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b01-guide)
