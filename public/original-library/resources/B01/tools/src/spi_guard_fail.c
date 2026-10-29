#include <stdint.h>
#include <stddef.h>

/* 反面教材：把基类从第一个成员挪到第二个，就为了看第 10 行那句话。
   它与 dev_inherit.c 里的部分连字段名都一样，差别只有 base 的位置 ——
   而这一处差别，编译器【本来完全可以不吭声】。 */
typedef struct { const void *ops; void *priv; uint8_t inited; } device_t;
typedef struct { uint32_t cs_pin; device_t base; } spi_bad_t;

_Static_assert(offsetof(spi_bad_t, base) == 0, "base must be the first member");
