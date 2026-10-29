export type ThermalScenario =
  "normal" | "cooling" | "recovery" | "sensor-fault";
export function simulateThermal({
  kp = 0.035,
  ki = 0.0035,
  tau = 20,
  setpoint = 45,
  antiWindup = true,
  scenario = "normal" as ThermalScenario,
} = {}) {
  if (
    ![kp, ki, tau, setpoint].every(Number.isFinite) ||
    kp < 0 ||
    ki < 0 ||
    tau <= 0
  )
    throw Error("Invalid model parameters");
  const rows: {
    t: number;
    temperature: number;
    setpoint: number;
    output: number;
    integral: number;
    fault: boolean;
  }[] = [];
  let y = 25,
    integral = 0,
    fault = false;
  const dt = 0.1,
    a = Math.exp(-dt / tau);
  for (let n = 0; n <= 1200; n++) {
    const t = n * dt;
    const target =
      t < 5 ? 25 : scenario === "recovery" && t < 60 ? 95 : setpoint;
    const ambient = scenario === "cooling" && t >= 60 ? 20 : 25;
    fault ||= scenario === "sensor-fault" && t >= 70;
    const error = target - y;
    let u = 0;
    if (!fault) {
      const candidate = integral + ki * error * dt,
        proposal = kp * error + candidate;
      const pushing =
        (proposal > 1 && error > 0) || (proposal < 0 && error < 0);
      if (!antiWindup || !pushing) integral = candidate;
      u = Math.max(0, Math.min(1, kp * error + integral));
    }
    rows.push({
      t,
      temperature: y,
      setpoint: target,
      output: u,
      integral,
      fault,
    });
    if (n < 1200) y = a * y + (1 - a) * (ambient + 60 * u);
  }
  return rows;
}
