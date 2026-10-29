/* B23 host exercise. Buffer operations require serialized access.
 * No hardware, interrupt synchronization, PWM or watchdog driver is included.
 */
#include <assert.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <math.h>

enum { CAPACITY = 8 };
typedef struct { uint16_t data[CAPACITY]; unsigned head, tail; } Ring;
static bool ring_push(Ring *q, uint16_t value) {
    unsigned next = (q->head + 1u) & (CAPACITY - 1u);
    if (next == q->tail) return false;
    q->data[q->head] = value;
    q->head = next;
    return true;
}
static bool ring_pop(Ring *q, uint16_t *value) {
    if (q->head == q->tail) return false;
    *value = q->data[q->tail];
    q->tail = (q->tail + 1u) & (CAPACITY - 1u);
    return true;
}
static int16_t q15_mul(int16_t x, int16_t y) {
    int32_t v = ((int32_t)x * (int32_t)y) / 32768;
    if (v > 32767) v = 32767;
    if (v < -32768) v = -32768;
    return (int16_t)v;
}
typedef struct { float kp, ki, integral, lo, hi; } PI;
static bool pi_step(PI *p, float reference, float measured, float dt, float *u) {
    *u = 0.0f;
    if (!isfinite(reference) || !isfinite(measured) || !isfinite(dt) || dt <= 0.0f) return false;
    float error = reference - measured;
    float candidate = p->integral + p->ki * error * dt;
    float proposal = p->kp * error + candidate;
    if (!isfinite(proposal)) return false;
    bool pushing = (proposal > p->hi && error > 0.0f) || (proposal < p->lo && error < 0.0f);
    if (!pushing) p->integral = candidate;
    float raw = p->kp * error + p->integral;
    *u = fminf(p->hi, fmaxf(p->lo, raw));
    return true;
}
typedef enum { SAFE, ACTIVE, FAULT } State;
static State state_step(State s, bool sensor_ok, bool overtemp, bool reset, bool arm) {
    if (!sensor_ok || overtemp) return FAULT;
    if (s == FAULT) return reset ? SAFE : FAULT;
    if (s == SAFE && arm) return ACTIVE;
    return s;
}
int main(void) {
    Ring q = {0}; uint16_t value = 0;
    assert(!ring_pop(&q, &value));
    for (unsigned i = 0; i < CAPACITY - 1u; ++i) assert(ring_push(&q, (uint16_t)i));
    assert(!ring_push(&q, 99));
    for (unsigned i = 0; i < CAPACITY - 1u; ++i) { assert(ring_pop(&q, &value)); assert(value == i); }
    for (unsigned i = 0; i < 10000; ++i) { assert(ring_push(&q, (uint16_t)i)); assert(ring_pop(&q, &value)); assert(value == i); }
    assert(q15_mul(-32768, -32768) == 32767);
    assert(q15_mul(16384, 16384) == 8192);
    assert(q15_mul(-16384, 16384) == -8192);
    assert(state_step(ACTIVE, false, false, false, false) == FAULT);
    assert(state_step(FAULT, true, false, false, true) == FAULT);
    assert(state_step(FAULT, true, false, true, true) == SAFE);
    PI p = {0.035f, 0.0035f, 0.0f, 0.0f, 1.0f}; float u = 0.0f;
    for (int i = 0; i < 1000; ++i) { assert(pi_step(&p, 95, 25, 0.1f, &u)); assert(u == 1); }
    assert(p.integral == 0.0f);
    assert(!pi_step(&p, 45, NAN, 0.1f, &u)); assert(u == 0);
    assert(!pi_step(&p, 45, 25, 0, &u)); assert(u == 0);
    float y = 25, a = expf(-0.1f / 20.0f);
    for (int i = 0; i < 4000; ++i) {
        assert(pi_step(&p, 45, y, 0.1f, &u));
        assert(u >= 0 && u <= 1);
        y = a * y + (1 - a) * (25 + 60 * u);
    }
    assert(fabsf(y - 45) < 0.01f);
    puts("PASS: ring boundaries/wrap, Q15, fault latch, saturation, PI convergence");
    return 0;
}
