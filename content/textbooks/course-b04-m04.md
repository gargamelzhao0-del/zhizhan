# 数据分析服务于调试

```zhizhan-anchor
m04
```



设备导出一份 CSV，靠肉眼盯着数字找问题既慢又漏。这一节用 ` numpy `/` pandas `/` matplotlib ` 把"采回的原始数据"变成"一眼能看出的结论"——所有分析与输出都在本机真实运行。

 

> ◷ 约 60 分钟 · ◈ numpy · pandas · matplotlib · ⚑ 真跑真出图

 

```zhizhan-anchor
m04-1
```



## 4.1 数据流水线：从设备字节到结论

 

**FIG 4.1**  数据分析流水线：设备导出的原始数据 → 清洗 → 分析 → 结论/图

 

```zhizhan-figure
<svg viewBox="0 0 660 150" role="img" aria-label="数据分析流水线">
          <rect x="20" y="52" width="120" height="46" rx="6" class="sv-amb-s"></rect>
          <text x="80" y="72" class="sv-lbl-hi" text-anchor="middle">设备 CSV</text>
          <text x="80" y="89" class="sv-lbl-dim" text-anchor="middle">采样/日志</text>
          <path d="M140 75 L180 75" class="sv-arrow-a"></path>
          <rect x="182" y="52" width="120" height="46" rx="6" class="sv-box"></rect>
          <text x="242" y="72" class="sv-lbl-hi" text-anchor="middle">pandas</text>
          <text x="242" y="89" class="sv-lbl-dim" text-anchor="middle">清洗/重采样</text>
          <path d="M302 75 L342 75" class="sv-arrow"></path>
          <rect x="344" y="52" width="120" height="46" rx="6" class="sv-grn-s"></rect>
          <text x="404" y="72" class="sv-lbl-hi" text-anchor="middle">numpy</text>
          <text x="404" y="89" class="sv-lbl-dim" text-anchor="middle">统计/异常检测</text>
          <path d="M464 75 L504 75" class="sv-arrow"></path>
          <rect x="506" y="52" width="134" height="46" rx="6" class="sv-cyn-s"></rect>
          <text x="573" y="72" class="sv-lbl-hi" text-anchor="middle">图 + 结论</text>
          <text x="573" y="89" class="sv-lbl-dim" text-anchor="middle">matplotlib/报告</text>
        </svg>
```

 

关键不是"会不会用库"，而是 **把问题转成"可计算"的形式** ：周期性？异常点？漂移？——每一种都有对应的 pandas/numpy 操作。

 

```zhizhan-anchor
m04-2
```



## 4.2 一个真实的分析脚本

 

下面这段脚本：生成（或读入）一份 1kHz 的 ADC 采样 CSV，做统计、用 **滚动中值残差** 检测异常尖峰、再按 100ms 重采样看趋势。 它是 **可运行的** ——本机实测输出见下。

 

analyze.py — CSV → 统计 / 异常 / 趋势 Python

 

```text
# analyze.py —— 把设备采回的 CSV 变成"结论"（numpy + pandas）
import numpy as np, pandas as pd

rng = np.random.default_rng(42)
fs = 1000
t = np.arange(0, 1.0, 1 / fs)              # 1 秒 @1kHz
adc = 2048 + 600 * np.sin(2 * np.pi * 5 * t) + rng.normal(0, 8, t.size)
adc[600:605] += 700                        # 注入异常尖峰（模拟干扰）

df = pd.DataFrame({"t": t, "adc": adc})
df.to_csv("adc_log.csv", index=False)      # 设备导出的就是这种 CSV

mean, std = df.adc.mean(), df.adc.std()
# 稳健异常检测：偏离"滚动中值"太多 → 疑似干扰/尖峰（比全局 z 分数更适合含周期信号）
resid = df.adc - df.adc.rolling(51, center=True, min_periods=51).median()
bad = df[resid.abs() > 200]
print(f"samples={len(df)}  mean={mean:.1f}  std={std:.1f}  "
      f"min={df.adc.min():.0f}  max={df.adc.max():.0f}")
print(f"spikes(|resid|>200) = {len(bad)}  at t = "
      f"{[round(x, 3) for x in bad.t.tolist()[:6]]}")
s = df.set_index(pd.to_timedelta(df.t, unit="s")).adc
print("100ms mean:", [int(v) for v in s.resample("100ms").mean().tolist()])
```

 

**bash**  — 复跑：` python tools/probes/m04_src/analyze.py `（pandas 3.0 / numpy 2.4）

 

```text
$ python analyze.py
samples=1000  mean=2051.3  std=427.5  min=1419  max=2818
spikes(|resid|>200) = 5  at t = [0.6, 0.601, 0.602, 0.603, 0.604]
100ms mean: [2429, 1665, 2429, 1666, 2429, 1665, 2464, 1666, 2428, 1666]
# 一句话结论：这是 5Hz 正弦，叠加了 5 个采样点的尖峰干扰（t≈0.6s）。
# 若只看"min/max vs 均值"，会误以为是噪声；滚动残差才把它单独抓出来。
```

 

**FIG 4.2**  上述脚本所采数据的波形（真实数据下采样绘制；红点即检测到的尖峰）

 

```zhizhan-figure
<svg viewBox="0 0 660 200" role="img" aria-label="ADC 采样波形与检测到的尖峰">
          <line x1="40" y1="175" x2="620" y2="175" stroke="var(--line-2)"></line>
          <line x1="40" y1="35" x2="40" y2="175" stroke="var(--line-2)"></line>
          <polyline fill="none" stroke="var(--grn)" stroke-width="1.4" points="40,105 47,97 54,91 61,86 69,84 77,86 84,90 91,97 99,105 106,114 113,120 121,123 128,126 135,123 143,119 150,111 157,104 164,96 172,89 179,86 186,84 194,86 201,92 208,99 216,107 223,115 230,121 238,125 245,125 252,123 260,118 267,110 274,102 282,94 289,89 296,85 304,85 311,87 318,93 326,100 333,108 340,116 348,122 355,125 362,125 370,122 377,117 385,109 391,101 399,93 407,88 414,85 421,85 429,88 436,94 443,102 451,110 458,117 465,123 473,125 480,125 487,121 495,115 502,107 509,99 516,92 524,87 531,84 538,85 546,89 553,96 560,103 568,112 575,119 582,123 590,125 597,124 604,120 612,114 619,105"></polyline>
          <circle cx="389" cy="79" r="4.5" fill="var(--red)"></circle>
          <text x="389" y="70" class="sv-lbl-dim" text-anchor="middle" style="fill:var(--red)">尖峰干扰（t≈0.6s）</text>
          <text x="330" y="192" class="sv-lbl-dim" text-anchor="middle">时间（0→1s）</text>
          <text x="16" y="105" class="sv-lbl-dim" text-anchor="middle" transform="rotate(-90 16 105)">ADC</text>
        </svg>
```

 

这正是脚本输出的可视化：主体是 5Hz 正弦， **红色的 5 个点** 就是被"滚动中值残差"抓出的干扰尖峰——肉眼翻 CSV 很容易漏掉。

 

```zhizhan-anchor
m04-3
```



## 4.3 三个高频分析动作

 

| 想问的问题 | 做法 | 对应代码 |
| --- | --- | --- |
| 整体是否正常？ | 统计量：均值/标准差/极值 | ` df.adc.mean()/std()/min()/max() ` |
| 有没有干扰点？ | 稳健异常：滚动中值残差 / z 分数 | ` (x - x.rolling(...).median()).abs() > k ` |
| 趋势/周期性？ | 重采样 \+ FFT | ` resample("100ms").mean() ` / ` np.fft.rfft ` |

 

✔ 为什么用"滚动中值残差"而不是全局 z 分数

 

含强周期（如正弦）的信号里，全局标准差被周期幅度支配，单个尖峰的 z 分数可能很小（本例全局 z 检不到）。 用 **局部中值** 做参考，残差只反映"相对邻域的跳变"，尖峰立刻显形。 *工具选对，比调阈值更重要。*

 

```zhizhan-anchor
m04-4
```



## 4.4 让分析可复现：固定随机与版本

 

```zhizhan-anchor
m04-5
```



## 4.5 从"看一眼"到"可回归"

 

summary.py — 一份可复现的统计 Python

 

```text
import statistics as st

def summarize(xs):
    return {"n": len(xs), "mean": round(st.mean(xs), 3),
            "min": min(xs), "max": max(xs)}

if __name__ == "__main__":
    print(summarize([1, 2, 3, 4, 5]))
```

 

outliers.py — 简单的异常检测 Python

 

```text
def outliers(xs, k=2):
    mu = sum(xs) / len(xs)
    sd = (sum((x - mu) ** 2 for x in xs) / len(xs)) ** 0.5
    return [x for x in xs if sd and abs(x - mu) > k * sd]

print(outliers([10, 10, 11, 10, 99]))
```

 

| 步骤 | 工具 | 要点 |
| --- | --- | --- |
| 读取 | ` csv `/` pandas ` | 列名/类型/缺失 |
| 清洗 | 过滤/去重 | 记录丢了多少 |
| 统计 | 均值/方差/分位 | 单位一致 |
| 报告 | 表格/图 | 可复现 |

 

| 高频动作 | 一句话 |
| --- | --- |
| 分组统计 | 按会话/设备/时间段 |
| 异常检测 | 阈值或 z-score |
| 趋势 | 滑窗均值/斜率 |

 

| 可复现要求 | 做法 |
| --- | --- |
| 固定随机种子 | ` random.seed(0) ` |
| 记录数据版本 | 文件名/哈希/时间 |
| 脚本即流水线 | 一条命令行可重跑 |
| 输出落盘 | 结果存文件便于对比 |

 

◆ 迁移练习

 

把你"手工看一眼 CSV"的步骤写成一个 ` analyze.py `，固定随机种子并输出结果文件，保证换台机器能复现同样结论。

 

◆ 本章要点

 

 
- 数据分析的目标是 **把问题转成可计算的形式** ：周期性 / 异常 / 漂移 / 相关性。
 
- 典型流水线：设备 CSV → pandas 清洗/重采样 → numpy 统计/检测 → matplotlib 出图与报告。
 
- 统计量看整体， **滚动残差/z 分数** 找异常，重采样/FFT 看趋势与频率。
 
- 含周期信号时，异常检测用 **局部** 参考（滚动中值）比全局 z 分数更可靠。
 
- 分析脚本本机实跑，输出可直接进调试报告（与 M06 的调试台呼应）。

 

◆ 自测 · Module 04（先答再看）

 

 
1. 简答：为什么"看 min/max 与均值"不足以发现偶发干扰尖峰？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"尖峰只占极少数采样，会被均值/标准差\"淹没\"（本例全局 z 检不到）。需要看 **局部** 偏离，如滚动中值残差或局部窗口 z 分数。"}
   ```
 
2. 判断：pandas 的 ` resample ` 可以直接对一个浮点秒列用。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不能，需要 DatetimeIndex/TimedeltaIndex。本例用 ` pd.to_timedelta(df.t, unit=\"s\") ` 转成时间索引后才能 ` resample(\"100ms\") `。"}
   ```
 
3. 诊断：一段含 5Hz 正弦与噪声的数据，想"看周期性"，用什么方法？
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"用 FFT（` np.fft.rfft `）看主频，或重采样后看趋势。不要用 min/max 猜。"}
   ```
 
4. 动手：把 ` analyze.py ` 的 ` resid ` 阈值从 200 改成 100，观察误检数量变化。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"阈值降低会引入更多误检（正常波动也被标记）；阈值过高会漏检。异常检测永远是\"灵敏度 vs 误报\"的权衡——要结合物理意义定。"}
   ```
 
5. 判断：matplotlib 出图只是为了报告好看。
   
    
   
   ```zhizhan-details
   {"title":"展开答案","body":"不是。图是 **发现手段** ：波形能一眼看出尖峰、漂移、阶跃；很多问题\"看数表看不出来，画出来立刻现形\"。"}
   ```
 

 

答不上来的，翻回对应小节再看一遍——比直接背结论有效得多。

 

**Module 04 完成？**  拿一份你设备的真实日志/CSV，写一个脚本输出统计量、标出异常点、并画一张图。

 

```zhizhan-assessment
{"id":"course-b04-m04","criterion":"画图前核对单位、采样间隔、缺失值；统计与手算小样本一致。","items":[{"id":"explain","label":"能不看答案解释机制与适用边界"},{"id":"run","label":"已独立完成练习并检查正常与失败结果"},{"id":"transfer","label":"改变输入/需求后仍能解释、验证并迁移"}]}
```



核对来源：[Python 3.13 标准库](https://docs.python.org/3.13/library/)；按本章适用平台、语言标准与实际工具版本核对。


---

[本册导读、实验资料与完整学习规划](doc:course-b04-guide)
