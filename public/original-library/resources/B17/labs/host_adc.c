/* host_adc.c —— 采集前端：分压/增益与 ADC 量化换算（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_adc.c -o host_adc && ./host_adc
 */
#include <stdio.h>
int main(void) {
    int ok = 1;
    /* 12 位 ADC, Vref=3.3V；输入经 2:1 分压（量程扩到 6.6V） */
    int raw = 2048;                       /* 半量程 */
    float vadc = raw * 3.3f / 4095.0f;
    float vin = vadc * 2.0f;              /* 还原分压 */
    printf("raw=%d → Vadc=%.3fV → Vin=%.3fV（期望 ~3.30）\n", raw, vadc, vin);
    if (vin < 3.25f || vin > 3.35f) ok = 0;
    float lsb = 3.3f/4095.0f;
    printf("LSB=%.3fmV（分辨率）\n", lsb*1000);
    if (lsb <= 0) ok = 0;
    printf("\n%s\n", ok ? "RESULT: PASS" : "RESULT: FAIL");
    return ok ? 0 : 1;
}
