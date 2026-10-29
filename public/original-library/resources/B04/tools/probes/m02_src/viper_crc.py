"""CPU 上可跑的 CRC8 演示（MicroPython 侧可用 @micropython.viper 加速同一算法）。"""
def crc8(data, poly=0x07, init=0x00):
    crc = init
    for b in data:
        crc ^= b
        for _ in range(8):
            crc = ((crc << 1) ^ poly) & 0xFF if (crc & 0x80) else (crc << 1) & 0xFF
    return crc

print(hex(crc8(b"123456789")))
