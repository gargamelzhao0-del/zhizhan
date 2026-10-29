#include "common/sample.h"
#include <stdio.h>
#include <string.h>
int main(void) {
    Sample s={0}; int ok=1;
    ok &= sample_make(&s,1,10,0) && s.mv==0;
    ok &= sample_make(&s,2,20,2048) && s.mv==1650;
    ok &= sample_make(&s,3,30,4095) && s.mv==3300;
    Sample old=s;
    ok &= !sample_make(&s,4,40,4096) && memcmp(&s,&old,sizeof s)==0;
    ok &= !sample_make(NULL,0,0,0);
    ok &= sample_make(&s,UINT32_MAX,UINT32_MAX,1) && s.mv==1;
    puts(ok ? "sample contract: PASS" : "sample contract: FAIL"); return !ok;
}
