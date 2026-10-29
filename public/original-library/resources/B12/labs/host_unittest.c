/* host_unittest.c —— 最小单元测试框架与运行结果（主机可运行）。
 * 测试要能自动判定通过/失败并给出计数；失败要能定位到用例。本程序实现最小断言框架并运行用例。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_unittest.c -o host_unittest && ./host_unittest
 */
#include <stdio.h>
#include <string.h>
static int g_pass = 0, g_fail = 0, g_case_fail = 0;
static void CHECK(const char *name, int cond) { if (cond) g_pass++; else { g_fail++; g_case_fail = 1; printf("  FAIL: %s\n", name); } }
static void run(const char *case_name) { g_case_fail = 0; printf("用例: %s\n", case_name); }
static void end_case(void) { (void)g_case_fail; }
int add(int a, int b) { return a + b; }
int main(void) {
    int ok = 1;
    run("add");
    CHECK("1+2==3", add(1, 2) == 3);
    CHECK("0+0==0", add(0, 0) == 0);
    end_case();
    run("fail-demo");
    CHECK("1+1==3(故意失败)", add(1, 1) == 3);
    end_case();
    printf("通过=%d 失败=%d\n", g_pass, g_fail);
    if (!(g_pass == 2 && g_fail == 1)) ok = 0;   /* 应能捕获故意失败 */
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
