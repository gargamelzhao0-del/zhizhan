import { useMemo, useState } from "react";
import { simulateThermal, type ThermalScenario } from "./thermalModel";
export function ThermalDemo() {
  const [kp, setKp] = useState(0.035),
    [ki, setKi] = useState(0.0035),
    [tau, setTau] = useState(20),
    [anti, setAnti] = useState(true),
    [scenario, setScenario] = useState<ThermalScenario>("normal");
  const rows = useMemo(
    () => simulateThermal({ kp, ki, tau, antiWindup: anti, scenario }),
    [kp, ki, tau, anti, scenario],
  );
  const points = (key: "temperature" | "setpoint") =>
    rows
      .filter((_, i) => i % 4 === 0)
      .map((r) => `${45 + r.t * 4},${250 - r[key] * 2.2}`)
      .join(" ");
  return (
    <section className="thermal-demo" aria-label="PI 温控交互实验">
      <span className="eyebrow">交互实验 / 理想模型</span>
      <h3>改变参数，观察闭环</h3>
      <p>
        初温 25°C，5 s 时加入设定值；采样周期 0.1
        s。每次只改一项，比较响应与积分积累。
      </p>
      <div className="thermal-controls">
        <label>
          Kp <output>{kp.toFixed(3)}</output>
          <input
            aria-label="比例增益 Kp"
            type="range"
            min="0"
            max="0.1"
            step="0.001"
            value={kp}
            onChange={(e) => setKp(+e.target.value)}
          />
        </label>
        <label>
          Ki <output>{ki.toFixed(4)}</output>
          <input
            aria-label="积分增益 Ki"
            type="range"
            min="0"
            max="0.02"
            step="0.0005"
            value={ki}
            onChange={(e) => setKi(+e.target.value)}
          />
        </label>
        <label>
          时间常数 <output>{tau} s</output>
          <input
            aria-label="时间常数"
            type="range"
            min="5"
            max="60"
            step="1"
            value={tau}
            onChange={(e) => setTau(+e.target.value)}
          />
        </label>
      </div>
      <label className="thermal-scenario">
        场景
        <select
          aria-label="实验场景"
          value={scenario}
          onChange={(e) => setScenario(e.target.value as ThermalScenario)}
        >
          <option value="normal">正常升温</option>
          <option value="cooling">60 s 环境降温</option>
          <option value="recovery">高设定后回落</option>
          <option value="sensor-fault">70 s 传感器故障</option>
        </select>
      </label>
      <label>
        <input
          type="checkbox"
          checked={anti}
          onChange={(e) => setAnti(e.target.checked)}
        />
        启用抗积分饱和
      </label>
      <svg viewBox="0 0 560 290" role="img" aria-label="温度与设定值随时间变化">
        <path
          d="M45 20V250H535"
          fill="none"
          stroke="currentColor"
          opacity=".35"
        />
        {[0, 25, 50, 75, 100].map((t) => (
          <g key={t}>
            <text x="5" y={255 - t * 2.2} fill="currentColor" fontSize="12">
              {t}°
            </text>
            <path
              d={`M45 ${250 - t * 2.2}H535`}
              stroke="currentColor"
              opacity=".08"
            />
          </g>
        ))}
        <polyline
          points={points("setpoint")}
          fill="none"
          stroke="#b37e3f"
          strokeWidth="2"
          strokeDasharray="5 5"
        />
        <polyline
          points={points("temperature")}
          fill="none"
          stroke="#408c80"
          strokeWidth="2.5"
        />
        <text x="45" y="278" fill="currentColor" fontSize="12">
          0 s
        </text>
        <text x="495" y="278" fill="currentColor" fontSize="12">
          120 s
        </text>
      </svg>
      <div className="thermal-metrics" aria-live="polite">
        <span>
          末温 <b>{rows.at(-1)!.temperature.toFixed(2)}°C</b>
        </span>
        <span>
          积分峰值{" "}
          <b>{Math.max(...rows.map((r) => Math.abs(r.integral))).toFixed(3)}</b>
        </span>
        <span>
          故障 <b>{rows.at(-1)!.fault ? "已锁存，输出为零" : "未触发"}</b>
        </span>
      </div>
      <small>
        实线：温度；虚线：设定。模型不含实物噪声、迟滞和功率限制差异，不能替代目标板验证。
      </small>
    </section>
  );
}
