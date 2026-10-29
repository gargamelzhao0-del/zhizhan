#![no_std]
// newtype：把"寄存器地址"与"普通整数"分成不同类型
#[derive(Clone, Copy)]
pub struct RegAddr(pub u32);
#[derive(Clone, Copy)]
pub struct PinId(pub u8);

pub fn write_reg(a: RegAddr, v: u32) { unsafe { core::ptr::write_volatile(a.0 as *mut u32, v) } }
pub fn demo() {
    let a = RegAddr(0x4001_0000);
    write_reg(a, 1);
    // write_reg(0x4001_0000, 1);   // ✕ u32 不能隐式变成 RegAddr
}
