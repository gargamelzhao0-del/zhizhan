// 不带 extern template：每个包含它的 TU 都会各自实例化 Engine<Blocking>
#pragma once
#include <cstdint>
struct Blocking { static constexpr uint32_t spins = 3; };
template <class P>
struct Engine {
    __attribute__((noinline))
    static uint32_t run(uint32_t w) {
        for (uint32_t i = 0; i < P::spins; ++i) w = w * 1664525u + 1013904223u;
        return w;
    }
};
