// gpio_raii.cpp —— 与站点 03-m02.html 的 gpio_raii.hpp 代码块逐字一致
// 构造获取、析构释放、禁拷贝。平台：STM32F1（CRL/CRH + BSRR）。
#include <cstdint>

struct gpio_regs { volatile uint32_t crl, crh, idr, odr, bsrr; };

class GpioPin {
public:
    GpioPin(gpio_regs* r, uint8_t pin) noexcept : r_(r), pin_(pin) {}

    void as_output() noexcept {
        volatile uint32_t* cfg = (pin_ < 8u) ? &r_->crl : &r_->crh;
        const uint32_t sh = (pin_ & 7u) * 4u;
        *cfg = (*cfg & ~(0xFu << sh)) | (0x1u << sh);  // CNF=00, MODE=01
        owned_ = true;
    }
    void set(bool on) noexcept {
        // BSRR 低 16 位置位、高 16 位复位：单次写即原子，不必读改写 ODR
        r_->bsrr = on ? (1u << pin_) : (1u << (pin_ + 16u));
    }

    ~GpioPin() {
        if (owned_) {
            volatile uint32_t* cfg = (pin_ < 8u) ? &r_->crl : &r_->crh;
            const uint32_t sh = (pin_ & 7u) * 4u;
            *cfg &= ~(0xFu << sh);
        }
    }

    GpioPin(const GpioPin&) = delete;
    GpioPin& operator=(const GpioPin&) = delete;

private:
    gpio_regs* r_;
    uint8_t    pin_;
    bool       owned_ = false;
};

void use_gpio(gpio_regs* r, uint8_t pin, bool fail_early)
{
    GpioPin p(r, pin);
    p.as_output();
    if (fail_early) return;      // 提前 return 也会调用 ~GpioPin()
    p.set(true);
}
