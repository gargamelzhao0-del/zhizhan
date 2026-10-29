// 带 extern template：声明"Engine<Blocking> 别在这里生成"，只在 ext_xi.cpp 生成一份
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
extern template struct Engine<Blocking>;
