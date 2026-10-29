/* host_contract.c —— 数据契约：单位/量程/采样率校验 + 确定性回放（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_contract.c -o host_contract && ./host_contract
 */
#include <stdio.h>
#include <stdint.h>

/* 契约：字段、单位、量程 [lo,hi]、采样率 fs(Hz) —— 训练与现场必须一致 */
typedef struct { const char *field, *unit; double lo, hi, fs; } contract_t;
static contract_t C = { "accel_x", "m/s^2", -16.0, 16.0, 100.0 };

static int valid(double v) { return v >= C.lo && v <= C.hi; }

/* 确定性回放：对量化后的样本做 FNV-1a，同批数据必须得到同一哈希 */
static uint32_t replay_hash(const double *x, int n) {
    uint32_t h = 2166136261u;
    for (int i = 0; i < n; i++) {
        long q = (long)(x[i] * 1000.0 + (x[i] < 0 ? -0.5 : 0.5));
        uint8_t *p = (uint8_t *)&q;
        for (unsigned k = 0; k < sizeof(long); k++) { h ^= p[k]; h *= 16777619u; }
    }
    return h;
}

int main(void) {
    int ok = 1;
    double batch_a[] = {0.0, 1.5, -2.25, 3.0, 16.0, -16.0};
    double batch_b[] = {0.0, 1.5, -2.25, 3.0, 16.0, -16.0};   /* 同批数据 */
    double bad[]     = {0.0, 20.0};                            /* 一个超量程样本 */

    printf("契约: %s 单位=%s 量程=[%.0f,%.0f] fs=%.0fHz\n",
           C.field, C.unit, C.lo, C.hi, C.fs);
    printf("采样间隔 dt=%.4fs（=1/fs）\n", 1.0 / C.fs);

    /* 量程校验：越界样本必须被标记为脏数据（不得入训） */
    int bad_n = 0;
    for (unsigned i = 0; i < sizeof(bad)/sizeof(bad[0]); i++) if (!valid(bad[i])) bad_n++;
    printf("越界样本数=%d（期望 1）\n", bad_n);
    if (bad_n != 1) ok = 0;

    /* 确定性回放：同批数据 → 同一哈希，实验可复现 */
    uint32_t h1 = replay_hash(batch_a, 6), h2 = replay_hash(batch_b, 6);
    printf("回放哈希 a=%u b=%u（同批→同哈希）\n", h1, h2);
    if (h1 != h2 || h1 == 0) ok = 0;

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
