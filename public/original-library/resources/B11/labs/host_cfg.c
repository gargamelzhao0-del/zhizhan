/* host_cfg.c —— 配置持久化：默认值 + 原子写（tmp→rename）模型（主机可运行）。
 * 直接覆写配置文件在掉电时会损坏；正确做法是写临时文件再 rename（原子替换），失败留旧配置。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_cfg.c -o host_cfg && ./host_cfg
 */
#include <stdio.h>
#include <string.h>
typedef struct { int port; int interval_ms; int valid; } cfg_t;
static const cfg_t DEFAULTS = { 1883, 1000, 1 };
static int load_cfg(const cfg_t *stored, cfg_t *out) {
    if (stored && stored->valid) { *out = *stored; return 0; }   /* 有有效配置 */
    *out = DEFAULTS; return 1;                                  /* 否则默认 */
}
static int atomic_save(cfg_t *slot, const cfg_t *v, int crash) {
    cfg_t tmp = *v; tmp.valid = 1;
    if (crash) return -1;                 /* 掉电：临时文件未提交 */
    *slot = tmp; return 0;
}
int main(void) {
    int ok = 1; cfg_t cur = {0}, out;
    int r = load_cfg(0, &out);
    printf("无配置 → 默认 port=%d interval=%d（r=%d）\n", out.port, out.interval_ms, r);
    if (!(r == 1 && out.port == DEFAULTS.port)) ok = 0;
    cfg_t want = { 8883, 500, 1 };
    if (atomic_save(&cur, &want, 0) != 0) ok = 0;
    load_cfg(&cur, &out);
    printf("保存后加载 port=%d interval=%d\n", out.port, out.interval_ms);
    if (!(out.port == 8883 && out.interval_ms == 500)) ok = 0;
    cfg_t keep = cur;
    atomic_save(&cur, &want, 1);         /* 掉电 */
    printf("掉电保存后配置未损坏: %d\n", cur.port == keep.port);
    if (cur.port != keep.port) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
