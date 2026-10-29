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
 * 手边没有主机编译器，也没有 qemu，所以**它的运行时行为没有被执行过**。
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
