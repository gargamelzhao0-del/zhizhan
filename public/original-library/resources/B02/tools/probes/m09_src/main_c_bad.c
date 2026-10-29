/* M09 探针：C 侧试图调用那个"没加 extern "C""的函数。
   结果不是运行期出错，而是链接期直接失败 —— 因为 C++ 侧压根没导出
   一个叫 drv_close_mangled 的符号，它导出的是 _Z17drv_close_mangledm。 */
#include <stdint.h>

uint32_t drv_close_mangled(uint32_t id);   /* C 侧只能写裸名 */

int main(void) {
    return (int)drv_close_mangled(1);
}
