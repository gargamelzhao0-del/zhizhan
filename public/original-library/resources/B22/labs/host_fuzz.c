/* Length-bounded parser exercise, not a claim to have fuzzed every input.
 * Grammar: SET:[0-9]{1,3}, numeric value 0..100; leading zeroes allowed.
 * Caller owns a readable n-byte input and writable out. Failure preserves out. */
#include <stdio.h>
#include <string.h>
#include <stddef.h>
static int parse(const char *s,size_t n,int *out) {
    if(!s || !out || n<5 || n>7 || memcmp(s,"SET:",4)!=0) return -1;
    int v=0;
    for(size_t i=4;i<n;++i) {
        if(s[i]<'0' || s[i]>'9') return -1;
        v=v*10+(s[i]-'0');
    }
    if(v>100) return -1;
    *out=v;return 0;
}
int main(void) {
    int ok=1,v;char text[16];
    for(int expected=0;expected<=100;++expected) {
        int n=snprintf(text,sizeof text,"SET:%d",expected);
        v=-7;ok &= parse(text,(size_t)n,&v)==0 && v==expected;
    }
    const char *bad[]={"BAD:50","SET:","SET:abc","SET:101","SET:-1","SET:1x","SET:99999999",":50","SET:1:2"};
    for(size_t i=0;i<sizeof bad/sizeof bad[0];++i) {
        v=-7;ok &= parse(bad[i],strlen(bad[i]),&v)==-1 && v==-7;
    }
    const char raw[]={'S','E','T',':','5','0'};
    ok &= parse(raw,sizeof raw,&v)==0 && v==50;
    const char embedded_zero[]={'S','E','T',':','5',0,'0'};
    v=-7;ok &= parse(embedded_zero,sizeof embedded_zero,&v)==-1 && v==-7;
    ok &= parse(NULL,1,&v)==-1 && parse("SET:1",5,NULL)==-1;
    puts("101 valid values; invalid prefix/range/length/bytes; non-NUL buffer checked");
    puts(ok ? "RESULT: PASS (declared corpus only)" : "RESULT: FAIL");return !ok;
}
