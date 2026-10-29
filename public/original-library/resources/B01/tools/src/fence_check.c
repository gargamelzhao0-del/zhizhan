/* fence_check.c — volatile 到底挡住了什么、又没挡住什么
 *
 * 四组对照，全部拿 -O2 的 ARM 反汇编说话：
 *   组一：静态数组 + volatile 头指针 —— 加不加编译屏障，指令一样吗？
 *   组二：把数据换成外部可见的全局数组，逼编译器必须真的写 —— 顺序变了吗？
 *   组三：屏障真正【救活】过的东西 —— 一个本该被删掉的空循环。
 *   组四：原子栅栏会不会被"M 核是强序的"这个说法省掉？
 *
 * 这一节的结论是实测出来的，不是推理出来的：四组的答案分别是
 * "一样"、"一样"、"14 条 vs 4 条"、"照发 dmb"。
 *
 * ⚠ 上面那句原本写的是 "4 条 vs 15 条"。写它的时候我只在脑子里推了一遍
 *   volatile 循环该多出哪几条，没有真的去数；反汇编出来是 14 vs 4。
 *   这类"顺手估一个数"是本章最想拦住的动作 —— 它看着像结论，
 *   其实是把读者的核对成本转嫁了出去。
 */
#include <stdint.h>

#define RB_SIZE 8u

/* ---------------- 组一：静态缓冲区 + volatile 发布 ----------------
   这一组的重点是：s_buf 在本编译单元里【没有任何读者】，
   于是 8 次写入全部属于"死存储"，编译器有权整个删掉。 */
static uint8_t           s_buf[RB_SIZE];
static volatile uint32_t s_head;

void pub_plain(const uint8_t *src)
{
    for (uint32_t i = 0u; i < RB_SIZE; i++) {
        s_buf[i] = src[i];
    }
    s_head = RB_SIZE;
}

void pub_fenced(const uint8_t *src)
{
    for (uint32_t i = 0u; i < RB_SIZE; i++) {
        s_buf[i] = src[i];
    }
    __asm__ volatile ("" ::: "memory");     /* 编译屏障 */
    s_head = RB_SIZE;
}

/* ---------------- 组二：让数据"必须存在"，再看顺序 ----------------
   g_buf 是外部链接的全局数组，本单元之外可能有人读它，
   编译器就不敢删了 —— 这时才能看清 volatile 发布与数据写入的相对顺序。 */
uint8_t           g_buf[RB_SIZE];
volatile uint32_t g_head;

void pub_visible(const uint8_t *src)
{
    for (uint32_t i = 0u; i < RB_SIZE; i++) {
        g_buf[i] = src[i];
    }
    g_head = RB_SIZE;                       /* 发布 */
}

/* ---------------- 组三：屏障真正派上用场的一处 ----------------
   空循环是标准的"死代码"，-O1 起就会被删。要让循环活下来，
   常见写法是把计数器声明成 volatile —— 代价是它被迫住在栈上。
   编译屏障能在不牺牲寄存器分配的前提下达到同样目的。 */
void wait_volatile(void)
{
    for (volatile uint32_t i = 0u; i < 100u; i++) {
        /* 空 */
    }
}

void wait_fenced(void)
{
    for (uint32_t i = 0u; i < 100u; i++) {
        __asm__ volatile ("" ::: "memory");
    }
}

/* ---------------- 组四：原子栅栏到底发不发指令 ----------------
   Cortex-M 常被说成"强序"，于是很容易推出"__atomic_thread_fence 在 M 核上
   是个空操作"。编译器不这么认为。下面四种内存序各写一个函数，
   让反汇编来判断这个推理对不对 —— 顺便还能看出 M0 和 M3 在这件事上有没有分歧。 */
void fence_seq_cst(void) { __atomic_thread_fence(__ATOMIC_SEQ_CST); }
void fence_acquire(void) { __atomic_thread_fence(__ATOMIC_ACQUIRE); }
void fence_release(void) { __atomic_thread_fence(__ATOMIC_RELEASE); }
void fence_relaxed(void) { __atomic_thread_fence(__ATOMIC_RELAXED); }
