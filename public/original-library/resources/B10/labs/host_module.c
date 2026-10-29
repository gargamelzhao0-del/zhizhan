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
