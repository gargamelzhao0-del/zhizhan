#ifndef COURSE_SAMPLE_H
#define COURSE_SAMPLE_H
#include <stdbool.h>
#include <stdint.h>
typedef struct { uint32_t seq, ms; uint16_t raw, mv; } Sample;
/* Endpoint-calibrated conversion; not a claim about physical ADC accuracy.
 * Inputs: 12-bit unsigned raw, nominal 3300 mV full-scale. */
static inline bool sample_make(Sample *out, uint32_t seq, uint32_t ms, uint32_t raw) {
    if (!out || raw>4095U) return false;
    *out=(Sample){seq,ms,(uint16_t)raw,(uint16_t)((raw*3300U+2047U)/4095U)};
    return true;
}
#endif
