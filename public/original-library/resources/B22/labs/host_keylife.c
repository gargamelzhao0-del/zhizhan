/* host_keylife.c —— 密钥生命周期状态机（主机可运行）。
 * 编译运行：gcc -std=c11 -Wall -Wextra -O2 host_keylife.c -o host_keylife && ./host_keylife
 */
#include <stdio.h>
typedef enum { NONE, PROVISIONED, ACTIVE, REVOKED } ks_t;
static ks_t step(ks_t s, int ev) {   /* ev: 0=provision 1=activate 2=rotate 3=revoke */
    if (ev==0 && s==NONE) return PROVISIONED;
    if (ev==1 && s==PROVISIONED) return ACTIVE;
    if (ev==2 && s==ACTIVE) return PROVISIONED;   /* 轮换：换新密钥后再激活 */
    if (ev==3 && (s==ACTIVE||s==PROVISIONED)) return REVOKED;
    return s;
}
int main(void) {
    int ok = 1; ks_t s = NONE;
    s = step(s,0); printf("provision → %d（期望 1）\n", s); if(s!=PROVISIONED) ok=0;
    s = step(s,1); printf("activate  → %d（期望 2）\n", s); if(s!=ACTIVE) ok=0;
    s = step(s,2); printf("rotate    → %d（期望 1）\n", s); if(s!=PROVISIONED) ok=0;
    s = step(s,3); printf("revoke    → %d（期望 3）\n", s); if(s!=REVOKED) ok=0;
    ks_t s2 = step(s,1); printf("撤销后 activate → %d（仍 3，非法转移被拒）\n", s2); if(s2!=REVOKED) ok=0;
    printf("\n%s\n", ok?"RESULT: PASS":"RESULT: FAIL");
    return ok?0:1;
}
