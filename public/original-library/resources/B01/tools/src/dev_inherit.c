/* dev_inherit.c —— §7.2.3「继承」的全部物证。
 *
 * 这一份文件不产出任何要跑的逻辑，它只干两件事：
 *   ① 把"基类必须是派生类的第一个成员"从一句规约变成**编译器必须遵守的断言**；
 *   ② 把 container_of 的算术代价量出来 —— 偏移是 0 时它是 0 条指令。
 *
 * 全是编译期可判的：本机没有主机编译器和 qemu，C 代码只编译不运行，
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
