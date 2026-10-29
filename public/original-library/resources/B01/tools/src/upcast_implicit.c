#include <stdint.h>

typedef struct device device_t;
struct device { const void *ops; void *priv; uint8_t inited; };
typedef struct { device_t base; uint32_t cs_pin; } spi_dev_t;

/* ① 不加转换：C 标准说这是约束违反（6.5.16.1 指针赋值），
   编译器【默认就必须报】—— 不依赖 -Wall，因为它属于"必须诊断"那一类。
   但它只是一条 warning：rc 仍然是 0，目标文件照样生成。
   （这一条是实测的：加上 -Wall -Wextra -Wpedantic 也是同一句，不多不少。） */
device_t *upcast_implicit(spi_dev_t *s) { return s; }

/* ② 加上那个转换：告警消失。
   在 base 位于偏移 0 的结构上，这个转换是【多余但正确】的 ——
   编译器替我们算出来的地址本来就等于对象地址，转与不转是同一个数。
   在 base 不在偏移 0 的结构上（见 dev_inherit.c 里的 spi_bad_t），
   同一个转换会顺手把上面那条告警一起咽下去，而这次算出来的地址是错的。
   所以："加上转换"不是风格，它是唯一让编译器闭嘴的办法 ——
   也正因为如此，必须另有一条 _Static_assert 在布局上把着。 */
device_t *upcast_explicit(spi_dev_t *s) { return (device_t *)s; }
