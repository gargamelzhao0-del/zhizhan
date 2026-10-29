/* M09 探针：C 侧调用上面那个 C++ 驱动。
   注意这里用的是普通 C 声明 —— 能链上的唯一原因是 C++ 侧写了 extern "C"。 */
#include <stdint.h>

uint32_t drv_open(uint32_t id);          /* 与 C++ 侧的 extern "C" 版本对上 */

volatile uint32_t g_result;

int main(void) {
    g_result = drv_open(41);
    return (int)g_result;
}
