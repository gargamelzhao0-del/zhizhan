#include <stddef.h>

typedef struct device device_t;
struct device { const void *ops; void *priv; };
typedef struct { device_t base; unsigned cs_pin; } spi_dev_t;

/* 与 dev_inherit.c 里的 container_of_checked 是同一个宏，
   只少了最前面那个 __extension__ —— 其余一个字都没动。 */
#define container_of_naive(ptr, type, member) ({ \
    const __typeof__(((type *)0)->member) *__mptr = (ptr); \
    (type *)((char *)__mptr - offsetof(type, member)); })

spi_dev_t *spi_naive(device_t *d) { return container_of_naive(d, spi_dev_t, base); }
