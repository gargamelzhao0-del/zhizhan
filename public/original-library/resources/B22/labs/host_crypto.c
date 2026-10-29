/* host_crypto.c —— 带密钥简化哈希流程模型（非标准 HMAC，无安全强度声明）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_crypto.c -o host_crypto && ./host_crypto
 */
#include <stdio.h>
#include <stdint.h>
static uint32_t h(const uint8_t *p,int n,uint32_t seed){ uint32_t x=seed^0x811c9dc5u; for(int i=0;i<n;i++){x^=p[i];x*=16777619u;} return x; }
static uint32_t mac(uint32_t key,const uint8_t *m,int n){ uint32_t in=h(m,n,key); uint8_t b[4]={(uint8_t)in,(uint8_t)(in>>8),(uint8_t)(in>>16),(uint8_t)(in>>24)}; return h(b,4,key); }
int main(void) {
    int ok = 1; uint32_t k=0x12345678u;
    const uint8_t m[]="firmware";
    uint32_t a=mac(k,m,8), b=mac(k,m,8);
    printf("MAC 可复现=%d\n", a==b); if(a!=b) ok=0;
    uint8_t bad[]="firmwarE";
    printf("篡改检测=%d（期望 1）\n", mac(k,bad,8)!=a); if(mac(k,bad,8)==a) ok=0;
    printf("错密钥拒绝=%d（期望 1）\n", mac(0x87654321u,m,8)!=a); if(mac(0x87654321u,m,8)==a) ok=0;
    printf("\n%s\n", ok?"RESULT: PASS":"RESULT: FAIL");
    return ok?0:1;
}
