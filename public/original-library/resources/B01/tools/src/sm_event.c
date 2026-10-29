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
