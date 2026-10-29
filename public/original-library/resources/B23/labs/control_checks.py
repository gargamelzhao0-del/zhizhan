"""一阶响应、梯形轨迹和时间积分的独立边界验收；Python 3.11+。"""
import math

def thermal(t, tau=20.0):
    if t < 0 or tau <= 0: raise ValueError("invalid time")
    return 55.0 - 30.0 * math.exp(-t/tau)

def position(t, distance, vmax, accel):
    if not all(math.isfinite(x) for x in (t,distance,vmax,accel)) or distance<0 or vmax<=0 or accel<=0:
        raise ValueError("invalid trajectory")
    peak=min(vmax,math.sqrt(distance*accel))
    ta=peak/accel
    tc=0.0 if peak==0 else max(0.0,(distance-peak*peak/accel)/peak)
    total=2*ta+tc
    t=max(0.0,min(t,total))
    if t<=ta: x=0.5*accel*t*t
    elif t<=ta+tc: x=0.5*accel*ta*ta+peak*(t-ta)
    else: x=distance-0.5*accel*(total-t)**2
    return x,total,peak

def iae(times, errors):
    if len(times)!=len(errors) or len(times)<2: raise ValueError("shape")
    if not all(math.isfinite(x) for x in times+errors): raise ValueError("nonfinite")
    if any(b<=a for a,b in zip(times,times[1:])): raise ValueError("time order")
    return sum((b-a)*(abs(e)+abs(f))/2 for a,b,e,f in zip(times,times[1:],errors,errors[1:]))

def main():
    T=25.0
    for _ in range(200): T+=(1-math.exp(-0.1/20))*(55-T)
    assert abs(T-thermal(20))<1e-10 and round(T,2)==43.96
    assert math.isclose(thermal(20),thermal(40,40))
    for distance in (0,1,10):
        x,total,peak=position(0,distance,2,1)
        assert x==0 and peak<=2
        assert math.isclose(position(total,distance,2,1)[0],distance)
        values=[position(total*i/100,distance,2,1)[0] for i in range(101)]
        assert all(b>=a for a,b in zip(values,values[1:]))
    assert iae([0,1,2],[1,1,1])==2
    assert iae([0,0.5,1,1.5,2],[1]*5)==2
    try: iae([1,0],[1,1])
    except ValueError: pass
    else: raise AssertionError("unordered time accepted")
    print("T(20)=43.96 C; trajectory endpoint/limit/order PASS; IAE=2 C*s; RESULT: PASS")

if __name__=="__main__": main()
