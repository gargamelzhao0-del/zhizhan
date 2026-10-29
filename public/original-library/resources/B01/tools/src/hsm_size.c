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
