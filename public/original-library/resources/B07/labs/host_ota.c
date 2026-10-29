/* host_ota.c —— OTA 分块写入 + 校验 + 掉电回滚模型（主机可运行）。
 *
 * 双区模型：A 区运行当前固件，B 区接收新固件。规则：
 *   ① 只有“所有分块写完 + 整镜像 CRC 校验通过”才切换运行区；
 *   ② 中途掉电 → B 区不完整，校验失败 → 继续运行 A 区（回滚）；
 *   ③ 切换后若新固件未“确认”，下次仍可退回 A 区。
 *
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_ota.c -o host_ota && ./host_ota
 */
#include <stdio.h>
#include <stdint.h>
#include <string.h>

#define NCHUNK 4
#define CLEN 8

static uint16_t crc16(const uint8_t *p, int n) {
    uint16_t c = 0xFFFF;
    for (int i = 0; i < n; i++) {
        c ^= p[i];
        for (int b = 0; b < 8; b++) c = (c & 1) ? (uint16_t)((c >> 1) ^ 0xA001) : (uint16_t)(c >> 1);
    }
    return c;
}

/* 返回 1=已切换运行区，0=保持/回滚；*reason 记录原因 */
static int ota_run(const uint8_t img[NCHUNK][CLEN], int fail_after, uint16_t expected_crc,
                   int confirm, const char **reason) {
    uint8_t staging[NCHUNK][CLEN];
    int written = 0;
    memset(staging, 0, sizeof(staging));
    for (int i = 0; i < NCHUNK; i++) {
        if (i == fail_after) { *reason = "掉电：分块未写完"; }
        if (fail_after >= 0 && i >= fail_after) break;
        memcpy(staging[i], img[i], CLEN);
        written++;
    }
    if (written != NCHUNK) return 0;                       /* 不完整 → 回滚 */
    uint16_t c = crc16((const uint8_t *)staging, NCHUNK * CLEN);
    if (c != expected_crc) { *reason = "整镜像 CRC 不匹配"; return 0; }
    if (!confirm) { *reason = "已切换但未确认：下次可退回"; return 1; }
    *reason = "校验通过并确认：切换完成";
    return 1;
}

int main(void) {
    int ok = 1;
    uint8_t img[NCHUNK][CLEN];
    for (int i = 0; i < NCHUNK; i++)
        for (int j = 0; j < CLEN; j++) img[i][j] = (uint8_t)(i * CLEN + j);
    uint16_t good = crc16((const uint8_t *)img, NCHUNK * CLEN);

    const char *r;
    int a = ota_run(img, -1, good, 1, &r);
    printf("正常升级：结果=%s（%s）\n", a ? "切换" : "回滚", r);
    if (a != 1) ok = 0;

    int b = ota_run(img, 2, good, 1, &r);
    printf("第 2 块后掉电：结果=%s（%s）\n", b ? "切换" : "回滚", r);
    if (b != 0) ok = 0;

    int c = ota_run(img, -1, (uint16_t)(good ^ 0xFFFF), 1, &r);
    printf("镜像被篡改：结果=%s（%s）\n", c ? "切换" : "回滚", r);
    if (c != 0) ok = 0;

    int d = ota_run(img, -1, good, 0, &r);
    printf("校验通过但未确认：结果=%s（%s）\n", d ? "切换" : "回滚", r);
    if (d != 1) ok = 0;

    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
