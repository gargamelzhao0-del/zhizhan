#![no_std]
use core::marker::PhantomData;

// 类型状态机：只有 init() 之后，类型才允许 write()
pub struct Uninit;
pub struct Ready;

pub struct Uart<State> {
    base: u32,
    _s: PhantomData<State>,
}
impl Uart<Uninit> {
    pub fn new(base: u32) -> Self { Self { base, _s: PhantomData } }
    pub fn init(self) -> Uart<Ready> { /* 配置寄存器 */ Uart { base: self.base, _s: PhantomData } }
}
impl Uart<Ready> {
    pub fn write(&mut self, b: u8) { unsafe { core::ptr::write_volatile((self.base + 4) as *mut u32, b as u32) } }
}

pub fn demo() {
    let mut u = Uart::new(0x4001_3800).init();  // 先 init
    u.write(0x41);                              // 再 write
}
