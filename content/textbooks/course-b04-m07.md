# 数据准备（为端侧 AI 铺路）

```zhizhan-anchor
m07
```



端侧 AI 的第一难题不是模型，而是 **数据从哪来、怎么组织、怎么切分** 。这一节用采集脚本 \+ 目录规范 \+ 按会话切分， 把"设备采回的一堆文件"变成"可训练、可复现、不泄漏的数据集"。

 

> ◷ 约 50 分钟 · ◈ 采集 · 组织 · 切分 · ⚑ 防数据泄漏

 

```zhizhan-anchor
m07-1
```



## 7.1 数据流水线：采集 → 组织 → 切分 → 训练/端侧

 

**FIG 7.1**  数据准备流水线（本册负责前三步，训练/部署属 B13）

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="数据准备流水线">
          <rect x="16" y="46" width="140" height="48" rx="6" class="sv-amb-s"></rect>
          <text x="86" y="66" class="sv-lbl-hi" text-anchor="middle">① 采集</text>
          <text x="86" y="83" class="sv-lbl-dim" text-anchor="middle">带时间戳+标签</text>
          <path d="M156 70 L192 70" class="sv-arrow-a"></path>
          <rect x="194" y="46" width="140" height="48" rx="6" class="sv-box"></rect>
          <text x="264" y="66" class="sv-lbl-hi" text-anchor="middle">② 组织</text>
          <text x="264" y="83" class="sv-lbl-dim" text-anchor="middle">目录+metadata</text>
          <path d="M334 70 L370 70" class="sv-arrow"></path>
          <rect x="372" y="46" width="140" height="48" rx="6" class="sv-grn-s"></rect>
          <text x="442" y="66" class="sv-lbl-hi" text-anchor="middle">③ 切分</text>
          <text x="442" y="83" class="sv-lbl-dim" text-anchor="middle">train/val 分组</text>
          <path d="M512 70 L548 70" class="sv-arrow"></path>
          <rect x="550" y="46" width="94" height="48" rx="6" class="sv-cyn-s"></rect>
          <text x="597" y="66" class="sv-lbl-hi" text-anchor="middle">④ 训练/端侧</text>
          <text x="597" y="83" class="sv-lbl-dim" text-anchor="middle">B13</text>
        </svg>
```

 

前三步都在"上位机 Python"完成； **标签与切分策略的质量，直接决定后面模型能不能用** 。数据准备做对，AI 才算开始。

 

```zhizhan-anchor
m07-2
```



## 7.2 采集：带时间戳与标签

 

collect\_imu.py — 从设备采集并落盘（含标签） Python

 

```text
# collect_imu.py —— 采集一段带标签的 IMU 数据
import serial, csv, time

def collect(session_id: int, label: str, seconds: float = 5.0, port="COM5"):
    path = f"raw/sess{session_id:02d}_{label}.csv"
    t0 = time.monotonic()
    with serial.Serial(port, 115200, timeout=1) as ser, open(path, "w", newline="") as f:
        w = csv.writer(f); w.writerow(["t", "ax", "ay", "az"])
        while time.monotonic() - t0 < seconds:
            line = ser.readline().decode(errors="replace").strip()   # 设备发 "ax,ay,az"
            if not line:
                continue
            try:
                ax, ay, az = (float(v) for v in line.split(","))
            except ValueError:
                continue                                             # 跳过非数据行
            w.writerow([f"{time.monotonic()-t0:.3f}", ax, ay, az])
    print("saved", path)

if __name__ == "__main__":
    collect(session_id=0, label="idle")
```

 

◆ 采集阶段的三个"必须"

 

 
- **必须带时间戳** ：后面做重采样、对齐、去抖都靠它。
 
- **必须带标签与会话号** ：标签是监督信号；会话号用于后面"按会话切分"。
 
- **必须记录元数据** ：采样率、量程、设备/固件版本、采集人——复现的命根子。

 

```zhizhan-anchor
m07-3
```



## 7.3 组织与切分：为什么"按会话"而不是"按样本"

 

数据集目录建议固定为 ` raw/ `（原始，不改）、` train/ `、` val/ `、` metadata.json `。 切分 **最关键的纪律** ：同一段会话的样本 **不能同时进训练和验证** ——否则模型"见过"验证集，指标虚高（数据泄漏）。

 

split\_dataset.py — 按会话切分（可跑） Python

 

```text
# split_dataset.py —— 生成会话数据，按"会话"切分训练/验证（避免数据泄漏）
import os, random
from collections import Counter

random.seed(7)
SESSIONS, PER_SESSION = 6, 20
labels = ["idle", "shake", "tilt"]

def make_dataset(root="dataset"):
    os.makedirs(os.path.join(root, "raw"), exist_ok=True)
    meta = []
    for s in range(SESSIONS):
        label = labels[s % len(labels)]
        for i in range(PER_SESSION):
            name = f"sess{s:02d}_{label}_{i:03d}.csv"
            open(os.path.join(root, "raw", name), "w").write("ax,ay,az\n0,0,1\n")
            meta.append({"file": name, "session": s, "label": label})
    return meta

def split(meta, val_ratio=0.34):
    sess = sorted({m["session"] for m in meta})
    n_val = max(1, round(len(sess) * val_ratio))
    val_sess = set(sess[-n_val:])                 # 按会话划分，而非按样本
    train = [m for m in meta if m["session"] not in val_sess]
    val   = [m for m in meta if m["session"] in val_sess]
    return train, val, sorted(val_sess)

if __name__ == "__main__":
    meta = make_dataset()
    train, val, vs = split(meta)
    print(f"sessions={len({m['session'] for m in meta})}  samples={len(meta)}")
    print(f"train={len(train)}  val={len(val)}  val_sessions={vs}")
    print("train labels:", dict(Counter(m["label"] for m in train)))
    print("val   labels:", dict(Counter(m["label"] for m in val)))
```

 

**bash**  — 复跑：` python tools/probes/m07_src/split_dataset.py `（CPython 3.13）

 

```text
$ python split_dataset.py
sessions=6  samples=120
train=80  val=40  val_sessions=[4, 5]
train labels: {'idle': 40, 'shake': 20, 'tilt': 20}
val   labels: {'shake': 20, 'tilt': 20}
# 切分按会话：验证集来自会话 4、5，训练集不含它们 → 不会泄漏。
# 但注意：验证集里没有 idle（类别覆盖不全）——这是切分要检查的第二个问题。
```

 

⚠ 切分要同时检查两件事

 

 
- **无泄漏** ：同一会话/同一设备/同一时段的样本不跨集合（否则指标虚高）。
 
- **类别覆盖** ：每个类别在训练与验证里都应出现（本例验证集缺 ` idle `，是典型毛病）。

 

```zhizhan-anchor
m07-4
```



## 7.4 切分要防"同源泄漏"

 

```zhizhan-anchor
m07-5
```



## 7.5 数据集的可复现清单

 

**FIG 7.2**  按会话切分，避免同一会话跨训练/测试

 

```zhizhan-figure
<svg viewBox="0 0 660 140" role="img" aria-label="同一会话的样本要么全在训练、要么全在测试，防止数据泄漏高估效果">
          <rect x="30" y="40" width="150" height="56" rx="6" class="sv-grn-s"></rect>
          <text x="105" y="63" class="sv-lbl-hi" text-anchor="middle">会话A</text>
          <text x="105" y="83" class="sv-lbl-dim" text-anchor="middle">→ 训练</text>
          <rect x="200" y="40" width="150" height="56" rx="6" class="sv-grn-s"></rect>
          <text x="275" y="63" class="sv-lbl-hi" text-anchor="middle">会话B</text>
          <text x="275" y="83" class="sv-lbl-dim" text-anchor="middle">→ 训练</text>
          <rect x="370" y="40" width="150" height="56" rx="6" class="sv-amb-s"></rect>
          <text x="445" y="63" class="sv-lbl-hi" text-anchor="middle">会话C</text>
          <text x="445" y="83" class="sv-lbl-dim" text-anchor="middle">→ 测试</text>
          <text x="580" y="72" class="sv-lbl-hi" text-anchor="middle">整会话不拆开</text>
        </svg>
```

 

按样本随机切分会让同一动作"半截在训练、半截在测试"，评估虚高。

 

split\_sessions.py — 按会话切分 Python

 

```text
def split_by_session(sessions, ratio=0.8):
    cut = int(len(sessions) * ratio)
    return sessions[:cut], sessions[cut:]

tr, te = split_by_session(["A", "B", "C", "D", "E"])
print("train:", tr)
print("test :", te)
```

 

**bash**  — 复跑：` python tools/probes/m07_src/split_dataset.py `（本机真实运行）

 

| 切分方式 | 是否泄漏 | 说明 |
| --- | --- | --- |
| 按会话 | 否 | 推荐 |
| 按时间 | 可能 | 训练在前、测试在后 |
| 按样本随机 | 是 | 同源样本会跨集 |
| 留出验证集 | — | 用于调参 |

 

| 可复现清单 | 做法 |
| --- | --- |
| 固定种子 | ` random.seed(0) ` |
| 记录切分 | 保存 train/test 索引 |
| 数据版本 | 文件名含哈希/时间 |
| 标签来源 | 谁标的、规则是什么 |

 

◆ 迁移练习

 

把你的数据集从"按样本随机切分"改成"按会话切分"，对比两种切分下的评估分数差异，解释泄漏来源。

 

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| timestamp | float/int | 采集时刻 |
| session\_id | str | 同一采集会话 |
| label | str/int | 类别标签 |
| payload | list/array | 原始测量 |

 

| 标签规范 | 做法 |
| --- | --- |
| 谁标的 | 记录标注者/规则 |
| 一致性 | 先定标签集再标 |
| 不均衡 | 关注少数类 |
| 留空 | 明确未知标签 |

 

◆ 本章要点

 

 
- 数据准备流水线：采集 → 组织 → 切分 →（训练/端侧，B13）。
 
- 采集必带 **时间戳 \+ 标签 \+ 会话号 \+ 元数据** ，否则不可复现。
 
- 切分要 **按会话** （防泄漏），并检查 **类别覆盖** 。
 
- 数据集目录固定 ` raw/ train/ val/ metadata.json `，原始数据只读不改。
 
- 这些数据将喂给 B13 的端侧 AI 与数据闭环。

 

◆ 自测 · Module 07（先答再看）

 

 
1. 简答：为什么训练/验证要"按会话"而不是"按样本"随机切？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"同一会话的样本高度相关（同一次佩戴/同一环境），若随机切会把\"近邻\"分到两边，验证集等于\"见过\"，指标虚高——即数据泄漏。"}
   ```
 
2. 判断：只要切分不泄漏，就没问题了。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"还要看 **类别覆盖** 。本例验证集缺 ` idle `，即使无泄漏，也无法评估该类——覆盖不全是切分的第二个检查点。"}
   ```
 
3. 诊断：采集脚本把非数据行（如设备日志）也写进了 CSV，会造成什么？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"后面解析会报错或污染统计；应在采集时就过滤（` try/except ValueError: continue `），或严格用帧解析（M03）区分数据与日志。"}
   ```
 
4. 动手：把 ` val_ratio ` 改成 0.5 再看输出，检查验证集的类别覆盖是否变化。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"会多切一个会话进验证集，覆盖情况随之变化——说明\"覆盖\"会受切分比例影响，需要在设计会话的标签分布时就考虑。"}
   ```
 
5. 判断：原始数据（raw）应该随手就改，方便整理。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不应。原始数据应 **只读** 、先备份；清洗/切分产物写到别的目录。否则无法复现，也无法回溯标注错误。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 07 完成？**  用 §7.2 的采集脚本采一小批带标签数据，用 §7.3 的方式按会话切分，并检查类别覆盖。

 

```zhizhan-assessment
{"id":"course-b04-m07","criterion":"训练、验证与测试按会话隔离；预处理只在训练集拟合。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[Python 3.13 标准库](https://docs.python.org/3.13/library/)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b04-guide)
