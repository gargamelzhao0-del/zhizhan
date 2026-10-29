#![no_std]
use core::marker::PhantomData;
pub struct Uninit; pub struct Ready;
pub struct Uart<State> { base: u32, _s: PhantomData<State> }
impl Uart<Uninit> { pub fn new(base: u32) -> Self { Self { base, _s: PhantomData } } }
impl Uart<Ready> { pub fn write(&mut self, _b: u8) {} }
pub fn bad() {
    let mut u = Uart::<Uninit>::new(0x4001_3800);
    u.write(0x41);   // 错误：Uninit 的 Uart 没有 write()
}
