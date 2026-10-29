# frame_codec.py —— 组帧 + 流式解帧（处理半包/粘包）
import struct

SYNC = b'\xAA\x55'

def encode(payload: bytes) -> bytes:
    n = len(payload)
    body = bytes([n]) + payload
    chk = 0
    for b in body:
        chk ^= b
    return SYNC + body + bytes([chk])

class FrameParser:
    """把字节流按帧切出来；不完整就留在缓冲里等下一次 feed。"""
    def __init__(self):
        self.buf = bytearray()

    def feed(self, data: bytes):
        self.buf += data
        out = []
        while True:
            i = self.buf.find(SYNC)
            if i < 0 or len(self.buf) < i + 3:
                break
            if i > 0:
                del self.buf[:i]
            n = self.buf[2]
            total = 2 + 1 + n + 1
            if len(self.buf) < total:
                break                       # 半包：等更多数据
            frame = bytes(self.buf[:total])
            chk = 0
            for b in frame[2:-1]:
                chk ^= b
            out.append((frame[3:-1], chk == frame[-1]))
            del self.buf[:total]
        return out

if __name__ == "__main__":
    f1 = encode(b"HELLO")
    f2 = encode(b"OK")
    print("frame1 hex =", f1.hex())
    p = FrameParser()
    print("feed half(3B) ->", p.feed(f1[:3]))
    print("feed rest     ->", p.feed(f1[3:]))
    print("feed two(glue)->", p.feed(f2 + f2))
