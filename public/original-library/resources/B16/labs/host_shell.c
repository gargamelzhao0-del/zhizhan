/* Pipeline status model; does not execute Bash or simulate all -e exceptions.
 * Default: final status. pipefail: rightmost nonzero status. */
#include <stdio.h>
#include <stddef.h>
static int pipeline_status(const int *codes,size_t n,int pipefail) {
    int result=0;
    for(size_t i=0;i<n;++i) if(!pipefail || codes[i]!=0) result=codes[i];
    return result;
}
int main(void) {
    const int a[]={0,1,0},b[]={7,2,0};
    int normal=pipeline_status(a,3,0),guarded=pipeline_status(a,3,1);
    int rightmost=pipeline_status(b,3,1);
    printf("default=%d pipefail=%d rightmost_failure=%d\n",normal,guarded,rightmost);
    int ok=normal==0 && guarded==1 && rightmost==2;
    puts(ok ? "RESULT: PASS" : "RESULT: FAIL"); return !ok;
}
