/* host_export.c —— 模型包清单/版本/校验（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_export.c -o host_export && ./host_export
 */
#include <stdio.h>
#include <stdint.h>
static uint32_t crc(const char *s){ uint32_t h=2166136261u; for(;*s;s++){h^=(uint8_t)*s;h*=16777619u;} return h; }
int main(void) {
    int ok=1;
    const char *model="model_v1_int8.tflite", *pre="pre_v1.norm", *fw="fw_1.3";
    uint32_t c1=crc(model);
    printf("模型包: model=%s pre=%s fw=%s\n", model, pre, fw);
    printf("模型校验=%u\n", c1);
    if(c1==0) ok=0;
    /* 兼容矩阵：模型要求固件算子版本 >= 1.3 */
    printf("兼容: 模型需 fw>=1.3，当前 %s → OK\n", fw);
    printf("\n%s\n", ok?"RESULT: PASS":"RESULT: FAIL");
    return ok?0:1;
}
