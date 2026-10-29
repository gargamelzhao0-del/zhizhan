/* Single CPU tick model: D=T, fixed C, no ISR/blocking/switch cost.
 * Response includes waiting: completion - release. Lower prio wins.
 * At missed deadline explicitly DROP unfinished job and release the next.
 * This models a declared overload policy, not an RTOS implementation. */
#include <stdio.h>
#include <string.h>
typedef struct {
    int prio, period, cost;
    int release, remaining, released, finished, missed, ticks, max_response;
} Task;
static int simulate(Task *a, int n, int horizon, char *trace) {
    int rr=0, previous=-1, preemptions=0;
    for (int t=0; t<horizon; ++t) {
        for (int i=0; i<n; ++i) if (t % a[i].period == 0) {
            if (a[i].remaining) ++a[i].missed;
            a[i].release=t; a[i].remaining=a[i].cost; ++a[i].released;
        }
        int pick=-1;
        for (int k=0; k<n; ++k) {
            int i=(rr+k)%n;
            if (a[i].remaining && (pick<0 || a[i].prio<a[pick].prio)) pick=i;
        }
        if (pick<0) { if(trace) trace[t]='.'; previous=-1; continue; }
        if (previous>=0 && previous!=pick && a[previous].remaining &&
            a[pick].prio<a[previous].prio) ++preemptions;
        if(trace) trace[t]=(char)('a'+pick);
        --a[pick].remaining; ++a[pick].ticks;
        if (!a[pick].remaining) {
            int response=t+1-a[pick].release;
            if(response>a[pick].max_response) a[pick].max_response=response;
            ++a[pick].finished;
        }
        rr=(pick+1)%n; /* one tick slice, not run-to-completion */
        previous=a[pick].remaining ? pick : -1;
    }
    /* Fixtures end on a common deadline. */
    for(int i=0;i<n;++i) if(a[i].remaining) ++a[i].missed;
    if(trace) trace[horizon]='\0';
    return preemptions;
}
static int check(int condition,const char *name) {
    if(!condition) fprintf(stderr,"FAIL: %s\n",name);
    return condition;
}
int main(void) {
    Task normal[3]={{.prio=1,.period=10,.cost=3},
                    {.prio=2,.period=20,.cost=5},
                    {.prio=3,.period=40,.cost=8}};
    char trace[641]; int preemptions=simulate(normal,3,640,trace),ok=1;
    /* Independent RTA: R_i=C_i+sum ceil(R_i/T_j)*C_j.
     * A=3; B=5+3=8; C: 8 ->16 ->19 ->19. */
    const int response[]={3,8,19},jobs[]={64,32,16};
    for(int i=0;i<3;++i) {
        printf("%c response=%d completed=%d missed=%d\n",'A'+i,
               normal[i].max_response,normal[i].finished,normal[i].missed);
        ok &= check(normal[i].max_response==response[i],"independent RTA");
        ok &= check(normal[i].finished==jobs[i] && !normal[i].missed,"all jobs");
    }
    printf("trace[0:40]=%.40s\npreemptions=%d\n",trace,preemptions);
    ok &= check(preemptions==16,"preemption of unfinished job");
    ok &= check(normal[0].ticks+normal[1].ticks+normal[2].ticks==480,"CPU accounting");
    Task equal[2]={{.prio=1,.period=10,.cost=5},{.prio=1,.period=10,.cost=5}};
    char rr[11]; simulate(equal,2,10,rr);
    ok &= check(strcmp(rr,"ababababab")==0,"one-tick round robin");
    printf("round_robin=%s\n",rr);
    Task over[3]={{.prio=1,.period=10,.cost=9},{.prio=2,.period=20,.cost=5},
                  {.prio=3,.period=40,.cost=8}};
    simulate(over,3,40,NULL);
    ok &= check(over[0].finished==4 && over[1].missed==2 && over[2].missed==1,"overload");
    for(int i=0;i<3;++i)
        ok &= check(over[i].released==over[i].finished+over[i].missed,"no silent loss");
    printf("overload_misses=%d/%d/%d (drop at deadline)\n",over[0].missed,over[1].missed,over[2].missed);
    puts(ok ? "RESULT: PASS" : "RESULT: FAIL"); return !ok;
}
