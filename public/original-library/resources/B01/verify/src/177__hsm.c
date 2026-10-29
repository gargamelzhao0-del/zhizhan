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
