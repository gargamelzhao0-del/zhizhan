/* C 对照：谁释放？编译器不检查 */
#include <stdint.h>
typedef struct { uint8_t data[8]; } buf_t;

uint8_t consume(buf_t b) { return b.data[0]; }

uint8_t use_after_move(void) {
    buf_t b = {{0}};
    uint8_t s = consume(b);      /* b 被按值拷贝传入，原 b 仍然可用 */
    return (uint8_t)(s + b.data[0]);
}
