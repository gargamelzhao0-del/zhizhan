"""Replay identical fixed-point inputs: schema and units are explicit; no hardware claim."""
import math
def q15_mul(a,b):
    if not(-32768<=a<=32767 and -32768<=b<=32767):raise ValueError("Q15 range")
    product=a*b
    value=abs(product)//32768
    if product<0:value=-value  # match C11 integer division toward zero
    return max(-32768,min(32767,value))
def main():
    cases=[(0,32767,0),(16384,16384,8192),(-32768,-32768,32767),(-1,16384,0)]
    for a,b,expected in cases:assert q15_mul(a,b)==expected
    try:q15_mul(32768,0)
    except ValueError:pass
    else:raise AssertionError("out-of-range input")
    print("Q15/C-truncation/saturation/replay: RESULT: PASS")
if __name__=="__main__":main()
