import { useState } from "react";

export function EmbeddedCalc() {
  const [tab, setTab] = useState<"reg" | "tim" | "adc">("reg");
  const [hexInput, setHexInput] = useState("0x0005040A");
  const [clkMhz, setClkMhz] = useState(72);
  const [psc, setPsc] = useState(71);
  const [arr, setArr] = useState(999);
  const [vref, setVref] = useState(3.3);
  const [bits, setBits] = useState(12);
  const [rawCode, setRawCode] = useState(2048);

  const parsedReg = (() => {
    const clean = hexInput.trim().replace(/^0x/i, "");
    const val = Number.parseInt(clean || "0", 16);
    return Number.isNaN(val) ? 0 : val >>> 0;
  })();

  const toggleBit = (b: number) => {
    const next = (parsedReg ^ ((1 << b) >>> 0)) >>> 0;
    setHexInput(`0x${next.toString(16).toUpperCase().padStart(8, "0")}`);
  };

  const setBitsList: number[] = [];
  for (let i = 31; i >= 0; i--) {
    if ((parsedReg >>> i) & 1) setBitsList.push(i);
  }
  const cMaskExpr =
    setBitsList.length === 0
      ? "0x00000000U"
      : setBitsList.length <= 6
        ? setBitsList.map((b) => `(1U << ${b})`).join(" | ")
        : `0x${parsedReg.toString(16).toUpperCase().padStart(8, "0")}U`;

  const timTickHz = (clkMhz * 1_000_000) / Math.max(1, psc + 1);
  const timFreqHz = timTickHz / Math.max(1, arr + 1);
  const timPeriodMs = 1000 / Math.max(0.0001, timFreqHz);

  const maxCount = (1 << bits) - 1;
  const lsbMv = (vref * 1000) / Math.max(1, 1 << bits);
  const measuredV = (Math.min(maxCount, Math.max(0, rawCode)) / maxCount) * vref;

  return (
    <div className="emb-calc">
      <div className="chapter-demo-tabs" role="tablist" aria-label="随身工程计算尺">
        <button
          role="tab"
          aria-selected={tab === "reg"}
          className={tab === "reg" ? "active" : ""}
          onClick={() => setTab("reg")}
        >
          <span>32-Bit</span>寄存器位透视
        </button>
        <button
          role="tab"
          aria-selected={tab === "tim"}
          className={tab === "tim" ? "active" : ""}
          onClick={() => setTab("tim")}
        >
          <span>TIM</span>分频与周期
        </button>
        <button
          role="tab"
          aria-selected={tab === "adc"}
          className={tab === "adc" ? "active" : ""}
          onClick={() => setTab("adc")}
        >
          <span>ADC</span>量化与电压
        </button>
      </div>

      {tab === "reg" && (
        <div className="emb-calc-pane">
          <label className="emb-calc-field">
            <span>十六进制寄存器值（点击下方任意位可翻转 0/1）</span>
            <input
              type="text"
              value={hexInput}
              onChange={(e) => setHexInput(e.target.value)}
              placeholder="例如 0x0005040A"
            />
          </label>
          <div className="emb-reg-grid" aria-label="32位寄存器位图">
            {Array.from({ length: 32 }, (_, idx) => {
              const bit = 31 - idx;
              const isOne = ((parsedReg >>> bit) & 1) === 1;
              return (
                <button
                  key={bit}
                  type="button"
                  className={`emb-reg-bit ${isOne ? "is-one" : ""}`}
                  onClick={() => toggleBit(bit)}
                >
                  <small>{bit}</small>
                  <strong>{isOne ? "1" : "0"}</strong>
                </button>
              );
            })}
          </div>
          <div className="demo-reg-strip">
            <span>置位位号：{setBitsList.length ? setBitsList.join(", ") : "无"}</span>
            <code>{cMaskExpr}</code>
          </div>
        </div>
      )}

      {tab === "tim" && (
        <div className="emb-calc-pane">
          <div className="emb-calc-row">
            <label className="emb-calc-field">
              <span>TIM 时钟 (MHz)</span>
              <input
                type="number"
                value={clkMhz}
                onChange={(e) => setClkMhz(Number(e.target.value) || 1)}
              />
            </label>
            <label className="emb-calc-field">
              <span>预分频 PSC</span>
              <input
                type="number"
                value={psc}
                onChange={(e) => setPsc(Math.max(0, Number(e.target.value) || 0))}
              />
            </label>
            <label className="emb-calc-field">
              <span>重装载 ARR</span>
              <input
                type="number"
                value={arr}
                onChange={(e) => setArr(Math.max(1, Number(e.target.value) || 1))}
              />
            </label>
          </div>
          <div className="demo-grid-cards">
            <div className="demo-stat-card is-accent">
              <small>计数时钟 f_CK_CNT</small>
              <strong>
                {timTickHz >= 1_000_000
                  ? `${(timTickHz / 1_000_000).toFixed(2)} MHz`
                  : `${(timTickHz / 1000).toFixed(2)} kHz`}
              </strong>
              <span>f_TIM / (PSC + 1)</span>
            </div>
            <div className="demo-stat-card ok">
              <small>溢出频率 / PWM 频率</small>
              <strong>
                {timFreqHz >= 1000
                  ? `${(timFreqHz / 1000).toFixed(3)} kHz`
                  : `${timFreqHz.toFixed(2)} Hz`}
              </strong>
              <span>周期 T = {timPeriodMs.toFixed(3)} ms</span>
            </div>
          </div>
        </div>
      )}

      {tab === "adc" && (
        <div className="emb-calc-pane">
          <div className="emb-calc-row">
            <label className="emb-calc-field">
              <span>参考电压 Vref (V)</span>
              <input
                type="number"
                step="0.1"
                value={vref}
                onChange={(e) => setVref(Number(e.target.value) || 3.3)}
              />
            </label>
            <label className="emb-calc-field">
              <span>分辨率 (Bits)</span>
              <select value={bits} onChange={(e) => setBits(Number(e.target.value))}>
                <option value={10}>10-bit (1023)</option>
                <option value={12}>12-bit (4095)</option>
                <option value={16}>16-bit (65535)</option>
              </select>
            </label>
            <label className="emb-calc-field">
              <span>ADC 原始码 Raw</span>
              <input
                type="number"
                value={rawCode}
                onChange={(e) => setRawCode(Number(e.target.value) || 0)}
              />
            </label>
          </div>
          <div className="demo-grid-cards">
            <div className="demo-stat-card is-accent">
              <small>换算引脚电压 V_in</small>
              <strong>{measuredV.toFixed(4)} V</strong>
              <span>占满量程 {((measuredV / vref) * 100).toFixed(1)}%</span>
            </div>
            <div className="demo-stat-card ok">
              <small>最小量化步进 (1 LSB)</small>
              <strong>{lsbMv.toFixed(3)} mV</strong>
              <span>Vref / 2^{bits}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
