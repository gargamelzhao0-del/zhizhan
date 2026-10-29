"""P02 fixed-priority response analysis and bounded offline backlog.
Assumptions: independent preemptible periodic tasks, single core, D<=T, no blocking/jitter/ISR cost.
This is analysis, not an RTOS scheduler or proof for a target with omitted interference.
"""
from collections import deque
from math import ceil,isfinite
def response_times(tasks):
    results=[]
    for i,(period,cost,deadline) in enumerate(tasks):
        if not all(isfinite(x) and x>0 for x in (period,cost,deadline)) or deadline>period:raise ValueError("contract")
        r=cost
        for _ in range(1000):
            candidate=cost+sum(ceil(r/t)*c for t,c,_ in tasks[:i])
            if candidate>deadline:results.append(None);break
            if candidate==r:results.append(r);break
            r=candidate
        else:raise RuntimeError("no convergence")
    return results
class Backlog:
    def __init__(self,capacity):
        if capacity<=0:raise ValueError("capacity")
        self.capacity=capacity;self.items=deque();self.dropped=0
    def append(self,value):
        if len(self.items)==self.capacity:self.dropped+=1;return False
        self.items.append(value);return True
    def acknowledge(self):return self.items.popleft()
def self_test():
    assert response_times([(10,2,10),(20,5,20)])==[2,7]
    assert response_times([(10,8,10),(20,5,20)])==[8,None]
    q=Backlog(2);assert q.append(0) and q.append(1) and not q.append(2)
    assert q.acknowledge()==0 and q.acknowledge()==1 and q.dropped==1
    print("P02 response=2/7ms; overload rejected; bounded backlog/drop/FIFO: RESULT: PASS")
if __name__=="__main__":self_test()
