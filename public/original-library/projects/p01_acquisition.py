"""P01 reference chain: frames -> bounded parser -> calibrated data -> replay.
Transport input is synthetic; physical ADC/DMA, wiring and timing require target tests.
"""
import struct
def crc16(data):
    crc=0xffff
    for b in data:
        crc^=b<<8
        for _ in range(8):crc=((crc<<1)^0x1021 if crc&0x8000 else crc<<1)&0xffff
    return crc
def encode(seq, raw):
    if not 0<=seq<=65535 or not 0<=raw<=4095:raise ValueError("range")
    body=struct.pack("<HH",seq,raw)
    return b"\xa5\x5a"+body+struct.pack("<H",crc16(body))
class Parser:
    def __init__(self):self.pending=bytearray();self.bad=0
    def feed(self,chunk):
        result=[]
        for byte in chunk:
            self.pending.append(byte)
            while len(self.pending)>=2 and self.pending[:2]!=b"\xa5\x5a":del self.pending[0]
            if len(self.pending)==8:
                data=self.pending[2:6]
                if crc16(data)==struct.unpack("<H",self.pending[6:8])[0]:
                    seq,raw=struct.unpack("<HH",data)
                    if raw<=4095:result.append((seq,raw,raw*3.3/4095))
                    else:self.bad+=1
                    self.pending.clear()
                else:self.bad+=1;del self.pending[0]
        return result
def self_test():
    assert crc16(b"123456789")==0x29b1
    stream=b"noise"+encode(0,0)+encode(1,2048)+encode(2,4095)
    for width in (1,3,8,100):
        p=Parser();out=[]
        for i in range(0,len(stream),width):out+=p.feed(stream[i:i+width]);assert len(p.pending)<=7
        assert [r[:2] for r in out]==[(0,0),(1,2048),(2,4095)]
        assert out[-1][2]==3.3
    bad=bytearray(encode(3,1));bad[3]^=1
    p=Parser();assert p.feed(bad+encode(4,2))[0][0]==4 and p.bad==1
    print("P01 fragmentation/noise/CRC/recovery/calibration: RESULT: PASS")
if __name__=="__main__":self_test()
