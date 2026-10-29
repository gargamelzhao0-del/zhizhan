/* host_bus.c —— I2C 客户端读写传输模型（主机可运行）。
 * 读寄存器：先写寄存器地址（1 个消息），再读数据（1 个消息），共 2 次传输。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_bus.c -o host_bus && ./host_bus
 */
#include <stdio.h>
#include <stdint.h>
#include <string.h>
typedef struct { uint8_t regs[8]; int xfers; } i2c_dev_t;
static int i2c_write_read(i2c_dev_t *d, uint8_t reg, uint8_t *out) {
    d->xfers++;                       /* msg1: 写寄存器地址 */
    if (reg >= 8) return -1;
    d->xfers++;                       /* msg2: 读数据 */
    *out = d->regs[reg];
    return 0;
}
static int i2c_write(i2c_dev_t *d, uint8_t reg, uint8_t val) {
    d->xfers++;
    if (reg >= 8) return -1;
    d->regs[reg] = val;
    return 0;
}
int main(void) {
    i2c_dev_t d; memset(&d, 0, sizeof(d)); d.regs[3] = 0x5A;
    int ok = 1; uint8_t v = 0;
    i2c_write(&d, 1, 0x11);
    if (i2c_write_read(&d, 3, &v) != 0 || v != 0x5A) ok = 0;
    printf("读 reg3=0x%02X（期望 0x5A），累计传输=%d（写1+读写2=3）\n", v, d.xfers);
    if (d.xfers != 3) ok = 0;
    printf("越界 reg=9 读: %d（期望 -1）\n", i2c_write_read(&d, 9, &v));
    if (i2c_write_read(&d, 9, &v) != -1) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
