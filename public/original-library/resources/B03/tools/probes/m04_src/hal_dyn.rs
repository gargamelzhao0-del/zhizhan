#![no_std]
pub trait OutputPin { fn set_high(&mut self); fn set_low(&mut self); }
pub struct LedDyn<'a> { pin: &'a mut dyn OutputPin }
impl<'a> LedDyn<'a> {
    pub fn new(pin: &'a mut dyn OutputPin) -> Self { Self { pin } }
    pub fn on(&mut self) { self.pin.set_high(); }
}
pub struct Gpio { odr: u32 }
impl OutputPin for Gpio {
    fn set_high(&mut self) { self.odr |= 1; }
    fn set_low(&mut self) { self.odr &= !1; }
}
// 一份代码，运行期通过 vtable 分派
#[no_mangle] pub extern "C" fn use_dyn(g: &mut Gpio) { let mut l = LedDyn::new(g); l.on(); }
