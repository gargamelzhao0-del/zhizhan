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
