"""B23 teaching model: first-order plant + PI, standard library only.

This is a synthetic plant, not a controller for a physical heater.
The actuator command is held constant over each sampling interval.
"""
import argparse
import csv
import json
import math
from pathlib import Path


def simulate(setpoint=45.0, kp=0.035, ki=0.0035, tau=20.0,
             anti_windup=True, scenario='normal', dt=0.1, duration=120.0):
    values = (setpoint, kp, ki, tau, dt, duration)
    if not all(math.isfinite(x) for x in values):
        raise ValueError('Parameters must be finite')
    if tau <= 0 or dt <= 0 or duration <= 0 or kp < 0 or ki < 0:
        raise ValueError('Invalid time constant, time step, duration or gains')
    if scenario not in {'normal', 'cooling', 'recovery', 'sensor-fault'}:
        raise ValueError('Unknown scenario')
    steps = round(duration / dt)
    if steps < 1 or steps > 1_000_000 or not math.isclose(steps * dt, duration):
        raise ValueError('Duration must be an integer number of steps (<= 1000000)')
    temperature, integral, fault = 25.0, 0.0, False
    a = math.exp(-dt / tau)
    rows = []
    for n in range(steps + 1):
        t = n * dt
        reference = 25.0 if t < 5.0 else setpoint
        if scenario == 'recovery' and 5.0 <= t < 60.0:
            reference = 95.0
        ambient = 20.0 if scenario == 'cooling' and t >= 60.0 else 25.0
        fault = fault or (scenario == 'sensor-fault' and t >= 70.0)
        error = reference - temperature
        if fault:
            output, raw = 0.0, 0.0
        else:
            candidate = integral + ki * error * dt
            proposal = kp * error + candidate
            pushing_limit = (proposal > 1.0 and error > 0.0) or (proposal < 0.0 and error < 0.0)
            if not (anti_windup and pushing_limit):
                integral = candidate
            raw = kp * error + integral
            output = min(1.0, max(0.0, raw))
        rows.append(dict(t_s=t, setpoint_c=reference, temperature_c=temperature,
                         output=output, integral=integral, raw=raw, fault=int(fault)))
        if n < steps:
            temperature = a * temperature + (1.0 - a) * (ambient + 60.0 * output)
    metrics = dict(final_error_c=rows[-1]['setpoint_c'] - rows[-1]['temperature_c'],
                   iae_c_s=sum(abs(r['setpoint_c'] - r['temperature_c']) * dt for r in rows[:-1]),
                   peak_integral=max(abs(r['integral']) for r in rows),
                   saturation_s=sum(dt for r in rows[:-1] if r['t_s'] >= 5 and (r['output'] <= 0 or r['output'] >= 1)),
                   fault_latched=bool(rows[-1]['fault']))
    return dict(rows=rows, metrics=metrics)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--setpoint', type=float, default=45)
    parser.add_argument('--kp', type=float, default=0.035)
    parser.add_argument('--ki', type=float, default=0.0035)
    parser.add_argument('--tau', type=float, default=20)
    parser.add_argument('--dt', type=float, default=0.1)
    parser.add_argument('--duration', type=float, default=120)
    parser.add_argument('--anti-windup', choices=['on', 'off'], default='on')
    parser.add_argument('--scenario', choices=['normal', 'cooling', 'recovery', 'sensor-fault'], default='normal')
    parser.add_argument('--out', type=Path, default=Path('thermal-log.csv'))
    args = parser.parse_args()
    try:
        result = simulate(args.setpoint, args.kp, args.ki, args.tau,
                          args.anti_windup == 'on', args.scenario, args.dt, args.duration)
    except ValueError as error:
        parser.error(str(error))
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open('w', newline='', encoding='utf-8') as stream:
        writer = csv.DictWriter(stream, fieldnames=result['rows'][0].keys())
        writer.writeheader()
        writer.writerows(result['rows'])
    print(json.dumps(dict(csv=str(args.out), **result['metrics']), indent=2))


if __name__ == '__main__':
    main()
