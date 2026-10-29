# 串口与协议工具链

```zhizhan-anchor
m03
```



串口是嵌入式开发里最常用的"观察窗口"。这一节用 ` pyserial ` 把"手动点串口助手"升级成 **可复用的自动化测试脚本** ： 组帧/解帧、半包粘包、超时重传——每一样都在本机真实运行。

 

> ◷ 约 65 分钟 · ◈ pyserial · 帧解析 · 超时重传 · ⚑ 真实运行

 

```zhizhan-anchor
m03-1
```



## 3.1 最小串口收发

 

` pyserial ` 的入口极小：` Serial(port, baudrate, timeout) `。关键是理解两个方法： ` readline() `（读到换行，适合行式调试输出）与 ` read(n) `（读固定字节，适合二进制帧）。  **务必设 timeout** ，否则读不到数据会永久阻塞。

 

serial\_io.py — 上位机收发（行式命令） Python

 

```text
# serial_io.py —— 打开串口、发命令、读回显
import serial, time

def open_port(port="COM5", baud=115200):
    return serial.Serial(port, baud, timeout=1)     # 关键：timeout 避免永久阻塞

def cmd(ser, text):
    ser.write((text + "\n").encode())
    ser.flush()
    time.sleep(0.1)
    return ser.readline().decode(errors="replace").strip()

if __name__ == "__main__":
    with open_port() as ser:
        print("版本:", cmd(ser, "version"))
        print("状态:", cmd(ser, "status"))
```

 

⚠ 上位机脚本最容易踩的三个坑

 

 
- **不设 timeout** ：设备没回就卡死；至少设 1s，并据此判断"超时"。
 
- **把"写"当"收到"** ：` write ` 只表示进入发送缓冲，回包要另读。
 
- **换行差异** ：设备可能发 ` \r\n `，读回后统一 ` strip() `。

 

```zhizhan-anchor
m03-2
```



## 3.2 帧结构与解析：半包与粘包

 

二进制协议必须自己定帧。 **绝不假设"一次 read = 一帧"** ——串口数据可能被拆成半包，也可能几帧粘在一起。 正确做法：维护一个缓冲，` feed ` 新数据、循环尝试"拼出一整帧"；解析时可用 ` memoryview ` 在缓冲上零拷贝按偏移读取。

 

**FIG 3.1**  帧格式与"半包/粘包"处理：数据到齐才消费一帧

 

```zhizhan-figure
<svg viewBox="0 0 660 220" role="img" aria-label="帧结构与流式解析">
          <text x="16" y="30" class="sv-lbl-hi">帧格式：SYNC(2) · LEN(1) · PAYLOAD(N) · CHK(1)</text>
          <rect x="30" y="44" width="60" height="26" rx="4" class="sv-cyn-s"></rect><text x="60" y="61" class="sv-lbl-dim" text-anchor="middle">AA55</text>
          <rect x="90" y="44" width="50" height="26" rx="4" class="sv-box"></rect><text x="115" y="61" class="sv-lbl-dim" text-anchor="middle">LEN</text>
          <rect x="140" y="44" width="300" height="26" rx="4" class="sv-grn-s"></rect><text x="290" y="61" class="sv-lbl-dim" text-anchor="middle">PAYLOAD …</text>
          <rect x="440" y="44" width="50" height="26" rx="4" class="sv-amb-s"></rect><text x="465" y="61" class="sv-lbl-dim" text-anchor="middle">CHK</text>
          <line x1="16" y1="92" x2="644" y2="92" class="sv-dash"></line>
          <text x="16" y="116" class="sv-lbl-dim">第 1 次 feed：只到 LEN（半包）→ 留在缓冲</text>
          <rect x="30" y="124" width="160" height="26" rx="4" class="sv-red-s"></rect><text x="110" y="141" class="sv-lbl-dim" text-anchor="middle">AA55 LEN（不完整）</text>
          <text x="16" y="176" class="sv-lbl-dim">第 2 次 feed：补齐 + 后面又粘了 2 帧</text>
          <rect x="30" y="184" width="300" height="26" rx="4" class="sv-grn-s"></rect><text x="180" y="201" class="sv-lbl-dim" text-anchor="middle">一帧完整 + 又一整帧 → 循环各消费一帧</text>
        </svg>
```

 

解析器的核心循环：找 ` SYNC ` → 读 ` LEN ` → 足长才取帧 → 校验 → 消费并继续。 **不足就等下一次 feed** 。下面的脚本本机实测跑过。

 

frame\_codec.py — 组帧 \+ 流式解帧（可跑） Python

 

```text
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
```

 

**bash**  — 复跑：` python tools/probes/m03_src/frame_codec.py `（CPython 3.13）

 

```text
$ python frame_codec.py
frame1 hex = aa550548454c4c4f47
feed half(3B) -> []
feed rest     -> [(b'HELLO', True)]
feed two(glue)-> [(b'OK', True), (b'OK', True)]
# 半包时返回空（不乱解）；补齐后解出 HELLO；两帧粘连时一次解出两帧。
```

 

```zhizhan-anchor
m03-3
```



## 3.3 超时与重传：把"设备没回"变成可测的事

 

reqresp.py — 请求-应答 \+ 超时重传 Python

 

```text
# reqresp.py —— 发一帧、等应答；超时则重传（最多 N 次）
import struct, time

def build(seq: int, payload: bytes) -> bytes:
    body = struct.pack("<BH", seq, len(payload)) + payload
    chk = 0
    for b in body:
        chk ^= b
    return b'\xAA\x55' + body + bytes([chk])

def transact(send, recv, seq, payload, tries=3, timeout=0.5):
    for k in range(tries):
        send(build(seq, payload))
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            frame = recv()                 # 返回 bytes 或 None
            if frame:
                return frame
        # 超时：下一轮重传（seq 不变，便于设备去重）
    raise TimeoutError(f"no reply for seq={seq} after {tries} tries")
```

 

◆ 为什么用 seq 而不是"直接重发"

 

重传可能造成设备 **收到两份** 同一请求。带上 ` seq `，设备端可对重复序号 **去重** （只处理一次、但都回复）， 这样"请求-应答"在网络/串口不可靠时才是[幂等](term:idempotency)的。这与第②册协议编排里"序号与去重"是同一件事。

 

```zhizhan-anchor
m03-4
```



## 3.4 流式解帧：一次喂一个字节

 

```zhizhan-anchor
m03-5
```



## 3.5 把"设备没回"变成可测状态

 

**FIG 3.2**  流的切分：半包与粘包

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="TCP/串口是字节流，需按帧头+长度+CRC 自己切帧；一次读到半条或两条都正常">
          <rect x="30" y="40" width="150" height="46" rx="6" class="sv-box"></rect>
          <text x="105" y="68" class="sv-lbl-hi" text-anchor="middle">字节流 …</text>
          <path d="M180 63 L230 63" class="sv-arrow"></path>
          <rect x="232" y="40" width="180" height="46" rx="6" class="sv-amb-s"></rect>
          <text x="322" y="68" class="sv-lbl-hi" text-anchor="middle">按长度切帧</text>
          <path d="M412 63 L462 63" class="sv-arrow"></path>
          <rect x="464" y="40" width="170" height="46" rx="6" class="sv-grn-s"></rect>
          <text x="549" y="68" class="sv-lbl-hi" text-anchor="middle">完整帧（校验通过）</text>
        </svg>
```

 

状态机逐字节喂入：找帧头 → 读长度 → 收载荷 → 校验 → 投递。

 

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 半包 | 一次读到半条 | 缓冲起来等后续 |
| 粘包 | 一次读到多条 | 循环切出多条 |
| CRC 错 | 误码/错位 | 丢弃并重同步 |
| 无响应 | 设备没回 | 超时重传/报错 |

 

| 重传策略 | 做法 | 风险 |
| --- | --- | --- |
| 固定重试次数 | 超时后重发 N 次 | N 太大拖慢 |
| 指数退避 | 间隔逐次增大 | 低速链路慢 |
| 去重 | 按序号丢弃重复 | 需序号字段 |
| 上限 \+ 报错 | 超界上报失败 | 必须处理 |

 

| 函数 | 职责 | 返回 |
| --- | --- | --- |
| ` feed(bytes) ` | 喂入字节 | 解出的帧列表 |
| ` encode(payload) ` | 组帧 | ` bytes ` |
| ` request(cmd, timeout) ` | 请求-应答 | 应答或超时 |
| ` checksum(frame) ` | 校验 | 是否通过 |

 

| 超时状态 | 含义 | 上层动作 |
| --- | --- | --- |
| ` OK ` | 收到合法应答 | 继续 |
| ` TIMEOUT ` | 超时无应答 | 重试/告警 |
| ` BAD_CRC ` | 帧损坏 | 重试 |
| ` GAVE_UP ` | 超过重试上限 | 上报失败 |

 

◆ 迁移练习

 

给流式解帧器加一个"最大重试 N 次后返回 GAVE\_UP"的请求函数，用超时和坏帧各触发一次。

 

◆ 本章要点

 

 
- ` pyserial ` 入口小，但 **必须设 timeout** ，且分清 ` readline() ` 与 ` read(n) `。
 
- 二进制协议要 **自己定帧** （SYNC/LEN/PAYLOAD/CHK），并处理 **半包/粘包** 。
 
- 流式解析器：维护缓冲、循环取帧、不足就等下一次 feed（本机实测）。
 
- 请求-应答要带 **超时重传** 与 ` seq ` 去重，才是幂等的。
 
- 把"手动点串口助手"变成脚本，是后续自动测试/CI 的基础（M05）。

 

◆ 自测 · Module 03（先答再看）

 

 
1. 判断：` ser.read(10) ` 一定一次返回 10 个字节。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不一定。串口是字节流，` read(n) ` 可能超时返回少于 n 个字节。这正是需要\"缓冲 \\+ 流式解帧\"的原因。"}
   ```
 
2. 简答：为什么不能"一次 ` read ` 就当一帧"？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"因为会出现半包（一帧被拆开）和粘包（多帧连在一起）。必须按帧结构在缓冲里循环切帧。"}
   ```
 
3. 诊断：脚本偶尔卡死，最有可能是少了什么？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"没设 ` timeout `。` Serial(..., timeout=None) ` 时读不到数据会永久阻塞。"}
   ```
 
4. 动手：给 ` frame_codec.py ` 加一个"校验错误的帧"，看 ` feed ` 返回的 ` ok ` 是否为 ` False `；再给解析器加"连续丢弃前导垃圾字节"。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"改一个 payload 字节即可让异或校验失败，返回 ` (payload, False) `。垃圾字节由 ` find(SYNC) ` \\+ ` del self.buf[:i] ` 处理——正是解析器里已有的逻辑。"}
   ```
 
5. 判断：重传时改变 ` seq ` 更安全。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"相反：重传 **保持 seq 不变** ，设备才能识别\"这是同一请求的重复\"，做去重；改 seq 会被当成新请求处理。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 03 完成？**  给你自己的设备协议写一个上位机收/发脚本：能组帧、能流式解帧、能超时重传。

 

```zhizhan-assessment
{"id":"course-b04-m03","criterion":"解析分片与坏帧，拔插串口和取消后端口释放，原始流可留存回放。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[Python 3.13 标准库](https://docs.python.org/3.13/library/)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b04-guide)
