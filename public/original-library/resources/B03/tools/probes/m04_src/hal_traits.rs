#![no_std]
pub trait OutputPin { fn set_high(&mut self); fn set_low(&mut self); }

pub struct Led<P: OutputPin> { pin: P }
impl<P: OutputPin> Led<P> {
    pub fn new(pin: P) -> Self { Self { pin } }
    pub fn on(&mut self) { self.pin.set_high(); }
}

pub struct GpioA { odr: u32 }
impl OutputPin for GpioA {
    fn set_high(&mut self) { self.odr |= 1; }
    fn set_low(&mut self) { self.odr &= !1; }
}
pub struct GpioB { odr: u32 }
impl OutputPin for GpioB {
    fn set_high(&mut self) { self.odr |= 2; }
    fn set_low(&mut self) { self.odr &= !2; }
}

// 两个具体类型 → 单态化出两份代码
#[no_mangle] pub extern "C" fn use_a() { let mut l = Led::new(GpioA { odr: 0 }); l.on(); }
#[no_mangle] pub extern "C" fn use_b() { let mut l = Led::new(GpioB { odr: 0 }); l.on(); }
